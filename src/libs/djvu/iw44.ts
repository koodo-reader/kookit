// IW44 小波图像解码（BG44 / FG44 / TH44 / BM44 / PM44）。
// 规范 Appendix 1（§10）：
//   - chunk 头：serial、slices、major(bit7=灰度)、minor、宽高、chroma delay
//   - 系数编码：10 个 band 的切片循环，上下文 ctxRoot/ctxBucket/ctxStart/ctxMant
//   - 重建：32×32 liftblock → 系数矩阵 → DD(4,4) 整数小波逆变换 → 有符号字节
//   - 颜色：YCbCr 变换（§10.5）或灰度 127-v
// 每个 chunk 使用独立的 ZP 算术编码流，但量化步长与上下文跨 chunk 保留。
import { ZPCodecDecoder } from "./zpcodec";

// 各 band 的 bucket 区间 (起始 bucket, bucket 数量)
const BAND_BUCKETS: { start: number; count: number }[] = [
  { start: 0, count: 1 },
  { start: 1, count: 1 },
  { start: 2, count: 1 },
  { start: 3, count: 1 },
  { start: 4, count: 4 },
  { start: 8, count: 4 },
  { start: 12, count: 4 },
  { start: 16, count: 16 },
  { start: 32, count: 16 },
  { start: 48, count: 16 },
];

// 初始量化阈值（由规范的初始步长表按 band 展开：band 0 的前 4 个系数用
// 前 4 个步长，其余 12 个取第 5/6/7 个步长；band 1-9 取后续步长）
const QUANT_LO_INIT = [
  0x004000, 0x008000, 0x008000, 0x010000, 0x010000, 0x010000, 0x010000,
  0x010000, 0x010000, 0x010000, 0x010000, 0x010000, 0x020000, 0x020000,
  0x020000, 0x020000,
];
const QUANT_HI_INIT = [
  0, 0x020000, 0x020000, 0x040000, 0x040000, 0x040000, 0x080000, 0x040000,
  0x040000, 0x080000,
];

// 系数状态标志
const ZERO = 1;
const ACTIVE = 2;
const NEW = 4;
const UNK = 8;

const IW_BORDER = 3;
const IW_SHIFT = 6;
const IW_ROUND = 1 << (IW_SHIFT - 1);

// 1024 个系数的 zigzag 位置（liftblock 索引 → 32×32 块内自然位置）
const ZIGZAG = new Int32Array(1024);
for (let i = 0; i < 1024; i++) {
  const b0 = i & 1;
  const b1 = (i >> 1) & 1;
  const b2 = (i >> 2) & 1;
  const b3 = (i >> 3) & 1;
  const b4 = (i >> 4) & 1;
  const b5 = (i >> 5) & 1;
  const b6 = (i >> 6) & 1;
  const b7 = (i >> 7) & 1;
  const b8 = (i >> 8) & 1;
  const b9 = (i >> 9) & 1;
  const col = b0 * 16 + b2 * 8 + b4 * 4 + b6 * 2 + b8;
  const row = b1 * 16 + b3 * 8 + b5 * 4 + b7 * 2 + b9;
  ZIGZAG[i] = row * 32 + col;
}

// ---------------------------------------------------------------------------
// 小波逆变换（Appendix 1 的合成滤波器：垂直 filter_bv + 水平 filter_bh）
// ---------------------------------------------------------------------------

