// BZZ 通用解压（Burrows-Wheeler + 自适应 MTF + ZP 算术编码）。
// 规范 Appendix 4（§13）：
//   - 每个块：24 位块大小（直通模式）→ 2 位 FSHIFT → MTF 编号序列 → 逆 BWT
//   - MTF 数组每个块重置，算术编码上下文跨块保留
//   - 块大小 0 表示流结束；每个块输出 size-1 字节（末尾为 <EOB> 记号）
import { ZPCodecDecoder } from "./zpcodec";

const FREQMAX = 4;
const CTXIDS = 3;
const MAXBLOCK = 4096;

// 块大小字段：直通模式读取 bits 位（大端序）
const decodeRaw = (zp: ZPCodecDecoder, bits: number): number => {
  const m = 1 << bits;
  let n = 1;
  while (n < m) {
    n = (n << 1) | zp.decodePassthrough();
  }
  return n - m;
};

// decode_binary：以一棵完整的二叉树上下文编码 bits 位
const decodeBinary = (
  zp: ZPCodecDecoder,
  ctx: Uint8Array,
  base: number,
  bits: number
): number => {
  const m = 1 << bits;
  const p = base - 1;
  let n = 1;
  while (n < m) {
    n = (n << 1) | zp.decode(ctx, p + n);
  }
  return n - m;
};

export const bzzDecode = (data: Uint8Array): Uint8Array => {
  const zp = new ZPCodecDecoder(data);
  const ctx = new Uint8Array(300);
  const blocks: Uint8Array[] = [];
  let total = 0;

  for (;;) {
    const size = decodeRaw(zp, 24);
    if (!size) break;
    if (size > MAXBLOCK * 1024) {
      throw new Error("BZZ: corrupt block size");
    }
    // 估计速度 FSHIFT ∈ {0, 1, 2}
    let fshift = 0;
    if (zp.decodePassthrough()) {
      fshift += 1;
      if (zp.decodePassthrough()) fshift += 1;
    }
    // 准 MTF 数组与频率估计（每块重置）
    const buffer = new Uint8Array(size);
    const mtf = new Uint8Array(256);
    for (let i = 0; i < 256; i++) mtf[i] = i;
    const freq = new Uint32Array(FREQMAX);
    let fadd = 4;
    let mtfno = 3;
    let markerpos = -1;

    for (let i = 0; i < size; i++) {
      let ctxid = CTXIDS - 1;
      if (ctxid > mtfno) ctxid = mtfno;
      if (zp.decode(ctx, ctxid)) {
        mtfno = 0;
      } else if (zp.decode(ctx, CTXIDS + ctxid)) {
        mtfno = 1;
      } else if (zp.decode(ctx, 2 * CTXIDS)) {
        mtfno = 2 + decodeBinary(zp, ctx, 2 * CTXIDS + 1, 1);
      } else if (zp.decode(ctx, 8)) {
        mtfno = 4 + decodeBinary(zp, ctx, 9, 2);
      } else if (zp.decode(ctx, 12)) {
        mtfno = 8 + decodeBinary(zp, ctx, 13, 3);
      } else if (zp.decode(ctx, 20)) {
        mtfno = 16 + decodeBinary(zp, ctx, 21, 4);
      } else if (zp.decode(ctx, 36)) {
        mtfno = 32 + decodeBinary(zp, ctx, 37, 5);
      } else if (zp.decode(ctx, 68)) {
        mtfno = 64 + decodeBinary(zp, ctx, 69, 6);
      } else if (zp.decode(ctx, 132)) {
        mtfno = 128 + decodeBinary(zp, ctx, 133, 7);
      } else {
        // <EOB> 记号
        mtfno = 256;
        buffer[i] = 0;
        markerpos = i;
        continue;
      }
      buffer[i] = mtf[mtfno];
      // 按预测频率旋转 MTF 数组
      fadd = fadd + (fadd >> fshift);
      if (fadd > 0x10000000) {
        fadd >>>= 24;
        for (let k = 0; k < FREQMAX; k++) freq[k] >>>= 24;
      }
      let fc = fadd;
      if (mtfno < FREQMAX) fc += freq[mtfno];
      let k = mtfno;
      for (; k >= FREQMAX; k--) mtf[k] = mtf[k - 1];
      for (; k > 0 && fc >= freq[k - 1]; k--) {
        mtf[k] = mtf[k - 1];
        freq[k] = freq[k - 1];
      }
      mtf[k] = buffer[i];
      freq[k] = fc;
    }

    // 逆 Burrows-Wheeler 变换
    if (markerpos < 1 || markerpos >= size) {
      throw new Error("BZZ: corrupt stream (marker)");
    }
    const posn = new Uint32Array(size);
    const count = new Int32Array(256);
    for (let i = 0; i < markerpos; i++) {
      const c = buffer[i];
      posn[i] = (c << 24) | (count[c] & 0xffffff);
      count[c] += 1;
    }
    for (let i = markerpos + 1; i < size; i++) {
      const c = buffer[i];
      posn[i] = (c << 24) | (count[c] & 0xffffff);
      count[c] += 1;
    }
    let last = 1;
    for (let i = 0; i < 256; i++) {
      const tmp = count[i];
      count[i] = last;
      last += tmp;
    }
    let i = 0;
    last = size - 1;
    while (last > 0) {
      const n = posn[i];
      const c = posn[i] >>> 24;
      buffer[--last] = c;
      i = count[c] + (n & 0xffffff);
    }
    if (i !== markerpos) {
      throw new Error("BZZ: corrupt stream (bwt)");
    }
    blocks.push(buffer.subarray(0, size - 1));
    total += size - 1;
  }

  const output = new Uint8Array(total);
  let offset = 0;
  for (const block of blocks) {
    output.set(block, offset);
    offset += block.length;
  }
  return output;
};
