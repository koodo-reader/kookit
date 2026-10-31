// ZP'-Coder（ZP 自适应二进制算术解码器）与多值整数解码（NumContext）。
// 规范 Appendix 3（§12）：
//   - 256 项概率状态表 {p, m, up, dn}（默认表，不做非兼容模式的 dn 修正）
//   - decoder(ctx)：fence 快速路径 + 完整解码（含区间反转保护 d = 0x6000 + (z+a)>>2）
//   - 直通模式 A：0x8000 + (a>>1)（BZZ 的估计速度与块大小字段使用）
//   - 直通模式 B：0x8000 + ((a+a+a)>>3)（IW44 的符号与尾数位使用）
//   - 多值扩展 Phase 1-4 见 Appendix 2（§11.2 数字编码）
// 数据读尽后按 0xff 补齐（规范：缺失位视为 1），连续 25 字节后报错。

/* eslint-disable */
const ZP_TABLE = new Uint16Array([
  0x8000, 0x0000, 84, 145,
  0x8000, 0x0000, 3, 4,
  0x8000, 0x0000, 4, 3,
  0x6bbd, 0x10a5, 5, 1,
  0x6bbd, 0x10a5, 6, 2,
  0x5d45, 0x1f28, 7, 3,
  0x5d45, 0x1f28, 8, 4,
  0x51b9, 0x2bd3, 9, 5,
  0x51b9, 0x2bd3, 10, 6,
  0x4813, 0x36e3, 11, 7,
  0x4813, 0x36e3, 12, 8,
  0x3fd5, 0x408c, 13, 9,
  0x3fd5, 0x408c, 14, 10,
  0x38b1, 0x48fd, 15, 11,
  0x38b1, 0x48fd, 16, 12,
  0x3275, 0x505d, 17, 13,
  0x3275, 0x505d, 18, 14,
  0x2cfd, 0x56d0, 19, 15,
  0x2cfd, 0x56d0, 20, 16,
  0x2825, 0x5c71, 21, 17,
  0x2825, 0x5c71, 22, 18,
  0x23ab, 0x615b, 23, 19,
  0x23ab, 0x615b, 24, 20,
  0x1f87, 0x65a5, 25, 21,
  0x1f87, 0x65a5, 26, 22,
  0x1bbb, 0x6962, 27, 23,
  0x1bbb, 0x6962, 28, 24,
  0x1845, 0x6ca2, 29, 25,
  0x1845, 0x6ca2, 30, 26,
  0x1523, 0x6f74, 31, 27,
  0x1523, 0x6f74, 32, 28,
  0x1253, 0x71e6, 33, 29,
  0x1253, 0x71e6, 34, 30,
  0x0fcf, 0x7404, 35, 31,
  0x0fcf, 0x7404, 36, 32,
  0x0d95, 0x75d6, 37, 33,
  0x0d95, 0x75d6, 38, 34,
  0x0b9d, 0x7768, 39, 35,
  0x0b9d, 0x7768, 40, 36,
  0x09e3, 0x78c2, 41, 37,
  0x09e3, 0x78c2, 42, 38,
  0x0861, 0x79ea, 43, 39,
  0x0861, 0x79ea, 44, 40,
  0x0711, 0x7ae7, 45, 41,
  0x0711, 0x7ae7, 46, 42,
  0x05f1, 0x7bbe, 47, 43,
  0x05f1, 0x7bbe, 48, 44,
  0x04f9, 0x7c75, 49, 45,
  0x04f9, 0x7c75, 50, 46,
  0x0425, 0x7d0f, 51, 47,
  0x0425, 0x7d0f, 52, 48,
  0x0371, 0x7d91, 53, 49,
  0x0371, 0x7d91, 54, 50,
  0x02d9, 0x7dfe, 55, 51,
  0x02d9, 0x7dfe, 56, 52,
  0x0259, 0x7e5a, 57, 53,
  0x0259, 0x7e5a, 58, 54,
  0x01ed, 0x7ea6, 59, 55,
  0x01ed, 0x7ea6, 60, 56,
  0x0193, 0x7ee6, 61, 57,
  0x0193, 0x7ee6, 62, 58,
  0x0149, 0x7f1a, 63, 59,
  0x0149, 0x7f1a, 64, 60,
  0x010b, 0x7f45, 65, 61,
  0x010b, 0x7f45, 66, 62,
  0x00d5, 0x7f6b, 67, 63,
  0x00d5, 0x7f6b, 68, 64,
  0x00a5, 0x7f8d, 69, 65,
  0x00a5, 0x7f8d, 70, 66,
  0x007b, 0x7faa, 71, 67,
  0x007b, 0x7faa, 72, 68,
  0x0057, 0x7fc3, 73, 69,
  0x0057, 0x7fc3, 74, 70,
  0x003b, 0x7fd7, 75, 71,
  0x003b, 0x7fd7, 76, 72,
  0x0023, 0x7fe7, 77, 73,
  0x0023, 0x7fe7, 78, 74,
  0x0013, 0x7ff2, 79, 75,
  0x0013, 0x7ff2, 80, 76,
  0x0007, 0x7ffa, 81, 77,
  0x0007, 0x7ffa, 82, 78,
  0x0001, 0x7fff, 81, 79,
  0x0001, 0x7fff, 82, 80,
  0x5695, 0x0000, 9, 85,
  0x24ee, 0x0000, 86, 226,
  0x8000, 0x0000, 5, 6,
  0x0d30, 0x0000, 88, 176,
  0x481a, 0x0000, 89, 143,
  0x0481, 0x0000, 90, 138,
  0x3579, 0x0000, 91, 141,
  0x017a, 0x0000, 92, 112,
  0x24ef, 0x0000, 93, 135,
  0x007b, 0x0000, 94, 104,
  0x1978, 0x0000, 95, 133,
  0x0028, 0x0000, 96, 100,
  0x10ca, 0x0000, 97, 129,
  0x000d, 0x0000, 82, 98,
  0x0b5d, 0x0000, 99, 127,
  0x0034, 0x0000, 76, 72,
  0x078a, 0x0000, 101, 125,
  0x00a0, 0x0000, 70, 102,
  0x050f, 0x0000, 103, 123,
  0x0117, 0x0000, 66, 60,
  0x0358, 0x0000, 105, 121,
  0x01ea, 0x0000, 106, 110,
  0x0234, 0x0000, 107, 119,
  0x0144, 0x0000, 66, 108,
  0x0173, 0x0000, 109, 117,
  0x0234, 0x0000, 60, 54,
  0x00f5, 0x0000, 111, 115,
  0x0353, 0x0000, 56, 48,
  0x00a1, 0x0000, 69, 113,
  0x05c5, 0x0000, 114, 134,
  0x011a, 0x0000, 65, 59,
  0x03cf, 0x0000, 116, 132,
  0x01aa, 0x0000, 61, 55,
  0x0285, 0x0000, 118, 130,
  0x0286, 0x0000, 57, 51,
  0x01ab, 0x0000, 120, 128,
  0x03d3, 0x0000, 53, 47,
  0x011a, 0x0000, 122, 126,
  0x05c5, 0x0000, 49, 41,
  0x00ba, 0x0000, 124, 62,
  0x08ad, 0x0000, 43, 37,
  0x007a, 0x0000, 72, 66,
  0x0ccc, 0x0000, 39, 31,
  0x01eb, 0x0000, 60, 54,
  0x1302, 0x0000, 33, 25,
  0x02e6, 0x0000, 56, 50,
  0x1b81, 0x0000, 29, 131,
  0x045e, 0x0000, 52, 46,
  0x24ef, 0x0000, 23, 17,
  0x0690, 0x0000, 48, 40,
  0x2865, 0x0000, 23, 15,
  0x09de, 0x0000, 42, 136,
  0x3987, 0x0000, 137, 7,
  0x0dc8, 0x0000, 38, 32,
  0x2c99, 0x0000, 21, 139,
  0x10ca, 0x0000, 140, 172,
  0x3b5f, 0x0000, 15, 9,
  0x0b5d, 0x0000, 142, 170,
  0x5695, 0x0000, 9, 85,
  0x078a, 0x0000, 144, 168,
  0x8000, 0x0000, 141, 248,
  0x050f, 0x0000, 146, 166,
  0x24ee, 0x0000, 147, 247,
  0x0358, 0x0000, 148, 164,
  0x0d30, 0x0000, 149, 197,
  0x0234, 0x0000, 150, 162,
  0x0481, 0x0000, 151, 95,
  0x0173, 0x0000, 152, 160,
  0x017a, 0x0000, 153, 173,
  0x00f5, 0x0000, 154, 158,
  0x007b, 0x0000, 155, 165,
  0x00a1, 0x0000, 70, 156,
  0x0028, 0x0000, 157, 161,
  0x011a, 0x0000, 66, 60,
  0x000d, 0x0000, 81, 159,
  0x01aa, 0x0000, 62, 56,
  0x0034, 0x0000, 75, 71,
  0x0286, 0x0000, 58, 52,
  0x00a0, 0x0000, 69, 163,
  0x03d3, 0x0000, 54, 48,
  0x0117, 0x0000, 65, 59,
  0x05c5, 0x0000, 50, 42,
  0x01ea, 0x0000, 167, 171,
  0x08ad, 0x0000, 44, 38,
  0x0144, 0x0000, 65, 169,
  0x0ccc, 0x0000, 40, 32,
  0x0234, 0x0000, 59, 53,
  0x1302, 0x0000, 34, 26,
  0x0353, 0x0000, 55, 47,
  0x1b81, 0x0000, 30, 174,
  0x05c5, 0x0000, 175, 193,
  0x24ef, 0x0000, 24, 18,
  0x03cf, 0x0000, 177, 191,
  0x2b74, 0x0000, 178, 222,
  0x0285, 0x0000, 179, 189,
  0x201d, 0x0000, 180, 218,
  0x01ab, 0x0000, 181, 187,
  0x1715, 0x0000, 182, 216,
  0x011a, 0x0000, 183, 185,
  0x0fb7, 0x0000, 184, 214,
  0x00ba, 0x0000, 69, 61,
  0x0a67, 0x0000, 186, 212,
  0x01eb, 0x0000, 59, 53,
  0x06e7, 0x0000, 188, 210,
  0x02e6, 0x0000, 55, 49,
  0x0496, 0x0000, 190, 208,
  0x045e, 0x0000, 51, 45,
  0x030d, 0x0000, 192, 206,
  0x0690, 0x0000, 47, 39,
  0x0206, 0x0000, 194, 204,
  0x09de, 0x0000, 41, 195,
  0x0155, 0x0000, 196, 202,
  0x0dc8, 0x0000, 37, 31,
  0x00e1, 0x0000, 198, 200,
  0x2b74, 0x0000, 199, 243,
  0x0094, 0x0000, 72, 64,
  0x201d, 0x0000, 201, 239,
  0x0188, 0x0000, 62, 56,
  0x1715, 0x0000, 203, 237,
  0x0252, 0x0000, 58, 52,
  0x0fb7, 0x0000, 205, 235,
  0x0383, 0x0000, 54, 48,
  0x0a67, 0x0000, 207, 233,
  0x0547, 0x0000, 50, 44,
  0x06e7, 0x0000, 209, 231,
  0x07e2, 0x0000, 46, 38,
  0x0496, 0x0000, 211, 229,
  0x0bc0, 0x0000, 40, 34,
  0x030d, 0x0000, 213, 227,
  0x1178, 0x0000, 36, 28,
  0x0206, 0x0000, 215, 225,
  0x19da, 0x0000, 30, 22,
  0x0155, 0x0000, 217, 223,
  0x24ef, 0x0000, 26, 16,
  0x00e1, 0x0000, 219, 221,
  0x320e, 0x0000, 20, 220,
  0x0094, 0x0000, 71, 63,
  0x432a, 0x0000, 14, 8,
  0x0188, 0x0000, 61, 55,
  0x447d, 0x0000, 14, 224,
  0x0252, 0x0000, 57, 51,
  0x5ece, 0x0000, 8, 2,
  0x0383, 0x0000, 53, 47,
  0x8000, 0x0000, 228, 87,
  0x0547, 0x0000, 49, 43,
  0x481a, 0x0000, 230, 246,
  0x07e2, 0x0000, 45, 37,
  0x3579, 0x0000, 232, 244,
  0x0bc0, 0x0000, 39, 33,
  0x24ef, 0x0000, 234, 238,
  0x1178, 0x0000, 35, 27,
  0x1978, 0x0000, 138, 236,
  0x19da, 0x0000, 29, 21,
  0x2865, 0x0000, 24, 16,
  0x24ef, 0x0000, 25, 15,
  0x3987, 0x0000, 240, 8,
  0x320e, 0x0000, 19, 241,
  0x2c99, 0x0000, 22, 242,
  0x432a, 0x0000, 13, 7,
  0x3b5f, 0x0000, 16, 10,
  0x447d, 0x0000, 13, 245,
  0x5695, 0x0000, 10, 2,
  0x5ece, 0x0000, 7, 1,
  0x8000, 0x0000, 244, 83,
  0x8000, 0x0000, 249, 250,
  0x5695, 0x0000, 10, 2,
  0x481a, 0x0000, 89, 143,
  0x481a, 0x0000, 230, 246,
]);