const filterBV = (
  p: Int16Array,
  pOff: number,
  w: number,
  h: number,
  rowsize: number,
  scale: number
): void => {
  let y = 0;
  const s = scale * rowsize;
  const s3 = s + s + s;
  const hLim = Math.floor((h - 1) / scale) + 1;
  let base = pOff;
  while (y - 3 < hLim) {
    // 1-Lifting
    {
      let q = base;
      const e = q + w;
      if (y >= 3 && y + 3 < hLim) {
        while (q < e) {
          const a = p[q - s] + p[q + s];
          const b = p[q - s3] + p[q + s3];
          p[q] = p[q] - (((a << 3) + a - b + 16) >> 5);
          q += scale;
        }
      } else if (y < hLim) {
        let q1 = y + 1 < hLim ? q + s : -1;
        let q3 = y + 3 < hLim ? q + s3 : -1;
        if (y >= 3) {
          while (q < e) {
            const a = p[q - s] + (q1 >= 0 ? p[q1] : 0);
            const b = p[q - s3] + (q3 >= 0 ? p[q3] : 0);
            p[q] = p[q] - (((a << 3) + a - b + 16) >> 5);
            q += scale;
            if (q1 >= 0) q1 += scale;
            if (q3 >= 0) q3 += scale;
          }
        } else if (y >= 1) {
          while (q < e) {
            const a = p[q - s] + (q1 >= 0 ? p[q1] : 0);
            const b = q3 >= 0 ? p[q3] : 0;
            p[q] = p[q] - (((a << 3) + a - b + 16) >> 5);
            q += scale;
            if (q1 >= 0) q1 += scale;
            if (q3 >= 0) q3 += scale;
          }
        } else {
          while (q < e) {
            const a = q1 >= 0 ? p[q1] : 0;
            const b = q3 >= 0 ? p[q3] : 0;
            p[q] = p[q] - (((a << 3) + a - b + 16) >> 5);
            q += scale;
            if (q1 >= 0) q1 += scale;
            if (q3 >= 0) q3 += scale;
          }
        }
      }
    }
    // 2-Interpolation
    {
      let q = base - s3;
      const e = q + w;
      if (y >= 6 && y < hLim) {
        while (q < e) {
          const a = p[q - s] + p[q + s];
          const b = p[q - s3] + p[q + s3];
          p[q] = p[q] + (((a << 3) + a - b + 8) >> 4);
          q += scale;
        }
      } else if (y >= 3) {
        let q1 = y - 2 < hLim ? q + s : q - s;
        while (q < e) {
          const a = p[q - s] + p[q1];
          p[q] = p[q] + ((a + 1) >> 1);
          q += scale;
          q1 += scale;
        }
      }
    }
    y += 2;
    base += s + s;
  }
};

const filterBH = (
  p: Int16Array,
  pOff: number,
  w: number,
  h: number,
  rowsize: number,
  scale: number
): void => {
  let y = 0;
  const s = scale;
  const s3 = s + s + s;
  const rsize = rowsize * scale;
  let rowStart = pOff;
  while (y < h) {
    let q = rowStart;
    const e = rowStart + w;
    let a0 = 0,
      a1 = 0,
      a2 = 0,
      a3 = 0;
    let b0 = 0,
      b1 = 0,
      b2 = 0,
      b3 = 0;
    if (q < e) {
      // x = 0
      if (q + s < e) a2 = p[q + s];
      if (q + s3 < e) a3 = p[q + s3];
      b2 = b3 = p[q] - ((((a1 + a2) << 3) + (a1 + a2) - a0 - a3 + 16) >> 5);
      p[q] = b3;
      q += s + s;
    }
    if (q < e) {
      // x = 2
      a0 = a1;
      a1 = a2;
      a2 = a3;
      if (q + s3 < e) a3 = p[q + s3];
      b3 = p[q] - ((((a1 + a2) << 3) + (a1 + a2) - a0 - a3 + 16) >> 5);
      p[q] = b3;
      q += s + s;
    }
    if (q < e) {
      // x = 4
      b1 = b2;
      b2 = b3;
      a0 = a1;
      a1 = a2;
      a2 = a3;
      if (q + s3 < e) a3 = p[q + s3];
      b3 = p[q] - ((((a1 + a2) << 3) + (a1 + a2) - a0 - a3 + 16) >> 5);
      p[q] = b3;
      p[q - s3] = p[q - s3] + ((b1 + b2 + 1) >> 1);
      q += s + s;
    }
    while (q + s3 < e) {
      // 通用情形
      a0 = a1;
      a1 = a2;
      a2 = a3;
      a3 = p[q + s3];
      b0 = b1;
      b1 = b2;
      b2 = b3;
      b3 = p[q] - ((((a1 + a2) << 3) + (a1 + a2) - a0 - a3 + 16) >> 5);
      p[q] = b3;
      p[q - s3] = p[q - s3] + ((((b1 + b2) << 3) + (b1 + b2) - b0 - b3 + 8) >> 4);
      q += s + s;
    }
    while (q < e) {
      // w-3 <= x < w
      a0 = a1;
      a1 = a2;
      a2 = a3;
      a3 = 0;
      b0 = b1;
      b1 = b2;
      b2 = b3;
      b3 = p[q] - ((((a1 + a2) << 3) + (a1 + a2) - a0 - a3 + 16) >> 5);
      p[q] = b3;
      p[q - s3] = p[q - s3] + ((((b1 + b2) << 3) + (b1 + b2) - b0 - b3 + 8) >> 4);
      q += s + s;
    }
    while (q - s3 < e) {
      // w <= x < w+3
      b0 = b1;
      b1 = b2;
      b2 = b3;
      if (q - s3 >= rowStart) {
        p[q - s3] = p[q - s3] + ((b1 + b2 + 1) >> 1);
      }
      q += s + s;
    }
    y += scale;
    rowStart += rsize;
  }
};

