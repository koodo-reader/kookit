import { BufferReader } from './buffer-reader.js';
import {
  unmarshalItsfHeader,
  unmarshalItspHeader,
  unmarshalPmglHeader,
  unmarshalPmgiHeader,
  unmarshalLzxcResetTable,
  unmarshalLzxcControlData,
} from './headers.js';
import { LZXState, lzxDecompress, DECR_OK } from './lzx.js';
import type { ChmReader } from './reader.js';
import { ChmUnitInfo, ChmSpace, ChmEnumerateFlags, LzxcResetTable } from './types.js';

const CHMU_RESET_TABLE =
  '::DataSpace/Storage/MSCompressed/Transform/' +
  '{7FC28940-9D31-11D0-9B27-00A0C91E9C7C}/' +
  'InstanceData/ResetTable';
const CHMU_LZXC_CONTROLDATA = '::DataSpace/Storage/MSCompressed/ControlData';
const CHMU_CONTENT = '::DataSpace/Storage/MSCompressed/Content';

const CHM_MAX_BLOCKS_CACHED = 5;

export class ChmFile {
  private reader: ChmReader;
  private dirOffset: bigint = 0n;
  private dirLen: bigint = 0n;
  private dataOffset: bigint = 0n;
  private indexRoot: number = 0;
  private indexHead: number = 0;
  private blockLen: number = 0;

  // Compression state
  private compressionEnabled: boolean = false;
  private rtUnit!: ChmUnitInfo;
  private cnUnit!: ChmUnitInfo;
  private resetTable!: LzxcResetTable;
  private windowSize: number = 0;
  private resetInterval: number = 0;
  private resetBlkCount: number = 0;

  // LZX decompressor state
  private lzxState: LZXState | null = null;
  private lzxLastBlock: number = -1;

  // Block cache
  private cacheBlocks: (Uint8Array | null)[];
  private cacheBlockIndices: bigint[];
  private cacheNumBlocks: number;

  private constructor(reader: ChmReader) {
    this.reader = reader;
    this.cacheNumBlocks = CHM_MAX_BLOCKS_CACHED;
    this.cacheBlocks = new Array(CHM_MAX_BLOCKS_CACHED).fill(null);
    this.cacheBlockIndices = new Array(CHM_MAX_BLOCKS_CACHED).fill(0n);
  }

  static async open(reader: ChmReader): Promise<ChmFile> {
    const f = new ChmFile(reader);
    await f.init();
    return f;
  }

  private async init(): Promise<void> {
    // Read and parse ITSF header
    const itsfBuf = await this.reader.read(0n, 0x60);
    const itsf = unmarshalItsfHeader(itsfBuf);

    this.dirOffset = itsf.dirOffset;
    this.dirLen = itsf.dirLen;
    this.dataOffset = itsf.dataOffset;

    // Read and parse ITSP header
    const itspBuf = await this.reader.read(itsf.dirOffset, 0x54);
    const itsp = unmarshalItspHeader(itspBuf);

    this.dirOffset += BigInt(itsp.headerLen);
    this.dirLen -= BigInt(itsp.headerLen);
    this.indexRoot = itsp.indexRoot <= -1 ? itsp.indexHead : itsp.indexRoot;
    this.indexHead = itsp.indexHead;
    this.blockLen = itsp.blockLen;

    // Try to set up compression
    try {
      const rtUnit = await this.resolve(CHMU_RESET_TABLE);
      const cnUnit = await this.resolve(CHMU_CONTENT);
      const uiLzxc = await this.resolve(CHMU_LZXC_CONTROLDATA);

      if (rtUnit && rtUnit.space !== ChmSpace.Compressed &&
          cnUnit && cnUnit.space !== ChmSpace.Compressed &&
          uiLzxc && uiLzxc.space !== ChmSpace.Compressed) {

        // Read reset table
        const rtBuf = await this.fetchBytes(
          this.dataOffset + rtUnit.start,
          0x28,
        );
        const resetTable = unmarshalLzxcResetTable(rtBuf);

        // Read control data
        const ctlBuf = await this.fetchBytes(
          this.dataOffset + uiLzxc.start,
          Number(uiLzxc.length),
        );
        const ctlData = unmarshalLzxcControlData(ctlBuf);

        this.rtUnit = rtUnit;
        this.cnUnit = cnUnit;
        this.resetTable = resetTable;
        this.windowSize = ctlData.windowSize;
        this.resetInterval = ctlData.resetInterval;
        this.resetBlkCount = (ctlData.resetInterval / (ctlData.windowSize / 2)) * ctlData.windowsPerReset;
        this.compressionEnabled = true;
      }
    } catch {
      // Compression not available or not needed
      this.compressionEnabled = false;
    }
  }