const ZP_P = new Uint16Array(256);
const ZP_M = new Uint16Array(256);
const ZP_UP = new Uint8Array(256);
const ZP_DN = new Uint8Array(256);
for (let i = 0; i < 251; i++) {
  ZP_P[i] = ZP_TABLE[i * 4];
  ZP_M[i] = ZP_TABLE[i * 4 + 1];
  ZP_UP[i] = ZP_TABLE[i * 4 + 2];
  ZP_DN[i] = ZP_TABLE[i * 4 + 3];
}

// ffzt[i] = 8 位整数 i 从最高位开始连续 1 的个数
const FFZT = new Uint8Array(256);
for (let i = 0; i < 256; i++) {
  let n = 0;
  for (let j = i; j & 0x80; j <<= 1) n++;
  FFZT[i] = n;
}

// ffz：前导 1 的个数（移位重归一化长度，规范附录 3 的 A 重归一化）
const ffz = (x: number): number =>
  x >= 0xff00 ? FFZT[x & 0xff] + 8 : FFZT[(x >> 8) & 0xff];

// 一个上下文只用 1 个字节保存概率状态索引（即表中的下标），
// 因此所有上下文都可以放在 Uint8Array 里按 (数组, 下标) 传引用。
export class ZPCodecDecoder {
  private data: Uint8Array;
  private pos: number;
  private a: number;
  private code: number;
  private buffer: number;
  private scount: number;
  private delay: number;
  private fence: number;

