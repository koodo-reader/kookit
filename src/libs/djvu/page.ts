// DjVu 页面解码与合成（MRC 三层模型）。
// 规范 §8.3（页面 chunk 格式）与 Appendix 1（§10，背景/前景图像）：
//   - 前景掩码 Sjbz（JB2，可引用 INCL 共享字典 Djbz）
//   - 背景 BG44（IW44，分辨率通常为页面的 1/3）或 BGjp（JPEG）
//   - 前景 FG44（IW44，常为 1/12）或 FGbz（每个 blit 的调色板颜色）或 FGjp
//   - 合成：掩码为黑处取前景色、其余取背景色；前景按整数倍复制放大，
//     背景按固定点坐标线性插值放大；最后按 INFO 的 rotation 旋转
// 解码步骤按 chunk 划分，便于分片让出主线程并做渐进渲染。
import { IffChunk, chunkData } from "./iff";
import { DjvuPage } from "./document";
import { JB2DictData, JB2Mask, decodeJB2Dict, decodeJB2Image, jb2ToMask } from "./jb2";
import { IW44Decoder, IW44Pixmap } from "./iw44";
import { bzzDecode } from "./bzz";

export interface DjvuFgbz {
  // 调色板（RGB 三元组）
  palette: Uint8Array;
  // 每个 blit 的颜色索引（与 JB2 的 blit 顺序一致）
  colorIndex: Int32Array;
}

export interface DjvuPageImage {
  width: number;
  height: number;
  rotation: number;
  // RGBA，行主序，左上原点（已按 rotation 旋转）
  rgba: Uint8ClampedArray;
}

export interface DjvuPageDecodeState {
  mask: JB2Mask | null;
  background: IW44Pixmap | null;
  foreground: IW44Pixmap | null;
  fgbz: DjvuFgbz | null;
  jpegBackground: IW44Pixmap | null;
  jpegForeground: IW44Pixmap | null;
}

interface DecodeStep {
  kind: "mask" | "bg44" | "fg44" | "fgbz" | "bgjp" | "fgjp";
  chunk: IffChunk;
}

// 解析 FGbz（颜色块：调色板按 BGR 顺序存储，这里转成 RGB）
export const parseFgbz = (data: Uint8Array): DjvuFgbz => {
  let pos = 0;
  const version = data[pos++];
  if ((version & 0x7f) !== 0) {
    throw new Error("FGbz: bad version");
  }
  const palettesize = (data[pos] << 8) | data[pos + 1];
  pos += 2;
  const palette = new Uint8Array(palettesize * 3);
  for (let i = 0; i < palettesize; i++) {
    const b = data[pos++];
    const g = data[pos++];
    const r = data[pos++];
    palette[i * 3] = r;
    palette[i * 3 + 1] = g;
    palette[i * 3 + 2] = b;
  }
  let colorIndex = new Int32Array(0);
  if (version & 0x80) {
    const datasize = (data[pos] << 16) | (data[pos + 1] << 8) | data[pos + 2];
    pos += 3;
    const payload = bzzDecode(data.subarray(pos));
    colorIndex = new Int32Array(datasize);
    for (let i = 0; i < datasize; i++) {
      colorIndex[i] = (payload[i * 2] << 8) | payload[i * 2 + 1];
    }
  }
  return { palette, colorIndex };
};

// 求两张图之间满足向上取整关系的整数缩小系数（1..15，找不到返回 16）
const computeRed = (w: number, h: number, rw: number, rh: number): number => {
  for (let red = 1; red < 16; red++) {
    if (Math.ceil(w / red) === rw && Math.ceil(h / red) === rh) return red;
  }
  return 16;
};

const flipRows = (
  rgb: Uint8Array,
  width: number,
  height: number
): Uint8Array => {
  const out = new Uint8Array(rgb.length);
  const rowSize = width * 3;
  for (let y = 0; y < height; y++) {
    out.set(
      rgb.subarray((height - 1 - y) * rowSize, (height - y) * rowSize),
      y * rowSize
    );
  }
  return out;
};