  close(): void {
    if (this.reader.close) this.reader.close();
    this.lzxState = null;
    this.cacheBlocks.fill(null);
  }

  setCacheSize(n: number): void {
    if (n === this.cacheNumBlocks) return;

    const newBlocks: (Uint8Array | null)[] = new Array(n).fill(null);
    const newIndices: bigint[] = new Array(n).fill(0n);

    for (let i = 0; i < this.cacheNumBlocks; i++) {
      if (this.cacheBlocks[i]) {
        const newSlot = Number(this.cacheBlockIndices[i] % BigInt(n));
        if (!newBlocks[newSlot]) {
          newBlocks[newSlot] = this.cacheBlocks[i];
          newIndices[newSlot] = this.cacheBlockIndices[i];
        }
      }
    }

    this.cacheBlocks = newBlocks;
    this.cacheBlockIndices = newIndices;
    this.cacheNumBlocks = n;
  }

  private async fetchBytes(offset: bigint, length: number): Promise<Uint8Array> {
    return this.reader.read(offset, length);
  }

  /** Parse a PMGL entry from a BufferReader, return null if at end */
  private parsePmglEntry(r: BufferReader): ChmUnitInfo | null {
    if (r.remaining === 0) return null;
    const strLen = r.readCWord();
    const pathBytes = r.readBytes(Number(strLen));
    const path = new TextDecoder('utf-8').decode(pathBytes);
    const space = Number(r.readCWord()) as ChmSpace;
    const start = r.readCWord();
    const length = r.readCWord();
    return { start, length, space, flags: 0, path };
  }

  /** Walk PMGI index page to find the leaf block that would contain objPath */
  private findInPmgi(pageBuf: Uint8Array, objPath: string): number {
    const header = unmarshalPmgiHeader(pageBuf.subarray(0, 8));
    const end = pageBuf.length - header.freeSpace;
    const r = new BufferReader(pageBuf, 8);
    const objPathKey = pathKey(objPath);
    let page = -1;

    while (r.offset < end) {
      const strLen = Number(r.readCWord());
      const pathBytes = r.readBytes(strLen);
      const path = new TextDecoder('utf-8').decode(pathBytes);

      if (pathKey(path) > objPathKey) return page;

      page = Number(r.readCWord());
    }

    return page;
  }

  /** Search PMGL leaf page for exact entry matching objPath. Returns offset into page or -1. */
  private findInPmgl(pageBuf: Uint8Array, objPath: string): ChmUnitInfo | null {
    const header = unmarshalPmglHeader(pageBuf.subarray(0, 0x14));
    const end = pageBuf.length - header.freeSpace;
    const r = new BufferReader(pageBuf, 0x14);

    while (r.offset < end) {
      const entryStart = r.offset;
      void entryStart;
      const strLen = Number(r.readCWord());
      const pathBytes = r.readBytes(strLen);
      const path = new TextDecoder('utf-8').decode(pathBytes);

      // Case-insensitive comparison per C original (strcasecmp)
      if (pathKey(path) === pathKey(objPath)) {
        const space = Number(r.readCWord()) as ChmSpace;
        const start = r.readCWord();
        const length = r.readCWord();
        return { start, length, space, flags: 0, path };
      }

      // Skip the 3 cwords (space, start, length)
      r.readCWord();
      r.readCWord();
      r.readCWord();
    }

    return null;
  }

  /** Resolve a path to its ChmUnitInfo, or null if not found */
  async resolve(objPath: string): Promise<ChmUnitInfo | null> {
    const indexed = await this.resolveIndexed(objPath);
    if (indexed) return indexed;

    const objPathKey = pathKey(objPath);
    for await (const entry of this.enumerate(ChmEnumerateFlags.All)) {
      if (pathKey(entry.path) === objPathKey) {
        return entry;
      }
    }

    return null;
  }

  private async resolveIndexed(objPath: string): Promise<ChmUnitInfo | null> {
    let curPage = this.indexRoot;

    while (curPage !== -1) {
      const pageBuf = await this.fetchBytes(
        this.dirOffset + BigInt(curPage) * BigInt(this.blockLen),
        this.blockLen,
      );

      const sig = String.fromCharCode(pageBuf[0], pageBuf[1], pageBuf[2], pageBuf[3]);

      if (sig === 'PMGL') {
        return this.findInPmgl(pageBuf, objPath);
      } else if (sig === 'PMGI') {
        curPage = this.findInPmgi(pageBuf, objPath);
      } else {
        return null;
      }
    }

    return null;
  }