  constructor(data: Uint8Array) {
    this.data = data;
    this.pos = 0;
    this.a = 0;
    this.buffer = 0;
    this.scount = 0;
    this.delay = 25;
    // 读入最初 16 位
    let byte = this.pos < data.length ? data[this.pos++] : 0xff;
    this.code = byte << 8;
    byte = this.pos < data.length ? data[this.pos++] : 0xff;
    this.code |= byte;
    this.preload();
    this.fence = this.code >= 0x8000 ? 0x7fff : this.code;
  }

  private preload(): void {
    while (this.scount <= 24) {
      let byte: number;
      if (this.pos < this.data.length) {
        byte = this.data[this.pos++];
      } else {
        byte = 0xff;
        this.delay -= 1;
        if (this.delay < 1) {
          throw new Error("ZPCodec: unexpected end of data");
        }
      }
      this.buffer = ((this.buffer << 8) | byte) >>> 0;
      this.scount += 8;
    }
  }

  // 解码一个二进制决策（context 状态存于 states[index]）
  decode(states: Uint8Array, index: number): number {
    const ctx = states[index];
    const z = this.a + ZP_P[ctx];
    if (z <= this.fence) {
      // 快速路径：必定落在 MPS 一侧且无需重归一化
      this.a = z;
      return ctx & 1;
    }
    return this.decodeSub(states, index, ctx, z);
  }

