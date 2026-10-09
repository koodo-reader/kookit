// Public types

export interface ChmUnitInfo {
  start: bigint;
  length: bigint;
  space: ChmSpace;
  flags: number;
  path: string;
}

export enum ChmSpace {
  Uncompressed = 0,
  Compressed = 1,
}

export enum ChmEnumerateFlags {
  Normal   = 1,
  Meta     = 2,
  Special  = 4,
  Files    = 8,
  Dirs     = 16,
  All      = 31,
}

// Internal header structs

export interface ItsfHeader {
  signature: string;
  version: number;
  headerLen: number;
  lastModified: number;
  langId: number;
  dirUuid: Uint8Array;
  streamUuid: Uint8Array;
  unknownOffset: bigint;
  unknownLen: bigint;
  dirOffset: bigint;
  dirLen: bigint;
  dataOffset: bigint;
}

export interface ItspHeader {
  signature: string;
  version: number;
  headerLen: number;
  blockLen: number;
  blockidxIntvl: number;
  indexDepth: number;
  indexRoot: number;
  indexHead: number;
  numBlocks: number;
  langId: number;
  systemUuid: Uint8Array;
}

export interface PmglHeader {
  signature: string;
  freeSpace: number;
  blockPrev: number;
  blockNext: number;
}

export interface PmgiHeader {
  signature: string;
  freeSpace: number;
}

export interface LzxcResetTable {
  version: number;
  blockCount: number;
  tableOffset: number;
  uncompressedLen: bigint;
  compressedLen: bigint;
  blockLen: bigint;
}

export interface LzxcControlData {
  size: number;
  signature: string;
  version: number;
  resetInterval: number;
  windowSize: number;
  windowsPerReset: number;
}