const backward = (
  p: Int16Array,
  w: number,
  h: number,
  rowsize: number,
  begin: number,
  end: number
): void => {
  for (let scale = begin >> 1; scale >= end; scale >>= 1) {
    filterBV(p, 0, w, h, rowsize, scale);
    filterBH(p, 0, w, h, rowsize, scale);
  }
};

// ---------------------------------------------------------------------------
// 系数图（32×32 块，每块 1024 个系数按 64 个 bucket 组织）
// ---------------------------------------------------------------------------

export class IW44Map {
  iw: number;
  ih: number;
  bw: number;
  bh: number;
  nb: number;
  // 每个块 1024 个系数（bucket 序：bucket b 占 [b*16, b*16+16)）
  coeffs: Int16Array;
  // 每个块 64 个 bucket 的分配标志
  present: Uint8Array;

  constructor(w: number, h: number) {
    this.iw = w;
    this.ih = h;
    this.bw = (w + 31) & ~31;
    this.bh = (h + 31) & ~31;
    this.nb = (this.bw * this.bh) / (32 * 32);
    this.coeffs = new Int16Array(this.nb * 1024);
    this.present = new Uint8Array(this.nb * 64);
  }

  // 第 blockno 块、第 buckno 个 bucket 的 16 个系数（未分配时返回 null）
  bucket(blockno: number, buckno: number): Int16Array | null {
    if (!this.present[blockno * 64 + buckno]) return null;
    const offset = blockno * 1024 + buckno * 16;
    return this.coeffs.subarray(offset, offset + 16);
  }

  ensureBucket(blockno: number, buckno: number): Int16Array {
    this.present[blockno * 64 + buckno] = 1;
    const offset = blockno * 1024 + buckno * 16;
    return this.coeffs.subarray(offset, offset + 16);
  }
}

// ---------------------------------------------------------------------------
// 编解码状态（每个分量一套；量化步长与上下文跨 chunk 保留）
// ---------------------------------------------------------------------------

class IW44Codec {
  map: IW44Map;
  curband = 0;
  curbit = 1;
  quantLo = new Int32Array(QUANT_LO_INIT);
  quantHi = new Int32Array(QUANT_HI_INIT);
  coeffstate = new Int8Array(256);
  bucketstate = new Int8Array(16);
  ctxStart = new Uint8Array(32);
  ctxBucket = new Uint8Array(10 * 8);
  ctxMant = new Uint8Array(1);
  ctxRoot = new Uint8Array(1);

  constructor(map: IW44Map) {
    this.map = map;
  }