// 前景放大：按整数倍复制像素。由于 DjVu 行序自下而上，
// 复制块的边界与图像下边缘对齐，而不是简单按比例取整
const upsampleForeground = (
  rgb: Uint8Array,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
  pms: number
): Uint8Array => {
  const out = new Uint8Array(dstW * dstH * 3);
  for (let y = 0; y < dstH; y++) {
    let srcRow = Math.floor((dstH - 1 - y) / pms);
    if (srcRow > srcH - 1) srcRow = srcH - 1;
    srcRow = (srcH - 1 - srcRow) * srcW * 3;
    const dstRow = y * dstW * 3;
    for (let x = 0; x < dstW; x++) {
      let srcCol = Math.floor(x / pms);
      if (srcCol > srcW - 1) srcCol = srcW - 1;
      const s = srcRow + srcCol * 3;
      const d = dstRow + x * 3;
      out[d] = rgb[s];
      out[d + 1] = rgb[s + 1];
      out[d + 2] = rgb[s + 2];
    }
  }
  return out;
};

// 背景放大：先按自下而上的行序翻转，再缩放，最后翻回（见 §10 背景分量）
const upsampleBackground = (
  rgb: Uint8Array,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number
): Uint8Array => {
  if (srcW === dstW && srcH === dstH) return rgb;
  const red = computeRed(dstW, dstH, srcW, srcH);
  if (red >= 1 && red < 16) {
    const flippedSrc = flipRows(rgb, srcW, srcH);
    const scaled = scaleBackground(flippedSrc, srcW, srcH, dstW, dstH, red);
    return flipRows(scaled, dstW, dstH);
  }
  return rgb;
};

// ---- 背景放大：固定点坐标表（Bresenham 式步进）+ 线性插值 ----
const FRACBITS = 4;
const FRACSIZE = 1 << FRACBITS;
const FRACSIZE2 = FRACSIZE >> 1;
const FRACMASK = FRACSIZE - 1;

// 生成输出坐标 → 输入坐标的定点映射表（按缩放比例的倒数步进，
// 每步用整数除法累加，得到半像素对齐的均匀采样位置）
const prepareCoord = (
  coord: Int32Array,
  inmax: number,
  outmax: number,
  inRatio: number,
  outRatio: number
): void => {
  const len = inRatio * FRACSIZE;
  const beg = Math.floor((len + outRatio) / (2 * outRatio)) - FRACSIZE2;
  let y = beg;
  let z = Math.floor(outRatio / 2);
  const inmaxlim = (inmax - 1) * FRACSIZE;
  for (let x = 0; x < outmax; x++) {
    coord[x] = Math.min(y, inmaxlim);
    z += len;
    y += Math.floor(z / outRatio);
    z = z % outRatio;
  }
};

// 插值修正表：interp[i][256 + j] = (j*i + 8) >> 4
const INTERP: Int32Array = (() => {
  const table = new Int32Array(FRACSIZE * 512);
  for (let i = 0; i < FRACSIZE; i++) {
    for (let j = -255; j <= 255; j++) {
      table[i * 512 + 256 + j] = (j * i + FRACSIZE2) >> FRACBITS;
    }
  }
  return table;
})();

// 纯放大路径（逐通道线性插值）
const scaleBackground = (
  rgb: Uint8Array,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
  red: number
): Uint8Array => {
  const hcoord = new Int32Array(dstW);
  const vcoord = new Int32Array(dstH);
  prepareCoord(hcoord, srcW, dstW, 1, red);
  prepareCoord(vcoord, srcH, dstH, 1, red);
  // required_red 范围
  const redXmin = Math.max(0, hcoord[0] >> FRACBITS);
  const redYmin = Math.max(0, vcoord[0] >> FRACBITS);
  const redXmax = Math.min(srcW, ((hcoord[dstW - 1] + FRACSIZE - 1) >> FRACBITS) + 1);
  const redYmax = Math.min(srcH, ((vcoord[dstH - 1] + FRACSIZE - 1) >> FRACBITS) + 1);
  const out = new Uint8Array(dstW * dstH * 3);
  // 垂直插值后的行缓冲（长度覆盖 required_red 宽度）
  const bufW = Math.max(1, redXmax - redXmin);
  const line = new Int32Array(bufW * 3);
  for (let y = 0; y < dstH; y++) {
    const fy = vcoord[y];
    const fracY = fy & FRACMASK;
    // 先算出未钳制的 fy1 再分别钳制两边
    const fy1raw = fy >> FRACBITS;
    const fy1 = Math.max(fy1raw, redYmin);
    const fy2 = Math.min(fy1raw + 1, redYmax - 1);
    const row1 = fy1 * srcW * 3;
    const row2 = fy2 * srcW * 3;
    const vdeltas = fracY * 512;
    for (let i = 0; i < bufW; i++) {
      const s = (redXmin + i) * 3;
      for (let c = 0; c < 3; c++) {
        const l = rgb[row1 + s + c];
        const u = rgb[row2 + s + c];
        line[i * 3 + c] = l + INTERP[vdeltas + 256 + (u - l)];
      }
    }
    const dstRow = y * dstW * 3;
    for (let x = 0; x < dstW; x++) {
      const n = hcoord[x];
      const fracX = n & FRACMASK;
      const col = (n >> FRACBITS) - redXmin;
      // 越界时 l 与 u 取同一像素（对应 lbuffer 的边界复制）
      const sx0 = col < 0 ? 0 : Math.min(col, bufW - 1);
      const sx1 = col < 0 ? 0 : Math.min(col + 1, bufW - 1);
      const hdeltas = fracX * 512;
      for (let c = 0; c < 3; c++) {
        const l = line[sx0 * 3 + c];
        const u = line[sx1 * 3 + c];
        out[dstRow + x * 3 + c] = l + INTERP[hdeltas + 256 + (u - l)];
      }
    }
  }
  return out;
};