  /** Retrieve (part of) an object's data */
  async retrieve(
    ui: ChmUnitInfo,
    offset: bigint = 0n,
    length?: bigint,
  ): Promise<Uint8Array> {
    if (offset < 0n || offset >= ui.length) return new Uint8Array(0);

    const len = length !== undefined
      ? (offset + length > ui.length ? ui.length - offset : length)
      : ui.length - offset;

    if (len <= 0n) return new Uint8Array(0);

    if (ui.space === ChmSpace.Uncompressed) {
      return this.fetchBytes(
        this.dataOffset + ui.start + offset,
        Number(len),
      );
    }

    // Compressed
    if (!this.compressionEnabled) return new Uint8Array(0);

    return this.decompressRegion(ui.start + offset, len);
  }

  /** Get the compressed block bounds */
  private async getCmpBlockBounds(
    block: bigint,
  ): Promise<{ start: bigint; len: bigint }> {
    const tableBase = this.dataOffset + this.rtUnit.start + BigInt(this.resetTable.tableOffset);

    const startBuf = await this.fetchBytes(tableBase + block * 8n, 8);
    const startR = new BufferReader(startBuf);
    const rawStart = startR.readBigUint64LE();

    let rawEnd: bigint;
    if (block < BigInt(this.resetTable.blockCount - 1)) {
      const endBuf = await this.fetchBytes(tableBase + block * 8n + 8n, 8);
      const endR = new BufferReader(endBuf);
      rawEnd = endR.readBigUint64LE();
    } else {
      rawEnd = this.resetTable.compressedLen;
    }

    const len = rawEnd - rawStart;
    const start = rawStart + this.dataOffset + this.cnUnit.start;

    return { start, len };
  }

  /** Decompress one block into the cache slot. Must call in-order. */
  private async decompressOneBlock(blockIdx: number): Promise<void> {
    const blockLen = Number(this.resetTable.blockLen);
    const slot = blockIdx % this.cacheNumBlocks;

    if (!this.cacheBlocks[slot]) {
      this.cacheBlocks[slot] = new Uint8Array(blockLen);
    }
    this.cacheBlockIndices[slot] = BigInt(blockIdx);
    const ubuf = this.cacheBlocks[slot]!;

    const { start, len } = await this.getCmpBlockBounds(BigInt(blockIdx));
    const cbuf = await this.fetchBytes(start, Number(len));

    const res = lzxDecompress(this.lzxState!, cbuf, ubuf, Number(len), blockLen);
    if (res !== DECR_OK) throw new Error(`LZX decompression failed for block ${blockIdx}: code ${res}`);
    this.lzxLastBlock = blockIdx;
  }

  /** Decompress a single block into cache, return its data.
   *
   * Matches the C _chm_decompress_block logic:
   * - Compute blockAlign = block % resetBlkCount
   * - If lzxLastBlock is between block-blockAlign and block, reduce blockAlign
   * - Decompress all preceding blocks in the reset window that haven't been done yet
   */
  private async decompressBlock(block: bigint): Promise<Uint8Array> {
    const blockIdx = Number(block);

    // Lazy-init LZX state
    if (!this.lzxState) {
      // Compute windowBits from windowSize (must be power of 2 in [2^15..2^21])
      let windowBits = 0;
      let ws = this.windowSize;
      while (ws > 1) { ws >>>= 1; windowBits++; }
      this.lzxState = new LZXState(windowBits);
      this.lzxLastBlock = -1;
    }

    // blockAlign: how many blocks into the current reset interval
    let blockAlign = blockIdx % this.resetBlkCount;

    // If lzxLastBlock is within [block-blockAlign, block], we can resume from there
    if (blockIdx - blockAlign <= this.lzxLastBlock && blockIdx >= this.lzxLastBlock) {
      blockAlign = blockIdx - this.lzxLastBlock;
    }

    if (blockAlign !== 0) {
      // Decompress all preceding blocks in this reset interval
      for (let i = blockAlign; i > 0; i--) {
        const curBlockIdx = blockIdx - i;
        if (this.lzxLastBlock !== curBlockIdx) {
          if (curBlockIdx % this.resetBlkCount === 0) {
            this.lzxState.reset();
          }
          await this.decompressOneBlock(curBlockIdx);
        }
      }
    } else {
      // At start of reset interval
      if (blockIdx % this.resetBlkCount === 0) {
        this.lzxState.reset();
      }
    }

    // Decompress the target block
    await this.decompressOneBlock(blockIdx);
    return this.cacheBlocks[blockIdx % this.cacheNumBlocks]!;
  }