  private isNullSlice(): boolean {
    if (this.curband === 0) {
      let isNull = true;
      for (let i = 0; i < 16; i++) {
        const threshold = this.quantLo[i];
        this.coeffstate[i] = ZERO;
        if (threshold > 0 && threshold < 0x8000) {
          this.coeffstate[i] = UNK;
          isNull = false;
        }
      }
      return isNull;
    }
    const threshold = this.quantHi[this.curband];
    return !(threshold > 0 && threshold < 0x8000);
  }

  private decodePrepare(
    fbucket: number,
    nbucket: number,
    blockno: number
  ): number {
    let bbstate = 0;
    let cstateOff = 0;
    const blk = this.map;
    if (fbucket) {
      for (let buckno = 0; buckno < nbucket; buckno++, cstateOff += 16) {
        let bstatetmp = 0;
        const pcoeff = blk.bucket(blockno, fbucket + buckno);
        if (!pcoeff) {
          bstatetmp = UNK;
        } else {
          for (let i = 0; i < 16; i++) {
            let cstatetmp = UNK;
            if (pcoeff[i]) cstatetmp = ACTIVE;
            this.coeffstate[cstateOff + i] = cstatetmp;
            bstatetmp |= cstatetmp;
          }
        }
        this.bucketstate[buckno] = bstatetmp;
        bbstate |= bstatetmp;
      }
    } else {
      const pcoeff = blk.bucket(blockno, 0);
      if (!pcoeff) {
        bbstate = UNK;
      } else {
        for (let i = 0; i < 16; i++) {
          let cstatetmp = this.coeffstate[i];
          if (cstatetmp !== ZERO) {
            cstatetmp = UNK;
            if (pcoeff[i]) cstatetmp = ACTIVE;
          }
          this.coeffstate[i] = cstatetmp;
          bbstate |= cstatetmp;
        }
      }
      this.bucketstate[0] = bbstate;
    }
    return bbstate;
  }

