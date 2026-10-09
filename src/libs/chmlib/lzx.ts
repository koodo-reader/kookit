/**
 * LZX decompression engine.
 * Port of lzx.c from chmlib by Jed Wing (originally from cabextract by Stuart Caie).
 *
 * LZX is a variant of LZ77 with Huffman coding, used inside CHM files.
 */

// LZX constants
const LZX_MIN_MATCH                = 2;
const LZX_NUM_CHARS                = 256;
const LZX_BLOCKTYPE_VERBATIM       = 1;
const LZX_BLOCKTYPE_ALIGNED        = 2;
const LZX_BLOCKTYPE_UNCOMPRESSED   = 3;
const LZX_PRETREE_NUM_ELEMENTS     = 20;
const LZX_NUM_PRIMARY_LENGTHS      = 7;
const LZX_NUM_SECONDARY_LENGTHS    = 249;

// Huffman table sizes
const LZX_PRETREE_TABLEBITS        = 6;
const LZX_PRETREE_MAXSYMBOLS      = LZX_PRETREE_NUM_ELEMENTS;
const LZX_MAINTREE_TABLEBITS      = 12;
const LZX_MAINTREE_MAXSYMBOLS     = LZX_NUM_CHARS + 50 * 8;
const LZX_LENGTH_TABLEBITS        = 12;
const LZX_LENGTH_MAXSYMBOLS       = LZX_NUM_SECONDARY_LENGTHS + 1;
const LZX_ALIGNED_TABLEBITS       = 7;
const LZX_ALIGNED_MAXSYMBOLS      = 8;
const LZX_LENTABLE_SAFETY         = 64;

// ULONG_BITS: 32 for the bitbuf
const ULONG_BITS = 32;

// Position slots: extra bits and base positions
const EXTRA_BITS = new Uint8Array([
    0,  0,  0,  0,  1,  1,  2,  2,  3,  3,  4,  4,  5,  5,  6,  6,
    7,  7,  8,  8,  9,  9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14,
   15, 15, 16, 16, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17,
   17, 17, 17,
]);

const POSITION_BASE = new Uint32Array([
          0,       1,       2,       3,       4,       6,       8,      12,      16,      24,      32,      48,
         64,      96,     128,     192,     256,     384,     512,     768,    1024,    1536,    2048,    3072,
       4096,    6144,    8192,   12288,   16384,   24576,   32768,   49152,   65536,   98304,  131072,  196608,
     262144,  393216,  524288,  655360,  786432,  917504, 1048576, 1179648, 1310720, 1441792, 1572864, 1703936,
    1835008, 1966080, 2097152,
]);

/** Build a Huffman decode table from code lengths. Returns 0 on success, 1 on error. */
function makeDecodeTable(
  nsyms: number,
  nbits: number,
  length: Uint8Array,
  table: Uint16Array,
): number {
  let leaf: number;
  let bitNum = 1;
  let pos = 0;
  let tableMask = 1 << nbits;
  let bitMask = tableMask >> 1;
  let nextSymbol = bitMask;

  // Fill entries for codes short enough for direct mapping
  while (bitNum <= nbits) {
    for (let sym = 0; sym < nsyms; sym++) {
      if (length[sym] === bitNum) {
        leaf = pos;
        if ((pos += bitMask) > tableMask) return 1; // table overrun
        let fill = bitMask;
        while (fill-- > 0) table[leaf++] = sym;
      }
    }
    bitMask >>= 1;
    bitNum++;
  }

  if (pos !== tableMask) {
    // Clear remainder of table
    for (let sym = pos; sym < tableMask; sym++) table[sym] = 0;

    // Room for codes up to 16 more bits — shift pos AND tableMask
    // (safe: nbits ≤ 12 so tableMask ≤ 2^28 after shift, fits in int32)
    pos <<= 16;
    tableMask <<= 16;
    bitMask = 1 << 15;

    while (bitNum <= 16) {
      for (let sym = 0; sym < nsyms; sym++) {
        if (length[sym] === bitNum) {
          leaf = pos >> 16;
          for (let fill = 0; fill < bitNum - nbits; fill++) {
            if (table[leaf] === 0) {
              table[nextSymbol << 1] = 0;
              table[(nextSymbol << 1) + 1] = 0;
              table[leaf] = nextSymbol++;
            }
            leaf = table[leaf] << 1;
            if ((pos >> (15 - fill)) & 1) leaf++;
          }
          table[leaf] = sym;
          if ((pos += bitMask) > tableMask) return 1;
        }
      }
      bitMask >>= 1;
      bitNum++;
    }
  }

  if (pos === tableMask) return 0;

  for (let sym = 0; sym < nsyms; sym++) if (length[sym]) return 1;
  return 0;
}

