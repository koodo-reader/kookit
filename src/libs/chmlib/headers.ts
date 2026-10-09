import { BufferReader } from './buffer-reader.js';
import type {
  ItsfHeader,
  ItspHeader,
  PmglHeader,
  PmgiHeader,
  LzxcResetTable,
  LzxcControlData,
} from './types.js';

const ITSF_V2_LEN = 0x58;
const ITSF_V3_LEN = 0x60;

export function unmarshalItsfHeader(data: Uint8Array): ItsfHeader {
  if (data.length !== ITSF_V2_LEN && data.length !== ITSF_V3_LEN)
    throw new Error(`ITSF header: unexpected length ${data.length}`);

  const r = new BufferReader(data);
  const signature = r.readAscii(4);
  const version = r.readInt32LE();
  const headerLen = r.readInt32LE();
  r.readInt32LE(); // unknown_000c
  const lastModified = r.readUint32LE();
  const langId = r.readUint32LE();
  const dirUuid = r.readBytes(16);
  const streamUuid = r.readBytes(16);
  const unknownOffset = r.readBigUint64LE();
  const unknownLen = r.readBigUint64LE();
  const dirOffset = r.readBigUint64LE();
  const dirLen = r.readBigUint64LE();

  if (signature !== 'ITSF')
    throw new Error(`ITSF header: bad signature "${signature}"`);
  if (version === 2) {
    if (headerLen < ITSF_V2_LEN)
      throw new Error(`ITSF v2 header too short: ${headerLen}`);
  } else if (version === 3) {
    if (headerLen < ITSF_V3_LEN)
      throw new Error(`ITSF v3 header too short: ${headerLen}`);
  } else {
    throw new Error(`ITSF header: unsupported version ${version}`);
  }

  let dataOffset: bigint;
  if (version === 3) {
    if (r.remaining < 8)
      throw new Error('ITSF v3 header: missing data_offset field');
    dataOffset = r.readBigUint64LE();
  } else {
    dataOffset = dirOffset + dirLen;
  }

  return {
    signature,
    version,
    headerLen,
    lastModified,
    langId,
    dirUuid,
    streamUuid,
    unknownOffset,
    unknownLen,
    dirOffset,
    dirLen,
    dataOffset,
  };
}

const ITSP_V1_LEN = 0x54;

export function unmarshalItspHeader(data: Uint8Array): ItspHeader {
  if (data.length !== ITSP_V1_LEN)
    throw new Error(`ITSP header: unexpected length ${data.length}`);

  const r = new BufferReader(data);
  const signature = r.readAscii(4);
  const version = r.readInt32LE();
  const headerLen = r.readInt32LE();
  r.readInt32LE(); // unknown_000c
  const blockLen = r.readUint32LE();
  r.readInt32LE(); // blockidx_intvl
  r.readInt32LE(); // index_depth
  const indexRoot = r.readInt32LE();
  const indexHead = r.readInt32LE();
  r.readInt32LE(); // unknown_0024
  const numBlocks = r.readUint32LE();
  r.readInt32LE(); // unknown_002c
  const langId = r.readUint32LE();
  const systemUuid = r.readBytes(16);
  r.readBytes(16); // unknown_0044

  if (signature !== 'ITSP')
    throw new Error(`ITSP header: bad signature "${signature}"`);
  if (version !== 1)
    throw new Error(`ITSP header: unsupported version ${version}`);
  if (headerLen !== ITSP_V1_LEN)
    throw new Error(`ITSP header: unexpected headerLen ${headerLen}`);

  return {
    signature,
    version,
    headerLen,
    blockLen,
    blockidxIntvl: 0,
    indexDepth: 0,
    indexRoot,
    indexHead,
    numBlocks,
    langId,
    systemUuid,
  };
}

export function unmarshalPmglHeader(data: Uint8Array): PmglHeader {
  if (data.length < 0x14)
    throw new Error(`PMGL header: too short (${data.length})`);

  const r = new BufferReader(data);
  const signature = r.readAscii(4);
  const freeSpace = r.readUint32LE();
  r.readUint32LE(); // unknown_0008
  const blockPrev = r.readInt32LE();
  const blockNext = r.readInt32LE();

  if (signature !== 'PMGL')
    throw new Error(`PMGL header: bad signature "${signature}"`);

  return { signature, freeSpace, blockPrev, blockNext };
}

export function unmarshalPmgiHeader(data: Uint8Array): PmgiHeader {
  if (data.length < 0x08)
    throw new Error(`PMGI header: too short (${data.length})`);

  const r = new BufferReader(data);
  const signature = r.readAscii(4);
  const freeSpace = r.readUint32LE();

  if (signature !== 'PMGI')
    throw new Error(`PMGI header: bad signature "${signature}"`);

  return { signature, freeSpace };
}

const LZXC_RESET_TABLE_LEN = 0x28;

export function unmarshalLzxcResetTable(data: Uint8Array): LzxcResetTable {
  if (data.length !== LZXC_RESET_TABLE_LEN)
    throw new Error(`LZXC reset table: unexpected length ${data.length}`);

  const r = new BufferReader(data);
  const version = r.readUint32LE();
  const blockCount = r.readUint32LE();
  r.readUint32LE(); // unknown
  const tableOffset = r.readUint32LE();
  const uncompressedLen = r.readBigUint64LE();
  const compressedLen = r.readBigUint64LE();
  const blockLen = r.readBigUint64LE();

  if (version !== 2)
    throw new Error(`LZXC reset table: unsupported version ${version}`);

  return { version, blockCount, tableOffset, uncompressedLen, compressedLen, blockLen };
}

const LZXC_MIN_LEN = 0x18;
const LZXC_V2_LEN = 0x1c;

export function unmarshalLzxcControlData(data: Uint8Array): LzxcControlData {
  if (data.length < LZXC_MIN_LEN)
    throw new Error(`LZXC control data: too short (${data.length})`);

  const r = new BufferReader(data);
  const size = r.readUint32LE();
  const signature = r.readAscii(4);
  const version = r.readUint32LE();
  let resetInterval = r.readUint32LE();
  let windowSize = r.readUint32LE();
  const windowsPerReset = r.readUint32LE();
  const unknown18 = data.length >= LZXC_V2_LEN ? r.readUint32LE() : 0;
  void unknown18;

  if (signature !== 'LZXC')
    throw new Error(`LZXC control data: bad signature "${signature}"`);

  if (version === 2) {
    resetInterval *= 0x8000;
    windowSize *= 0x8000;
  }

  if (windowSize === 0 || resetInterval === 0)
    throw new Error('LZXC control data: zero windowSize or resetInterval');
  if (windowSize === 1)
    throw new Error('LZXC control data: windowSize is 1');
  if ((resetInterval % (windowSize / 2)) !== 0)
    throw new Error('LZXC control data: resetInterval not a multiple of windowSize/2');

  return { size, signature, version, resetInterval, windowSize, windowsPerReset };
}