  private decodeBuckets(
    zp: ZPCodecDecoder,
    band: number,
    blockno: number,
    fbucket: number,
    nbucket: number
  ): void {
    let bbstate = this.decodePrepare(fbucket, nbucket, blockno);
    // 根标志
    if (nbucket < 16 || bbstate & ACTIVE) {
      bbstate |= NEW;
    } else if (bbstate & UNK) {
      if (zp.decode(this.ctxRoot, 0)) bbstate |= NEW;
    }

    const bucketstate = this.bucketstate;
    const coeffstate = this.coeffstate;
    const blk = this.map;

    // bucket 标志
    if (bbstate & NEW) {
      for (let buckno = 0; buckno < nbucket; buckno++) {
        if (bucketstate[buckno] & UNK) {
          let ctx = 0;
          if (band > 0) {
            // 上级 bucket 的 4 个系数
            const bucketIndex = fbucket + buckno;
            const upper = blk.bucket(blockno, bucketIndex >> 2);
            if (upper) {
              const k = (bucketIndex & 3) * 4;
              if (upper[k]) ctx += 1;
              if (upper[k + 1]) ctx += 1;
              if (upper[k + 2]) ctx += 1;
              if (ctx < 3 && upper[k + 3]) ctx += 1;
            }
          }
          if (bbstate & ACTIVE) ctx |= 4;
          if (zp.decode(this.ctxBucket, band * 8 + ctx)) {
            bucketstate[buckno] |= NEW;
          }
        }
      }
    }

    // 新激活系数（含符号）
    if (bbstate & NEW) {
      let thres = this.quantHi[band];
      let cstateOff = 0;
      for (let buckno = 0; buckno < nbucket; buckno++, cstateOff += 16) {
        if (!(bucketstate[buckno] & NEW)) continue;
        let pcoeff = blk.bucket(blockno, fbucket + buckno);
        if (!pcoeff) {
          pcoeff = blk.ensureBucket(blockno, fbucket + buckno);
          // 新分配的 bucket 才需要初始化系数状态
          if (fbucket === 0) {
            for (let i = 0; i < 16; i++) {
              if (coeffstate[cstateOff + i] !== ZERO) {
                coeffstate[cstateOff + i] = UNK;
              }
            }
          } else {
            for (let i = 0; i < 16; i++) coeffstate[cstateOff + i] = UNK;
          }
        }
        let gotcha = 0;
        const maxgotcha = 7;
        for (let i = 0; i < 16; i++) {
          if (coeffstate[cstateOff + i] & UNK) gotcha += 1;
        }
        for (let i = 0; i < 16; i++) {
          if (!(coeffstate[cstateOff + i] & UNK)) continue;
          if (band === 0) thres = this.quantLo[i];
          let ctx = gotcha >= maxgotcha ? maxgotcha : gotcha;
          if (bucketstate[buckno] & ACTIVE) ctx |= 8;
          if (zp.decode(this.ctxStart, ctx)) {
            coeffstate[cstateOff + i] |= NEW;
            const halfthres = thres >> 1;
            const coeff = thres + halfthres - (halfthres >> 2);
            if (zp.decodeIW()) pcoeff[i] = -coeff;
            else pcoeff[i] = coeff;
          }
          if (coeffstate[cstateOff + i] & NEW) gotcha = 0;
          else if (gotcha > 0) gotcha -= 1;
        }
      }
    }

    // 尾数位
    if (bbstate & ACTIVE) {
      let thres = this.quantHi[band];
      let cstateOff = 0;
      for (let buckno = 0; buckno < nbucket; buckno++, cstateOff += 16) {
        if (!(bucketstate[buckno] & ACTIVE)) continue;
        const pcoeff = blk.bucket(blockno, fbucket + buckno);
        if (!pcoeff) continue;
        for (let i = 0; i < 16; i++) {
          if (!(coeffstate[cstateOff + i] & ACTIVE)) continue;
          let coeff = pcoeff[i];
          if (coeff < 0) coeff = -coeff;
          if (band === 0) thres = this.quantLo[i];
          if (coeff <= 3 * thres) {
            coeff = coeff + (thres >> 2);
            if (zp.decode(this.ctxMant, 0)) coeff = coeff + (thres >> 1);
            else coeff = coeff - thres + (thres >> 1);
          } else {
            if (zp.decodeIW()) coeff = coeff + (thres >> 1);
            else coeff = coeff - thres + (thres >> 1);
          }
          if (pcoeff[i] > 0) pcoeff[i] = coeff;
          else pcoeff[i] = -coeff;
        }
      }
    }
  }

  // 解码一个 slice；返回 0 表示所有量化阈值已为 0（数据结束）
  codeSlice(zp: ZPCodecDecoder): number {
    if (this.curbit < 0) return 0;
    if (!this.isNullSlice()) {
      const band = this.curband;
      const fbucket = BAND_BUCKETS[band].start;
      const nbucket = BAND_BUCKETS[band].count;
      for (let blockno = 0; blockno < this.map.nb; blockno++) {
        this.decodeBuckets(zp, band, blockno, fbucket, nbucket);
      }
    }
    return this.finishCodeSlice();
  }

  finishCodeSlice(): number {
    this.quantHi[this.curband] = this.quantHi[this.curband] >> 1;
    if (this.curband === 0) {
      for (let i = 0; i < 16; i++) {
        this.quantLo[i] = this.quantLo[i] >> 1;
      }
    }
    this.curband += 1;
    if (this.curband >= BAND_BUCKETS.length) {
      this.curband = 0;
      this.curbit += 1;
      if (this.quantHi[BAND_BUCKETS.length - 1] === 0) {
        this.curbit = -1;
        return 0;
      }
    }
    return 1;
  }