export const rotateRgba = (
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  count: number
): { width: number; height: number; rgba: Uint8ClampedArray } => {
  const rotation = count & 3;
  if (rotation === 0) return { width, height, rgba };
  const swap = rotation % 2 === 1;
  const outW = swap ? height : width;
  const outH = swap ? width : height;
  const out = new Uint8ClampedArray(outW * outH * 4);
  // 1=90°、2=180°、3=270°（顺时针）
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const s = (y * width + x) * 4;
      let dx: number;
      let dy: number;
      if (rotation === 1) {
        dx = height - 1 - y;
        dy = x;
      } else if (rotation === 2) {
        dx = width - 1 - x;
        dy = height - 1 - y;
      } else {
        dx = y;
        dy = width - 1 - x;
      }
      const d = (dy * outW + dx) * 4;
      out[d] = rgba[s];
      out[d + 1] = rgba[s + 1];
      out[d + 2] = rgba[s + 2];
      out[d + 3] = rgba[s + 3];
    }
  }
  return { width: outW, height: outH, rgba: out };
};

export class DjvuPageDecoder {
  readonly page: DjvuPage;
  private data: Uint8Array;
  private steps: DecodeStep[] = [];
  private stepIndex = 0;
  private dict: JB2DictData | null = null;
  private jb2Image: ReturnType<typeof decodeJB2Image> | null = null;
  private bgDecoder: IW44Decoder | null = null;
  private fgDecoder: IW44Decoder | null = null;
  private state: DjvuPageDecodeState = {
    mask: null,
    background: null,
    foreground: null,
    fgbz: null,
    jpegBackground: null,
    jpegForeground: null,
  };

  constructor(
    page: DjvuPage,
    data: Uint8Array,
    sharedDict?: JB2DictData | null
  ) {
    this.page = page;
    this.data = data;
    // 共享字典优先取页面自己的 Djbz，其次是 INCL 引入的共享文件。
    // 宿主可以传入缓存好的解码结果：一本书的每一页用到的都是同一个
    // Djbz 共享文件，按页重复解码在 iOS 上会成为最大的单页固定开销。
    if (sharedDict !== undefined) {
      this.dict = sharedDict;
    } else {
      const all = [...page.chunks, ...page.includedChunks];
      const djbz = all.find((c) => c.id === "Djbz");
      if (djbz) {
        try {
          this.dict = decodeJB2Dict(chunkData(data, djbz));
        } catch (error) {
          console.error(error);
        }
      }
    }
    const sjbz = page.chunks.find((c) => c.id === "Sjbz");
    if (sjbz) this.steps.push({ kind: "mask", chunk: sjbz });
    for (const chunk of page.chunks) {
      if (chunk.id === "BG44") this.steps.push({ kind: "bg44", chunk });
    }
    for (const chunk of page.chunks) {
      if (chunk.id === "FG44") this.steps.push({ kind: "fg44", chunk });
      else if (chunk.id === "FGbz") this.steps.push({ kind: "fgbz", chunk });
      else if (chunk.id === "BGjp") this.steps.push({ kind: "bgjp", chunk });
      else if (chunk.id === "FGjp") this.steps.push({ kind: "fgjp", chunk });
    }
  }