export class LZXState {
  window: Uint8Array;
  windowSize: number;
  actualSize: number;
  windowPosn: number;
  R0: number;
  R1: number;
  R2: number;
  mainElements: number;
  headerRead: boolean;
  blockType: number;
  blockLength: number;
  blockRemaining: number;
  framesRead: number;
  intelFilesize: number;
  intelCurpos: number;
  intelStarted: boolean;

  // Huffman tables
  PRETREE_table: Uint16Array;
  PRETREE_len: Uint8Array;
  MAINTREE_table: Uint16Array;
  MAINTREE_len: Uint8Array;
  LENGTH_table: Uint16Array;
  LENGTH_len: Uint8Array;
  ALIGNED_table: Uint16Array;
  ALIGNED_len: Uint8Array;

  constructor(windowBits: number) {
    if (windowBits < 15 || windowBits > 21)
      throw new RangeError(`LZXState: invalid window size bits ${windowBits} (must be 15-21)`);

    const wndsize = 1 << windowBits;

    let posnSlots: number;
    if (windowBits === 20) posnSlots = 42;
    else if (windowBits === 21) posnSlots = 50;
    else posnSlots = windowBits << 1;

    this.window = new Uint8Array(wndsize);
    this.windowSize = wndsize;
    this.actualSize = wndsize;
    this.windowPosn = 0;
    this.R0 = this.R1 = this.R2 = 1;
    this.mainElements = LZX_NUM_CHARS + (posnSlots << 3);
    this.headerRead = false;
    this.framesRead = 0;
    this.blockRemaining = 0;
    this.blockType = 0; // LZX_BLOCKTYPE_INVALID
    this.blockLength = 0;
    this.intelCurpos = 0;
    this.intelStarted = false;
    this.intelFilesize = 0;

    // Allocate Huffman tables
    this.PRETREE_table = new Uint16Array((1 << LZX_PRETREE_TABLEBITS) + (LZX_PRETREE_MAXSYMBOLS << 1));
    this.PRETREE_len = new Uint8Array(LZX_PRETREE_MAXSYMBOLS + LZX_LENTABLE_SAFETY);
    this.MAINTREE_table = new Uint16Array((1 << LZX_MAINTREE_TABLEBITS) + (LZX_MAINTREE_MAXSYMBOLS << 1));
    this.MAINTREE_len = new Uint8Array(LZX_MAINTREE_MAXSYMBOLS + LZX_LENTABLE_SAFETY);
    this.LENGTH_table = new Uint16Array((1 << LZX_LENGTH_TABLEBITS) + (LZX_LENGTH_MAXSYMBOLS << 1));
    this.LENGTH_len = new Uint8Array(LZX_LENGTH_MAXSYMBOLS + LZX_LENTABLE_SAFETY);
    this.ALIGNED_table = new Uint16Array((1 << LZX_ALIGNED_TABLEBITS) + (LZX_ALIGNED_MAXSYMBOLS << 1));
    this.ALIGNED_len = new Uint8Array(LZX_ALIGNED_MAXSYMBOLS + LZX_LENTABLE_SAFETY);
  }

  reset(): void {
    this.R0 = this.R1 = this.R2 = 1;
    this.headerRead = false;
    this.framesRead = 0;
    this.blockRemaining = 0;
    this.blockType = 0; // LZX_BLOCKTYPE_INVALID
    this.intelCurpos = 0;
    this.intelStarted = false;
    this.windowPosn = 0;
    this.MAINTREE_len.fill(0);
    this.LENGTH_len.fill(0);
  }
}

