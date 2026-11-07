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

// 背景放大的直接 RGBA 版本：把 flipRows + scaleBackground + flipRows
// 三次全页遍历合并成一次。数学与旧路径完全一致，只是省掉两份整页缓冲。
const scaleBackgroundToRgba = (
  rgb: Uint8Array,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
  red: number,
  rgba: Uint8ClampedArray
): void => {
  const hcoord = new Int32Array(dstW);
  const vcoord = new Int32Array(dstH);
  prepareCoord(hcoord, srcW, dstW, 1, red);
  prepareCoord(vcoord, srcH, dstH, 1, red);
  const redXmin = Math.max(0, hcoord[0] >> FRACBITS);
  const redYmin = Math.max(0, vcoord[0] >> FRACBITS);
  const redXmax = Math.min(
    srcW,
    ((hcoord[dstW - 1] + FRACSIZE - 1) >> FRACBITS) + 1
  );
  const redYmax = Math.min(
    srcH,
    ((vcoord[dstH - 1] + FRACSIZE - 1) >> FRACBITS) + 1
  );
  const bufW = Math.max(1, redXmax - redXmin);
  const line = new Int32Array(bufW * 3);
  for (let yOut = 0; yOut < dstH; yOut++) {
    const y = dstH - 1 - yOut;
    const fy = vcoord[y];
    const fracY = fy & FRACMASK;
    const fy1raw = fy >> FRACBITS;
    const fy1 = Math.max(fy1raw, redYmin);
    const fy2 = Math.min(fy1raw + 1, redYmax - 1);
    // vcoord 作用在翻转过（自下而上）的源图上，这里直接映射回原图行
    const row1 = (srcH - 1 - fy1) * srcW * 3;
    const row2 = (srcH - 1 - fy2) * srcW * 3;
    const vdeltas = fracY * 512;
    for (let i = 0; i < bufW; i++) {
      const s = (redXmin + i) * 3;
      for (let c = 0; c < 3; c++) {
        const l = rgb[row1 + s + c];
        const u = rgb[row2 + s + c];
        line[i * 3 + c] = l + INTERP[vdeltas + 256 + (u - l)];
      }
    }
    const dstRow = yOut * dstW;
    for (let x = 0; x < dstW; x++) {
      const n = hcoord[x];
      const fracX = n & FRACMASK;
      const col = (n >> FRACBITS) - redXmin;
      const sx0 = col < 0 ? 0 : Math.min(col, bufW - 1);
      const sx1 = col < 0 ? 0 : Math.min(col + 1, bufW - 1);
      const hdeltas = fracX * 512;
      const d = (dstRow + x) * 4;
      for (let c = 0; c < 3; c++) {
        const l = line[sx0 * 3 + c];
        const u = line[sx1 * 3 + c];
        rgba[d + c] = l + INTERP[hdeltas + 256 + (u - l)];
      }
      rgba[d + 3] = 255;
    }
  }
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

  constructor(page: DjvuPage, data: Uint8Array) {
    this.page = page;
    this.data = data;
    // 共享字典优先取页面自己的 Djbz，其次是 INCL 引入的共享文件
    const all = [...page.chunks, ...page.includedChunks];
    const djbz = all.find((c) => c.id === "Djbz");
    if (djbz) {
      try {
        this.dict = decodeJB2Dict(chunkData(data, djbz));
      } catch (error) {
        console.error(error);
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
        this.state.background = this.bgDecoder.getPixmap();
        return "bg44";
      }
      case "fg44": {
        if (!this.fgDecoder) this.fgDecoder = new IW44Decoder();
        this.fgDecoder.decodeChunk(chunkData(this.data, step.chunk));
        this.state.foreground = this.fgDecoder.getPixmap();
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

  // 合成页面为 RGBA（含旋转）
  composeToRgba(): DjvuPageImage {
    const width = this.page.info.width;
    const height = this.page.info.height;
    const rotation = this.page.info.rotation;
    const size = width * height;
    const rgba = new Uint8ClampedArray(size * 4);

    // 背景（BG44/BGjp，放大到页面尺寸；缺省为白色）。
    // 有效整数缩放时直接写入 RGBA，省掉两份整页中间缓冲。
    const bgSource = this.state.background || this.state.jpegBackground;
    if (bgSource && bgSource.width && bgSource.height) {
      const red = computeRed(
        width,
        height,
        bgSource.width,
        bgSource.height
      );
      if (red >= 1 && red < 16) {
        scaleBackgroundToRgba(
          bgSource.rgb,
          bgSource.width,
          bgSource.height,
          width,
          height,
          red,
          rgba
        );
      } else {
        const bg = upsampleBackground(
          bgSource.rgb,
          bgSource.width,
          bgSource.height,
          width,
          height
        );
        for (let i = 0; i < size; i++) {
          rgba[i * 4] = bg[i * 3];
          rgba[i * 4 + 1] = bg[i * 3 + 1];
          rgba[i * 4 + 2] = bg[i * 3 + 2];
          rgba[i * 4 + 3] = 255;
        }
      }
    } else {
      rgba.fill(255);
    }

    const mask = this.state.mask;
    if (!mask) {
      // 背景已经写在 rgba 中
    } else {
      // 前景颜色：FG44（复制放大）→ 逐像素；FGbz → 按 blit 的调色板颜色；否则黑色
      const fgSource = this.state.foreground || this.state.jpegForeground;
      let fgRgb: Uint8Array | null = null;
      let fgRowOffsets: Int32Array | null = null;
      let fgColOffsets: Int32Array | null = null;
      if (fgSource) {
        const red = computeRed(width, height, fgSource.width, fgSource.height);
        // 前景与页面的整数缩小系数只允许 1..12（三层模型约定），
        // 超出范围时忽略前景层
        if (red >= 1 && red <= 12) {
          fgRgb = fgSource.rgb;
          fgRowOffsets = new Int32Array(height);
          fgColOffsets = new Int32Array(width);
          const fw = fgSource.width;
          const fh = fgSource.height;
          for (let y = 0; y < height; y++) {
            let srcRow = Math.floor((height - 1 - y) / red);
            if (srcRow > fh - 1) srcRow = fh - 1;
            fgRowOffsets[y] = (fh - 1 - srcRow) * fw * 3;
          }
          for (let x = 0; x < width; x++) {
            let srcCol = Math.floor(x / red);
            if (srcCol > fw - 1) srcCol = fw - 1;
            fgColOffsets[x] = srcCol * 3;
          }
        }
      }
      if (fgRgb && fgRowOffsets && fgColOffsets) {
        // 只覆盖掩码黑像素，背景保持 rgba 里已经写好的值
        for (let y = 0; y < height; y++) {
          const fgRow = fgRowOffsets[y];
          const rowStart = y * width;
          for (let x = 0; x < width; x++) {
            const i = rowStart + x;
            if (!mask.bits[i]) continue;
            const s = fgRow + fgColOffsets[x];
            rgba[i * 4] = fgRgb[s];
            rgba[i * 4 + 1] = fgRgb[s + 1];
            rgba[i * 4 + 2] = fgRgb[s + 2];
          }
        }
      } else if (this.state.fgbz && this.jb2Image) {
        // 每个 blit 的黑色像素使用其调色板颜色（后绘制的 blit 覆盖先前的）
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
            const rowStart = 4 * row * width;
            const src = bm.rowOffset(y);
            for (let x = 0; x < bm.columns; x++) {
              if (!bm.data[src + x]) continue;
              const column = blit.left + x;
              if (column < 0 || column >= width) continue;
              const o = rowStart + column * 4;
              rgba[o] = r;
              rgba[o + 1] = g;
              rgba[o + 2] = bl;
            }
          }
        }
      } else {
        // 纯位图：掩码为黑，其余保持背景
        for (let i = 0; i < size; i++) {
          if (mask.bits[i]) {
            rgba[i * 4] = 0;
            rgba[i * 4 + 1] = 0;
            rgba[i * 4 + 2] = 0;
          }
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