  private decodeSub(
    states: Uint8Array,
    index: number,
    ctx: number,
    zIn: number
  ): number {
    const bit = ctx & 1;
    let z = zIn;
    // Avoid interval reversion
    const d = 0x6000 + ((z + this.a) >> 2);
    if (z > d) z = d;
    if (z > this.code) {
      // LPS 分支
      z = 0x10000 - z;
      this.a = this.a + z;
      this.code = this.code + z;
      states[index] = ZP_DN[ctx];
      const shift = ffz(this.a);
      this.scount -= shift;
      this.a = (this.a << shift) & 0xffff;
      this.code =
        ((this.code << shift) & 0xffff) |
        ((this.buffer >>> this.scount) & ((1 << shift) - 1));
      if (this.scount < 16) this.preload();
      this.fence = this.code >= 0x8000 ? 0x7fff : this.code;
      return bit ^ 1;
    } else {
      // MPS 分支
      if (this.a >= ZP_M[ctx]) states[index] = ZP_UP[ctx];
      this.scount -= 1;
      this.a = (z << 1) & 0xffff;
      this.code =
        ((this.code << 1) & 0xffff) | ((this.buffer >>> this.scount) & 1);
      if (this.scount < 16) this.preload();
      this.fence = this.code >= 0x8000 ? 0x7fff : this.code;
      return bit;
    }
  }

  // 无上下文直通解码（decode_sub_simple，使用 ZPCODER 的区间反转保护关闭）
  private decodeSimple(mps: number, zIn: number): number {
    let z = zIn;
    if (z > this.code) {
      z = 0x10000 - z;
      this.a = this.a + z;
      this.code = this.code + z;
      const shift = ffz(this.a);
      this.scount -= shift;
      this.a = (this.a << shift) & 0xffff;
      this.code =
        ((this.code << shift) & 0xffff) |
        ((this.buffer >>> this.scount) & ((1 << shift) - 1));
      if (this.scount < 16) this.preload();
      this.fence = this.code >= 0x8000 ? 0x7fff : this.code;
      return mps ^ 1;
    } else {
      this.scount -= 1;
      this.a = (z << 1) & 0xffff;
      this.code =
        ((this.code << 1) & 0xffff) | ((this.buffer >>> this.scount) & 1);
      if (this.scount < 16) this.preload();
      this.fence = this.code >= 0x8000 ? 0x7fff : this.code;
      return mps;
    }
  }

  // 直通模式 A（BZZ 的块大小与估计速度位）
  decodePassthrough(): number {
    return this.decodeSimple(0, 0x8000 + (this.a >> 1));
  }

  // 直通模式 B（IW44 的符号位与尾数位）
  decodeIW(): number {
    return this.decodeSimple(0, 0x8000 + ((this.a + this.a + this.a) >> 3));
  }
}