export const DECR_OK = 0;
export const DECR_DATAFORMAT = 1;
export const DECR_ILLEGALDATA = 2;

/** Decompress one LZX block. Returns DECR_OK on success. */
export function lzxDecompress(
  state: LZXState,
  inData: Uint8Array,
  outData: Uint8Array,
  inLen: number,
  outLen: number,
): number {
  const window = state.window;
  const windowSize = state.windowSize;

  let windowPosn = state.windowPosn;
  let R0 = state.R0;
  let R1 = state.R1;
  let R2 = state.R2;

  // Bitstream state — 32-bit ULONG bitbuf (matches C: sizeof(ULONG)*8 = 32)
  let bitbuf = 0;       // ULONG: 32-bit unsigned
  let bitsleft = 0;
  let inpos = 0;
  const endinp = inLen;

  // ENSURE_BITS(n): ensures at least n bits in bitbuf
  // bitbuf is filled from MSB, 16 bits at a time (little-endian word order)
  function ensureBits(n: number): void {
    while (bitsleft < n) {
      const lo = inpos < inLen ? inData[inpos] : 0;
      const hi = inpos + 1 < inLen ? inData[inpos + 1] : 0;
      // bitbuf |= word << (ULONG_BITS - 16 - bitsleft)
      bitbuf = (bitbuf | (((hi << 8) | lo) << (ULONG_BITS - 16 - bitsleft))) >>> 0;
      bitsleft += 16;
      inpos += 2;
    }
  }

  // PEEK_BITS(n): extract top n bits without removing them
  function peekBits(n: number): number {
    return (bitbuf >>> (ULONG_BITS - n)) >>> 0;
  }

  // REMOVE_BITS(n): remove top n bits
  function removeBits(n: number): void {
    bitbuf = (bitbuf << n) >>> 0;
    bitsleft -= n;
  }

  // READ_BITS(n): read and consume n bits
  function readBits(n: number): number {
    ensureBits(n);
    const v = peekBits(n);
    removeBits(n);
    return v;
  }

  // READ_HUFFSYM: decode one Huffman symbol from the stream
  function readHuffSym(table: Uint16Array, len: Uint8Array, tablebits: number, maxsyms: number): number {
    ensureBits(16);
    let i = table[peekBits(tablebits)];
    if (i >= maxsyms) {
      let j = 1 << (ULONG_BITS - tablebits);
      do {
        j >>>= 1;
        i <<= 1;
        i |= (bitbuf & j) ? 1 : 0;
        if (!j) return -1; // DECR_ILLEGALDATA
        i = table[i];
      } while (i >= maxsyms);
    }
    const bits = len[i];
    removeBits(bits);
    return i;
  }

  // READ_LENGTHS(tbl, first, last): read code lengths for table entries [first..last)
  // IMPORTANT: pretree lengths go into state.PRETREE_len, NOT into the target lens array.
  function readLengths(lens: Uint8Array, first: number, last: number): boolean {
    // Read 20 4-bit values into PRETREE_len (not into lens!)
    for (let x = 0; x < 20; x++) {
      state.PRETREE_len[x] = readBits(4);
    }

    // Build pretree decode table
    if (makeDecodeTable(LZX_PRETREE_MAXSYMBOLS, LZX_PRETREE_TABLEBITS, state.PRETREE_len, state.PRETREE_table))
      return true; // error

    // Use pretree to decode delta lengths for [first..last)
    let x = first;
    while (x < last) {
      const z = readHuffSym(state.PRETREE_table, state.PRETREE_len, LZX_PRETREE_TABLEBITS, LZX_PRETREE_MAXSYMBOLS);
      if (z < 0) return true;

      if (z === 17) {
        let y = readBits(4) + 4;
        while (y-- > 0) lens[x++] = 0;
      } else if (z === 18) {
        let y = readBits(5) + 20;
        while (y-- > 0) lens[x++] = 0;
      } else if (z === 19) {
        let y = readBits(1) + 4;
        const zz = readHuffSym(state.PRETREE_table, state.PRETREE_len, LZX_PRETREE_TABLEBITS, LZX_PRETREE_MAXSYMBOLS);
        if (zz < 0) return true;
        let val = lens[x] - zz;
        if (val < 0) val += 17;
        while (y-- > 0) lens[x++] = val;
      } else {
        // z is a delta: new_len = (old_len - z + 17) % 17
        let val = lens[x] - z;
        if (val < 0) val += 17;
        lens[x++] = val;
      }
    }
    return false;
  }

  let togo = outLen;

  // Read header if necessary (only on first call per stream)
  if (!state.headerRead) {
    let i = 0;
    let j = 0;
    const k = readBits(1);
    if (k) {
      i = readBits(16);
      j = readBits(16);
    }
    state.intelFilesize = (i << 16) | j;
    state.headerRead = true;
  }

  // Main decoding loop
  while (togo > 0) {
    // Start a new block if current one is exhausted
    if (state.blockRemaining === 0) {
      if (state.blockType === LZX_BLOCKTYPE_UNCOMPRESSED) {
        if (state.blockLength & 1) inpos++; // realign to word boundary
        // Re-initialize bitstream after uncompressed block
        bitsleft = 0;
        bitbuf = 0;
      }

      state.blockType = readBits(3);
      const i16 = readBits(16);
      const j8 = readBits(8);
      state.blockRemaining = state.blockLength = (i16 << 8) | j8;

      switch (state.blockType) {
        case LZX_BLOCKTYPE_ALIGNED:
          // Read aligned offset tree (8 symbols, 3-bit lengths)
          for (let i = 0; i < 8; i++) {
            state.ALIGNED_len[i] = readBits(3);
          }
          if (makeDecodeTable(LZX_ALIGNED_MAXSYMBOLS, LZX_ALIGNED_TABLEBITS, state.ALIGNED_len, state.ALIGNED_table))
            return DECR_ILLEGALDATA;
          // Fall through: aligned block also reads main and length trees
          /* falls through */
        case LZX_BLOCKTYPE_VERBATIM:
          if (readLengths(state.MAINTREE_len, 0, 256)) return DECR_ILLEGALDATA;
          if (readLengths(state.MAINTREE_len, 256, state.mainElements)) return DECR_ILLEGALDATA;
          if (makeDecodeTable(LZX_MAINTREE_MAXSYMBOLS, LZX_MAINTREE_TABLEBITS, state.MAINTREE_len, state.MAINTREE_table))
            return DECR_ILLEGALDATA;
          if (state.MAINTREE_len[0xe8] !== 0) state.intelStarted = true;

          if (readLengths(state.LENGTH_len, 0, LZX_NUM_SECONDARY_LENGTHS)) return DECR_ILLEGALDATA;
          if (makeDecodeTable(LZX_LENGTH_MAXSYMBOLS, LZX_LENGTH_TABLEBITS, state.LENGTH_len, state.LENGTH_table))
            return DECR_ILLEGALDATA;
          break;

        case LZX_BLOCKTYPE_UNCOMPRESSED:
          state.intelStarted = true;
          // Align: consume up to 16 pad bits, then re-align
          ensureBits(16);
          if (bitsleft > 16) inpos -= 2;
          // Read R0, R1, R2 as LE 32-bit integers from stream
          R0 = (inData[inpos] | (inData[inpos+1] << 8) | (inData[inpos+2] << 16) | (inData[inpos+3] << 24)) >>> 0;
          inpos += 4;
          R1 = (inData[inpos] | (inData[inpos+1] << 8) | (inData[inpos+2] << 16) | (inData[inpos+3] << 24)) >>> 0;
          inpos += 4;
          R2 = (inData[inpos] | (inData[inpos+1] << 8) | (inData[inpos+2] << 16) | (inData[inpos+3] << 24)) >>> 0;
          inpos += 4;
          break;

        default:
          return DECR_ILLEGALDATA;
      }
    }

    // Buffer exhaustion check
    if (inpos > endinp) {
      if (inpos > endinp + 2 || bitsleft < 16) return DECR_ILLEGALDATA;
    }

    // Process as much of this block as possible (up to togo bytes)
    while (state.blockRemaining > 0 && togo > 0) {
      let thisRun = state.blockRemaining;
      if (thisRun > togo) thisRun = togo;
      togo -= thisRun;
      state.blockRemaining -= thisRun;

      // Apply window size mask
      windowPosn &= windowSize - 1;
      if (windowPosn + thisRun > windowSize) return DECR_DATAFORMAT;

      switch (state.blockType) {
        case LZX_BLOCKTYPE_VERBATIM:
          while (thisRun > 0) {
            const mainElement = readHuffSym(state.MAINTREE_table, state.MAINTREE_len, LZX_MAINTREE_TABLEBITS, LZX_MAINTREE_MAXSYMBOLS);
            if (mainElement < 0) return DECR_ILLEGALDATA;

            if (mainElement < LZX_NUM_CHARS) {
              window[windowPosn++] = mainElement;
              thisRun--;
            } else {
              const me = mainElement - LZX_NUM_CHARS;
              let matchLength = me & LZX_NUM_PRIMARY_LENGTHS;
              if (matchLength === LZX_NUM_PRIMARY_LENGTHS) {
                const lf = readHuffSym(state.LENGTH_table, state.LENGTH_len, LZX_LENGTH_TABLEBITS, LZX_LENGTH_MAXSYMBOLS);
                if (lf < 0) return DECR_ILLEGALDATA;
                matchLength += lf;
              }
              matchLength += LZX_MIN_MATCH;

              let matchOffset = me >> 3;
              if (matchOffset > 2) {
                if (matchOffset !== 3) {
                  const extra = EXTRA_BITS[matchOffset];
                  const verbatimBits = readBits(extra);
                  matchOffset = POSITION_BASE[matchOffset] - 2 + verbatimBits;
                } else {
                  matchOffset = 1;
                }
                R2 = R1; R1 = R0; R0 = matchOffset;
              } else if (matchOffset === 0) {
                matchOffset = R0;
              } else if (matchOffset === 1) {
                matchOffset = R1; R1 = R0; R0 = matchOffset;
              } else {
                matchOffset = R2; R2 = R0; R0 = matchOffset;
              }

              let rundest = windowPosn;
              let runsrc = rundest - matchOffset;
              windowPosn += matchLength;
              if (windowPosn > windowSize) return DECR_ILLEGALDATA;
              thisRun -= matchLength;

              // Copy wrapped-around source data
              while (runsrc < 0 && matchLength-- > 0) {
                window[rundest++] = window[runsrc + windowSize];
                runsrc++;
              }
              // Copy match data
              while (matchLength-- > 0) {
                window[rundest++] = window[runsrc++];
              }
            }
          }
          break;

        case LZX_BLOCKTYPE_ALIGNED:
          while (thisRun > 0) {
            const mainElement = readHuffSym(state.MAINTREE_table, state.MAINTREE_len, LZX_MAINTREE_TABLEBITS, LZX_MAINTREE_MAXSYMBOLS);
            if (mainElement < 0) return DECR_ILLEGALDATA;

            if (mainElement < LZX_NUM_CHARS) {
              window[windowPosn++] = mainElement;
              thisRun--;
            } else {
              const me = mainElement - LZX_NUM_CHARS;
              let matchLength = me & LZX_NUM_PRIMARY_LENGTHS;
              if (matchLength === LZX_NUM_PRIMARY_LENGTHS) {
                const lf = readHuffSym(state.LENGTH_table, state.LENGTH_len, LZX_LENGTH_TABLEBITS, LZX_LENGTH_MAXSYMBOLS);
                if (lf < 0) return DECR_ILLEGALDATA;
                matchLength += lf;
              }
              matchLength += LZX_MIN_MATCH;

              let matchOffset = me >> 3;
              if (matchOffset > 2) {
                const extra = EXTRA_BITS[matchOffset];
                matchOffset = POSITION_BASE[matchOffset] - 2;
                if (extra > 3) {
                  const verbatimBits = readBits(extra - 3);
                  matchOffset += verbatimBits << 3;
                  const alignedBits = readHuffSym(state.ALIGNED_table, state.ALIGNED_len, LZX_ALIGNED_TABLEBITS, LZX_ALIGNED_MAXSYMBOLS);
                  if (alignedBits < 0) return DECR_ILLEGALDATA;
                  matchOffset += alignedBits;
                } else if (extra === 3) {
                  const alignedBits = readHuffSym(state.ALIGNED_table, state.ALIGNED_len, LZX_ALIGNED_TABLEBITS, LZX_ALIGNED_MAXSYMBOLS);
                  if (alignedBits < 0) return DECR_ILLEGALDATA;
                  matchOffset += alignedBits;
                } else if (extra > 0) {
                  const verbatimBits = readBits(extra);
                  matchOffset += verbatimBits;
                } else {
                  matchOffset = 1;
                }
                R2 = R1; R1 = R0; R0 = matchOffset;
              } else if (matchOffset === 0) {
                matchOffset = R0;
              } else if (matchOffset === 1) {
                matchOffset = R1; R1 = R0; R0 = matchOffset;
              } else {
                matchOffset = R2; R2 = R0; R0 = matchOffset;
              }

              let rundest = windowPosn;
              let runsrc = rundest - matchOffset;
              windowPosn += matchLength;
              if (windowPosn > windowSize) return DECR_ILLEGALDATA;
              thisRun -= matchLength;

              while (runsrc < 0 && matchLength-- > 0) {
                window[rundest++] = window[runsrc + windowSize];
                runsrc++;
              }
              while (matchLength-- > 0) {
                window[rundest++] = window[runsrc++];
              }
            }
          }
          break;

        case LZX_BLOCKTYPE_UNCOMPRESSED:
          if (inpos + thisRun > endinp) return DECR_ILLEGALDATA;
          // Write directly to window (C code does memcpy(window + window_posn, inpos, ...))
          window.set(inData.subarray(inpos, inpos + thisRun), windowPosn);
          inpos += thisRun;
          windowPosn += thisRun;
          break;

        default:
          return DECR_ILLEGALDATA;
      }
    } // end inner while
  } // end outer while

  if (togo !== 0) return DECR_ILLEGALDATA;

  // Copy decompressed data from window to output
  // C: memcpy(outpos, window + ((!window_posn) ? window_size : window_posn) - outlen, outlen)
  const copyFrom = (windowPosn === 0 ? windowSize : windowPosn) - outLen;
  outData.set(window.subarray(copyFrom, copyFrom + outLen), 0);

  state.windowPosn = windowPosn;
  state.R0 = R0;
  state.R1 = R1;
  state.R2 = R2;

  // Intel E8 call translation post-processing
  if (state.framesRead++ < 32768 && state.intelFilesize !== 0) {
    if (outLen <= 6 || !state.intelStarted) {
      state.intelCurpos += outLen;
    } else {
      let dataPos = 0;
      const dataEnd = outLen - 10;
      let curpos = state.intelCurpos;
      const filesize = state.intelFilesize;

      state.intelCurpos = curpos + outLen;

      while (dataPos < dataEnd) {
        if (outData[dataPos++] !== 0xe8) { curpos++; continue; }
        // Read signed 32-bit LE integer
        const absOff = (outData[dataPos] | (outData[dataPos+1] << 8) | (outData[dataPos+2] << 16) | (outData[dataPos+3] << 24));
        if (absOff >= -curpos && absOff < filesize) {
          const relOff = absOff >= 0 ? absOff - curpos : absOff + filesize;
          outData[dataPos]   = (relOff) & 0xff;
          outData[dataPos+1] = (relOff >> 8) & 0xff;
          outData[dataPos+2] = (relOff >> 16) & 0xff;
          outData[dataPos+3] = (relOff >> 24) & 0xff;
        }
        dataPos += 4;
        curpos += 5;
      }
    }
  }

  return DECR_OK;
}