  /** Decompress a region from compressed space */
  private async decompressRegion(start: bigint, len: bigint): Promise<Uint8Array> {
    if (len <= 0n) return new Uint8Array(0);

    const blockLen = this.resetTable.blockLen;
    const result = new Uint8Array(Number(len));
    let written = 0n;
    let remaining = len;
    let pos = start;

    while (remaining > 0n) {
      const nBlock = pos / blockLen;
      const nOffset = pos % blockLen;
      let nLen = remaining;
      if (nLen > blockLen - nOffset) nLen = blockLen - nOffset;

      // Check cache first
      const slot = Number(nBlock % BigInt(this.cacheNumBlocks));
      if (this.cacheBlocks[slot] !== null && this.cacheBlockIndices[slot] === nBlock) {
        result.set(this.cacheBlocks[slot]!.subarray(Number(nOffset), Number(nOffset + nLen)), Number(written));
      } else {
        const ubuf = await this.decompressBlock(nBlock);
        result.set(ubuf.subarray(Number(nOffset), Number(nOffset + nLen)), Number(written));
      }

      written += nLen;
      remaining -= nLen;
      pos += nLen;
    }

    return result;
  }

  /** Enumerate all entries in the archive */
  async *enumerate(what: number = ChmEnumerateFlags.All): AsyncGenerator<ChmUnitInfo> {
    let curPage = this.indexHead;

    while (curPage !== -1) {
      const pageBuf = await this.fetchBytes(
        this.dirOffset + BigInt(curPage) * BigInt(this.blockLen),
        this.blockLen,
      );

      const header = unmarshalPmglHeader(pageBuf.subarray(0, 0x14));
      const end = pageBuf.length - header.freeSpace;
      const r = new BufferReader(pageBuf, 0x14);

      while (r.offset < end) {
        const entry = this.parsePmglEntry(r);
        if (!entry) break;

        entry.flags = computeFlags(entry.path);

        if (matchesFilter(entry.flags, what)) {
          yield entry;
        }
      }

      curPage = header.blockNext;
    }
  }

  /** Enumerate entries under a directory prefix */
  async *enumerateDir(
    prefix: string,
    what: number = ChmEnumerateFlags.All,
  ): AsyncGenerator<ChmUnitInfo> {
    // Normalize prefix to end with /
    let pfx = prefix;
    if (pfx.length > 0 && !pfx.endsWith('/')) pfx += '/';

    let started = false;

    for await (const entry of this.enumerate(ChmEnumerateFlags.All)) {
      if (!started) {
        // Look for the directory entry itself
        if (entry.length === 0n && entry.path.toLowerCase().startsWith(pfx.toLowerCase())) {
          started = true;
          if (entry.path.length === pfx.length) continue; // skip the dir entry itself
        } else {
          continue;
        }
      } else {
        if (!entry.path.toLowerCase().startsWith(pfx.toLowerCase())) break;
      }

      if (matchesFilter(entry.flags, what)) {
        yield entry;
      }
    }
  }

  /** Read the /#SYSTEM file as raw bytes for higher-level parsing */
  async getSystemRaw(): Promise<Uint8Array | null> {
    const ui = await this.resolve('/#SYSTEM');
    if (!ui) return null;
    return this.retrieve(ui);
  }
}

function computeFlags(path: string): number {
  let flags = 0;
  const lastChar = path[path.length - 1];

  if (lastChar === '/') {
    flags |= ChmEnumerateFlags.Dirs;
  } else {
    flags |= ChmEnumerateFlags.Files;
  }

  if (path[0] === '/') {
    if (path.length > 1 && (path[1] === '#' || path[1] === '$')) {
      flags |= ChmEnumerateFlags.Special;
    } else {
      flags |= ChmEnumerateFlags.Normal;
    }
  } else {
    flags |= ChmEnumerateFlags.Meta;
  }

  return flags;
}

function matchesFilter(flags: number, what: number): boolean {
  const typeBits = what & 0x7;
  const filterBits = what & 0xf8;

  if (!(typeBits & flags)) return false;
  if (filterBits && !(filterBits & flags)) return false;

  return true;
}

function pathKey(path: string): string {
  return path.toLowerCase();
}