  get decodeState(): DjvuPageDecodeState {
    return this.state;
  }

  get isDone(): boolean {
    return this.stepIndex >= this.steps.length;
  }

  // 解码下一步；返回步骤名，全部完成返回 null
  async decodeNext(): Promise<string | null> {
    if (this.stepIndex >= this.steps.length) return null;
    const step = this.steps[this.stepIndex++];
    switch (step.kind) {
      case "mask": {
        const image = decodeJB2Image(
          chunkData(this.data, step.chunk),
          this.dict,
          this.page.info.version <= 18
        );
        this.jb2Image = image;
        this.state.mask = jb2ToMask(image);
        return "mask";
      }
      case "bg44": {
        if (!this.bgDecoder) this.bgDecoder = new IW44Decoder();
        this.bgDecoder.decodeChunk(chunkData(this.data, step.chunk));
        return "bg44";
      }
      case "fg44": {
        if (!this.fgDecoder) this.fgDecoder = new IW44Decoder();
        this.fgDecoder.decodeChunk(chunkData(this.data, step.chunk));
        return "fg44";
      }
      case "fgbz": {
        this.state.fgbz = parseFgbz(chunkData(this.data, step.chunk));
        return "fgbz";
      }
      case "bgjp":
      case "fgjp": {
        const rgb = await decodeJpegRgb(chunkData(this.data, step.chunk));
        if (step.kind === "bgjp") this.state.jpegBackground = rgb;
        else this.state.jpegForeground = rgb;
        return step.kind;
      }
      default:
        return null;
    }
  }