  // 重建为有符号字节（iw×ih，行 0 为图像顶行）
  renderMap(fast: boolean): Int8Array {
    const map = this.map;
    const bw = map.bw;
    const bh = map.bh;
    const data16 = new Int16Array(bw * bh);
    // 组装系数矩阵（块内按自然顺序）
    let blockno = 0;
    for (let by = 0; by < bh; by += 32) {
      for (let bx = 0; bx < bw; bx += 32) {
        // 按 zigzag 顺序取 bmin=0..bmax=64 的 bucket 填入块内自然位置
        for (let buckno = 0; buckno < 64; buckno++) {
          const src = map.bucket(blockno, buckno);
          const base = buckno * 16;
          if (!src) continue; // 未分配的 bucket 保持 0
          for (let i = 0; i < 16; i++) {
            const natural = ZIGZAG[base + i];
            const dst = (by + (natural >> 5)) * bw + bx + (natural & 31);
            data16[dst] = src[i];
          }
        }
        blockno += 1;
      }
    }
    // 逆变换
    if (fast) {
      backward(data16, map.iw, map.ih, bw, 32, 2);
      // 2×2 复制
      for (let y = 0; y < bh; y += 2) {
        const row = y * bw;
        for (let x = 0; x < bw; x += 2) {
          const v = data16[row + x];
          data16[row + x + 1] = v;
          data16[row + bw + x] = v;
          data16[row + bw + x + 1] = v;
        }
      }
    } else {
      backward(data16, map.iw, map.ih, bw, 32, 1);
    }
    // 输出为有符号字节
    const out = new Int8Array(map.iw * map.ih);
    for (let y = 0; y < map.ih; y++) {
      const srcRow = y * bw;
      const dstRow = y * map.iw;
      for (let x = 0; x < map.iw; x++) {
        let v = (data16[srcRow + x] + IW_ROUND) >> IW_SHIFT;
        if (v < -128) v = -128;
        else if (v > 127) v = 127;
        out[dstRow + x] = v;
      }
    }
    return out;
  }
}

// ---------------------------------------------------------------------------
// IW44 解码入口（灰度单平面 / 彩色三平面，按 chunk 渐进）
// ---------------------------------------------------------------------------

export interface IW44Pixmap {
  width: number;
  height: number;
  // RGB 三元组，行 0 为图像顶行
  rgb: Uint8Array;
}

export class IW44Decoder {
  private yMap: IW44Map | null = null;
  private cbMap: IW44Map | null = null;
  private crMap: IW44Map | null = null;
  private yCodec: IW44Codec | null = null;
  private cbCodec: IW44Codec | null = null;
  private crCodec: IW44Codec | null = null;
  private isColor = false;
  private crcbDelay = 0;
  private crcbHalf = false;
  private cserial = 0;
  private cslice = 0;
  width = 0;
  height = 0;

  // 解码一个 chunk（BG44/FG44/TH44 的数据部分），返回已解码的 slice 总数
  decodeChunk(data: Uint8Array): number {
    let pos = 0;
    const serial = data[pos++];
    const slices = data[pos++];
    if (serial !== this.cserial) {
      throw new Error("IW44: wrong chunk serial number");
    }
    const nslices = this.cslice + slices;
    if (this.cserial === 0) {
      const major = data[pos++];
      const minor = data[pos++];
      if ((major & 0x7f) !== 1) {
        throw new Error("IW44: incompatible codec version");
      }
      if (minor > 2) {
        throw new Error("IW44: codec version too recent");
      }
      const xhi = data[pos++];
      const xlo = data[pos++];
      const yhi = data[pos++];
      const ylo = data[pos++];
      const w = (xhi << 8) | xlo;
      const h = (yhi << 8) | ylo;
      let delay = 0;
      let half = 0;
      if (minor >= 2) {
        const crcbdelay = data[pos++];
        delay = crcbdelay & 0x7f;
        half = crcbdelay & 0x80 ? 0 : 1;
      }
      this.isColor = (major & 0x80) === 0;
      this.crcbDelay = this.isColor ? delay : -1;
      this.crcbHalf = this.isColor && half === 1;
      if (w <= 0 || h <= 0) {
        throw new Error("IW44: bad image size");
      }
      this.width = w;
      this.height = h;
      this.yMap = new IW44Map(w, h);
      this.yCodec = new IW44Codec(this.yMap);
      if (this.isColor) {
        this.cbMap = new IW44Map(w, h);
        this.crMap = new IW44Map(w, h);
        this.cbCodec = new IW44Codec(this.cbMap);
        this.crCodec = new IW44Codec(this.crMap);
      }
    }
    if (!this.yCodec) {
      throw new Error("IW44: missing first chunk");
    }
    const zp = new ZPCodecDecoder(data.subarray(pos));
    let flag = 1;
    while (flag && this.cslice < nslices) {
      flag = this.yCodec.codeSlice(zp);
      if (
        this.crCodec &&
        this.cbCodec &&
        this.crcbDelay <= this.cslice
      ) {
        flag |= this.cbCodec.codeSlice(zp);
        flag |= this.crCodec.codeSlice(zp);
      }
      this.cslice += 1;
    }
    this.cserial += 1;
    return nslices;
  }