  // 合成页面为 RGBA（含旋转）。scale < 1 时直接按输出分辨率采样各层，
  // 不生成整页尺寸的中间缓冲（详见 composeScaled）
  composeToRgba(scale = 1): DjvuPageImage {
    // IW44 重建 pixmap（反小波）很贵，解码循环里每解一个 chunk 就重建一次
    // 等于白做几次整图重建，这里只在真正合成时重建最近一层
    if (this.bgDecoder) this.state.background = this.bgDecoder.getPixmap();
    if (this.fgDecoder) this.state.foreground = this.fgDecoder.getPixmap();
    if (scale > 0 && scale < 1) return this.composeScaled(scale);
    const width = this.page.info.width;
    const height = this.page.info.height;
    const rotation = this.page.info.rotation;
    const size = width * height;
    const rgba = new Uint8ClampedArray(size * 4);

    // 背景（BG44/BGjp，放大到页面尺寸；缺省为白色）
    let bg: Uint8Array;
    if (this.state.background) {
      bg = upsampleBackground(
        this.state.background.rgb,
        this.state.background.width,
        this.state.background.height,
        width,
        height
      );
    } else if (this.state.jpegBackground && this.state.jpegBackground.width) {
      bg = upsampleBackground(
        this.state.jpegBackground.rgb,
        this.state.jpegBackground.width,
        this.state.jpegBackground.height,
        width,
        height
      );
    } else {
      bg = new Uint8Array(size * 3).fill(255);
    }

    const mask = this.state.mask;
    if (!mask) {
      for (let i = 0; i < size; i++) {
        rgba[i * 4] = bg[i * 3];
        rgba[i * 4 + 1] = bg[i * 3 + 1];
        rgba[i * 4 + 2] = bg[i * 3 + 2];
        rgba[i * 4 + 3] = 255;
      }
    } else {
      // 前景颜色：FG44（复制放大）→ 逐像素；FGbz → 按 blit 的调色板颜色；否则黑色
      let fg: Uint8Array | null = null;
      const fgSource = this.state.foreground || this.state.jpegForeground;
      if (fgSource) {
        const red = computeRed(width, height, fgSource.width, fgSource.height);
        // 前景与页面的整数缩小系数只允许 1..12（三层模型约定），
        // 超出范围时忽略前景层
        if (red >= 1 && red <= 12) {
          fg = upsampleForeground(
            fgSource.rgb,
            fgSource.width,
            fgSource.height,
            width,
            height,
            red
          );
        }
      }
      if (fg) {
        for (let i = 0; i < size; i++) {
          const useFg = mask.bits[i] !== 0;
          rgba[i * 4] = useFg ? fg[i * 3] : bg[i * 3];
          rgba[i * 4 + 1] = useFg ? fg[i * 3 + 1] : bg[i * 3 + 1];
          rgba[i * 4 + 2] = useFg ? fg[i * 3 + 2] : bg[i * 3 + 2];
          rgba[i * 4 + 3] = 255;
        }
      } else if (this.state.fgbz && this.jb2Image) {
        // 每个 blit 的黑色像素使用其调色板颜色（后绘制的 blit 覆盖先前的）
        const colors = new Uint8Array(size * 3);
        const marked = new Uint8Array(size);
        const { palette, colorIndex } = this.state.fgbz;
        const image = this.jb2Image;
        const blitCount = Math.min(image.blits.length, colorIndex.length);
        for (let b = 0; b < blitCount; b++) {
          const blit = image.blits[b];
          const shape = image.shapes[blit.shapeIndex];
          if (!shape || !shape.bitmap) continue;
          const c = colorIndex[b];
          if (c < 0 || c * 3 + 2 >= palette.length) continue;
          const r = palette[c * 3];
          const g = palette[c * 3 + 1];
          const bl = palette[c * 3 + 2];
          const bm = shape.bitmap;
          for (let y = 0; y < bm.rows; y++) {
            const imageRow = blit.bottom + y;
            const row = height - 1 - imageRow;
            if (row < 0 || row >= height) continue;
            const rowStart = row * width;
            const src = bm.rowOffset(y);
            for (let x = 0; x < bm.columns; x++) {
              if (!bm.data[src + x]) continue;
              const column = blit.left + x;
              if (column < 0 || column >= width) continue;
              const o = rowStart + column;
              marked[o] = 1;
              colors[o * 3] = r;
              colors[o * 3 + 1] = g;
              colors[o * 3 + 2] = bl;
            }
          }
        }
        for (let i = 0; i < size; i++) {
          if (mask.bits[i] && marked[i]) {
            rgba[i * 4] = colors[i * 3];
            rgba[i * 4 + 1] = colors[i * 3 + 1];
            rgba[i * 4 + 2] = colors[i * 3 + 2];
          } else {
            rgba[i * 4] = bg[i * 3];
            rgba[i * 4 + 1] = bg[i * 3 + 1];
            rgba[i * 4 + 2] = bg[i * 3 + 2];
          }
          rgba[i * 4 + 3] = 255;
        }
      } else {
        // 纯位图：掩码为黑，其余为背景
        for (let i = 0; i < size; i++) {
          const black = mask.bits[i] !== 0;
          rgba[i * 4] = black ? 0 : bg[i * 3];
          rgba[i * 4 + 1] = black ? 0 : bg[i * 3 + 1];
          rgba[i * 4 + 2] = black ? 0 : bg[i * 3 + 2];
          rgba[i * 4 + 3] = 255;
        }
      }
    }

    // DjVu 的 rotation 计数定义在自下而上的坐标系中，转换到左上原点后方向相反
    const rotated = rotateRgba(rgba, width, height, (4 - rotation) & 3);
    return {
      width: rotated.width,
      height: rotated.height,
      rotation,
      rgba: rotated.rgba,
    };
  }