  // 是否已经完成所有 chunk（调用方每次 chunk 后重新渲染即可获得渐进效果）
  get isColorImage(): boolean {
    return this.isColor;
  }

  get sliceCount(): number {
    return this.cslice;
  }

  // 重建为灰度/彩色像素。
  // 注意：IW44 的像素行序为自下而上，这里翻转为左上原点，
  // 供页面合成与 canvas 使用。
  getPixmap(): IW44Pixmap | null {
    if (!this.yCodec || !this.yMap) return null;
    const w = this.yMap.iw;
    const h = this.yMap.ih;
    const y = this.yCodec.renderMap(false);
    const rgb = new Uint8Array(w * h * 3);
    const flipRow = (srcRow: number) => (h - 1 - srcRow) * w;
    if (this.isColor && this.cbCodec && this.crCodec && this.crcbDelay >= 0) {
      const cb = this.cbCodec.renderMap(this.crcbHalf);
      const cr = this.crCodec.renderMap(this.crcbHalf);
      for (let sy = 0; sy < h; sy++) {
        const dst = flipRow(sy);
        const srcRow = sy * w;
        for (let x = 0; x < w; x++) {
          const o = srcRow + x;
          const yv = y[o];
          const b = cb[o];
          const r = cr[o];
          // YCbCr → RGB（Appendix 1 的整数变换）
          const t1 = b >> 2;
          const t2 = r + (r >> 1);
          const t3 = yv + 128 - t1;
          let tr = yv + 128 + t2;
          let tg = t3 - (t2 >> 1);
          let tb = t3 + (b << 1);
          if (tr < 0) tr = 0;
          else if (tr > 255) tr = 255;
          if (tg < 0) tg = 0;
          else if (tg > 255) tg = 255;
          if (tb < 0) tb = 0;
          else if (tb > 255) tb = 255;
          const d = (dst + x) * 3;
          rgb[d] = tr;
          rgb[d + 1] = tg;
          rgb[d + 2] = tb;
        }
      }
    } else {
      for (let sy = 0; sy < h; sy++) {
        const dst = flipRow(sy);
        const srcRow = sy * w;
        for (let x = 0; x < w; x++) {
          const v = 127 - y[srcRow + x];
          const d = (dst + x) * 3;
          rgb[d] = v;
          rgb[d + 1] = v;
          rgb[d + 2] = v;
        }
      }
    }
    return { width: w, height: h, rgb };
  }

  // 原始 Y（亮度）平面（左上原点，已翻转为自上而下）
  getLumaPlane(): Int8Array | null {
    if (!this.yCodec || !this.yMap) return null;
    const w = this.yMap.iw;
    const h = this.yMap.ih;
    const src = this.yCodec.renderMap(false);
    const out = new Int8Array(w * h);
    for (let sy = 0; sy < h; sy++) {
      out.set(src.subarray(sy * w, sy * w + w), (h - 1 - sy) * w);
    }
    return out;
  }
}

// 便捷函数：解码完整的单 chunk IW44 数据（TH44 缩略图等）
export const decodeIW44 = (data: Uint8Array): IW44Pixmap | null => {
  const decoder = new IW44Decoder();
  decoder.decodeChunk(data);
  return decoder.getPixmap();
};