  // 按输出分辨率合成：输出像素直接采样各层（背景双线性、前景最近邻），
  // 掩码先按原生像素一遍累加出每个输出格的覆盖度，再按覆盖比例与前景色混合，
  // 缩小显示时笔画不会断。整个合成在未旋转坐标系里完成，最后交给 rotateRgba
  // 统一旋转，和整页合成共用同一套旋转逻辑。
  // 这样只分配输出尺寸的 RGBA，避免整页 4:4:4 的 RGBA/背景/前景/旋转缓冲
  // 同时存在——一张 8MP 的扫描页在缩小显示时那几份缓冲合计上百 MB。
  private composeScaled(scale: number): DjvuPageImage {
    const width = this.page.info.width;
    const height = this.page.info.height;
    const rotation = this.page.info.rotation;
    const outW = Math.max(1, Math.round(width * scale));
    const outH = Math.max(1, Math.round(height * scale));
    const rgba = new Uint8ClampedArray(outW * outH * 4);
    // 输出像素 → 原生坐标的步长（采样按像素中心对齐）
    const stepX = width / outW;
    const stepY = height / outH;

    // 背景（BG44/BGjp；缺省为白色）。缓冲行 0 为图像顶行
    const background =
      this.state.background ||
      (this.state.jpegBackground && this.state.jpegBackground.width
        ? this.state.jpegBackground
        : null);
    const bgRgb = background ? background.rgb : null;
    const bgW = background ? background.width : 0;
    const bgH = background ? background.height : 0;
    const bgRatioX = bgW / width;
    const bgRatioY = bgH / height;

    // 前景（FG44/FGjp）：只接受 1..12 的整数缩小系数（三层模型约定），
    // 行序自下而上，缩放块与页面下边缘对齐
    const fgSource = this.state.foreground || this.state.jpegForeground;
    let fgRgb: Uint8Array | null = null;
    let fgW = 0;
    let fgH = 0;
    let fgRed = 0;
    if (fgSource && fgSource.width && fgSource.height) {
      const red = computeRed(width, height, fgSource.width, fgSource.height);
      if (red >= 1 && red <= 12) {
        fgRgb = fgSource.rgb;
        fgW = fgSource.width;
        fgH = fgSource.height;
        fgRed = red;
      }
    }
    const mask = this.state.mask;
    const maskBits = mask ? mask.bits : null;
    // 没有前景颜色层时：FGbz 按 blit 调色板着色，否则掩码为黑
    const usePalette = !fgRgb && !!this.state.fgbz && !!this.jb2Image;

    // 掩码覆盖度：按原生像素一遍累积（每个原生黑像素只做一次加法），
    // 比按输出像素反复采样快得多，也是真正的面积平均，缩小后笔画不断
    const cellArea = stepX * stepY;
    let coverage: Uint16Array | null = null;
    if (maskBits && !usePalette) {
      coverage = new Uint16Array(outW * outH);
      const colCell = new Int32Array(width);
      for (let x = 0; x < width; x++) {
        colCell[x] = Math.min(outW - 1, Math.floor(x / stepX));
      }
      const rowCell = new Int32Array(height);
      for (let y = 0; y < height; y++) {
        rowCell[y] = Math.min(outH - 1, Math.floor(y / stepY)) * outW;
      }
      for (let y = 0; y < height; y++) {
        const rowBase = y * width;
        const rowOffset = rowCell[y];
        for (let x = 0; x < width; x++) {
          if (!maskBits[rowBase + x]) continue;
          coverage[rowOffset + colCell[x]]++;
        }
      }
    }

    for (let oy = 0; oy < outH; oy++) {
      const ny = (oy + 0.5) * stepY - 0.5;
      const outRow = oy * outW * 4;
      for (let ox = 0; ox < outW; ox++) {
        const nx = (ox + 0.5) * stepX - 0.5;
        const o = outRow + ox * 4;

        // 背景色：双线性采样
        let r = 255;
        let g = 255;
        let b = 255;
        if (bgRgb) {
          const fx = Math.min(
            bgW - 1,
            Math.max(0, (nx + 0.5) * bgRatioX - 0.5)
          );
          const fy = Math.min(
            bgH - 1,
            Math.max(0, (ny + 0.5) * bgRatioY - 0.5)
          );
          const x0 = Math.floor(fx);
          const y0 = Math.floor(fy);
          const x1 = Math.min(x0 + 1, bgW - 1);
          const y1 = Math.min(y0 + 1, bgH - 1);
          const tx = fx - x0;
          const ty = fy - y0;
          const s00 = (y0 * bgW + x0) * 3;
          const s10 = (y0 * bgW + x1) * 3;
          const s01 = (y1 * bgW + x0) * 3;
          const s11 = (y1 * bgW + x1) * 3;
          const top0 = bgRgb[s00] + (bgRgb[s10] - bgRgb[s00]) * tx;
          const top1 = bgRgb[s00 + 1] + (bgRgb[s10 + 1] - bgRgb[s00 + 1]) * tx;
          const top2 = bgRgb[s00 + 2] + (bgRgb[s10 + 2] - bgRgb[s00 + 2]) * tx;
          const bot0 = bgRgb[s01] + (bgRgb[s11] - bgRgb[s01]) * tx;
          const bot1 = bgRgb[s01 + 1] + (bgRgb[s11 + 1] - bgRgb[s01 + 1]) * tx;
          const bot2 = bgRgb[s01 + 2] + (bgRgb[s11 + 2] - bgRgb[s01 + 2]) * tx;
          r = top0 + (bot0 - top0) * ty;
          g = top1 + (bot1 - top1) * ty;
          b = top2 + (bot2 - top2) * ty;
        }

        // 掩码覆盖度 + 前景色（取像素中心最近的像素，前景通常是纯色块）
        if (coverage) {
          const hits = coverage[oy * outW + ox];
          if (hits > 0) {
            const ratio = hits > cellArea ? 1 : hits / cellArea;
            let fgColorR = 0;
            let fgColorG = 0;
            let fgColorB = 0;
            if (fgRgb) {
              const mx = Math.min(width - 1, Math.max(0, Math.round(nx)));
              const my = Math.min(height - 1, Math.max(0, Math.round(ny)));
              const fgX = Math.min(
                fgW - 1,
                Math.max(0, Math.floor(mx / fgRed))
              );
              const fgY =
                fgH -
                1 -
                Math.min(
                  fgH - 1,
                  Math.max(0, Math.floor((height - 1 - my) / fgRed))
                );
              const s = (fgY * fgW + fgX) * 3;
              fgColorR = fgRgb[s];
              fgColorG = fgRgb[s + 1];
              fgColorB = fgRgb[s + 2];
            }
            r += (fgColorR - r) * ratio;
            g += (fgColorG - g) * ratio;
            b += (fgColorB - b) * ratio;
          }
        }

        rgba[o] = r;
        rgba[o + 1] = g;
        rgba[o + 2] = b;
        rgba[o + 3] = 255;
      }
    }

    // FGbz：逐 blit 写入调色板颜色（后绘制的 blit 覆盖先前的，与原生路径一致）
    if (usePalette && maskBits && this.state.fgbz && this.jb2Image) {
      const { palette, colorIndex } = this.state.fgbz;
      const image = this.jb2Image;
      const blitCount = Math.min(image.blits.length, colorIndex.length);
      for (let b = 0; b < blitCount; b++) {
        const blit = image.blits[b];
        const shape = image.shapes[blit.shapeIndex];
        if (!shape || !shape.bitmap) continue;
        const c = colorIndex[b];
        if (c < 0 || c * 3 + 2 >= palette.length) continue;
        const cr = palette[c * 3];
        const cg = palette[c * 3 + 1];
        const cb = palette[c * 3 + 2];
        const bm = shape.bitmap;
        for (let y = 0; y < bm.rows; y++) {
          const ny = height - 1 - (blit.bottom + y);
          if (ny < 0 || ny >= height) continue;
          const src = bm.rowOffset(y);
          const maskRow = ny * width;
          for (let x = 0; x < bm.columns; x++) {
            if (!bm.data[src + x]) continue;
            const nx = blit.left + x;
            if (nx < 0 || nx >= width) continue;
            if (!maskBits[maskRow + nx]) continue;
            const ox = Math.min(outW - 1, Math.floor(nx / stepX));
            const oy = Math.min(outH - 1, Math.floor(ny / stepY));
            const o = (oy * outW + ox) * 4;
            rgba[o] = cr;
            rgba[o + 1] = cg;
            rgba[o + 2] = cb;
          }
        }
      }
    }

    // DjVu 的 rotation 计数定义在自下而上的坐标系中，转换到左上原点后方向相反
    const rotated = rotateRgba(rgba, outW, outH, (4 - rotation) & 3);
    return {
      width: rotated.width,
      height: rotated.height,
      rotation,
      rgba: rotated.rgba,
    };
  }
}

// 浏览器环境下解码 JPEG（BGjp/FGjp）；Node 验证脚本中返回 null
export const decodeJpegRgb = async (
  data: Uint8Array
): Promise<IW44Pixmap | null> => {
  if (typeof createImageBitmap !== "function") return null;
  try {
    const blob = new Blob([data], { type: "image/jpeg" });
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    // DjVu 的 BGjp/FGjp 行序自下而上，这里翻转为左上原点
    const w = canvas.width;
    const h = canvas.height;
    const src = imageData.data;
    const rgb = new Uint8Array(w * h * 3);
    for (let y = 0; y < h; y++) {
      const srcRow = (h - 1 - y) * w * 4;
      const dstRow = y * w * 3;
      for (let x = 0; x < w; x++) {
        rgb[dstRow + x * 3] = src[srcRow + x * 4];
        rgb[dstRow + x * 3 + 1] = src[srcRow + x * 4 + 1];
        rgb[dstRow + x * 3 + 2] = src[srcRow + x * 4 + 2];
      }
    }
    return { width: w, height: h, rgb };
  } catch (error) {
    console.error(error);
    return null;
  }
};
