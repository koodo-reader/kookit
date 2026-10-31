// DjVu IFF 解析（EA IFF85 子集）。
// 规范 §8.1/§8.2（DjVu 文档底层结构）：
//   - 文件以 "AT&T"（0x41 0x54 0x26 0x54）开头，随后是唯一的顶层 FORM chunk
//   - chunk = 4 字节 ID + BE32 长度 + 数据；长度为奇数时补 1 个 0 字节对齐
//   - FORM 数据的前 4 字节为次级 ID（DJVU/DJVM/DJVI/THUM）

export interface IffChunk {
  // 4 字节 chunk ID（"FORM"、"INFO"、"Sjbz"...）
  id: string;
  // FORM 的次级 ID（其余 chunk 为空串）
  form: string;
  // chunk 头（ID 字段）在文件中的偏移
  start: number;
  // 数据区起始偏移
  dataStart: number;
  // 数据区结束偏移（不含奇数长度填充）
  dataEnd: number;
  // 声明的数据长度
  length: number;
}

export const DJVU_MAGIC = [0x41, 0x54, 0x26, 0x54];

export const hasDjvuMagic = (data: Uint8Array): boolean =>
  data.length >= DJVU_MAGIC.length &&
  data[0] === DJVU_MAGIC[0] &&
  data[1] === DJVU_MAGIC[1] &&
  data[2] === DJVU_MAGIC[2] &&
  data[3] === DJVU_MAGIC[3];

export const readChunkId = (data: Uint8Array, offset: number): string => {
  return String.fromCharCode(
    data[offset],
    data[offset + 1],
    data[offset + 2],
    data[offset + 3]
  );
};

export const readUint16BE = (data: Uint8Array, offset: number): number =>
  (data[offset] << 8) | data[offset + 1];

export const readUint24BE = (data: Uint8Array, offset: number): number =>
  (data[offset] << 16) | (data[offset + 1] << 8) | data[offset + 2];

export const readUint32BE = (data: Uint8Array, offset: number): number =>
  ((data[offset] << 24) |
    (data[offset + 1] << 16) |
    (data[offset + 2] << 8) |
    data[offset + 3]) >>>
  0;

// 解析 [start, end) 范围内的一串顺序 chunk（不含嵌套：DjVu 中嵌套都是
// 通过 FORM 的次级 ID + 再次调用 parseIffChunks 完成的）
export const parseIffChunks = (
  data: Uint8Array,
  start: number,
  end: number
): IffChunk[] => {
  const chunks: IffChunk[] = [];
  let offset = start;
  while (offset + 8 <= end) {
    const id = readChunkId(data, offset);
    const length = readUint32BE(data, offset + 4);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd > end) {
      throw new Error("Invalid DjVu file: chunk " + id + " exceeds container");
    }
    chunks.push({
      id,
      form: id === "FORM" ? readChunkId(data, dataStart) : "",
      start: offset,
      dataStart,
      dataEnd,
      length,
    });
    // 奇数长度后补 0 字节对齐
    offset = dataEnd + (length & 1);
  }
  return chunks;
};

// 从文件开头读取顶层 FORM（跳过 "AT&T" 魔数）
export const readTopLevelForm = (data: Uint8Array): IffChunk => {
  if (!hasDjvuMagic(data)) {
    throw new Error("Invalid DjVu file: missing AT&T signature");
  }
  const chunks = parseIffChunks(data, 4, data.length);
  if (chunks.length === 0 || chunks[0].id !== "FORM") {
    throw new Error("Invalid DjVu file: missing top level FORM chunk");
  }
  return chunks[0];
};

// FORM chunk 的嵌套子 chunk（跳过 4 字节次级 ID）
export const parseFormChildren = (
  data: Uint8Array,
  form: IffChunk
): IffChunk[] => {
  if (form.id !== "FORM") return [];
  return parseIffChunks(data, form.dataStart + 4, form.dataEnd);
};

export const chunkData = (
  data: Uint8Array,
  chunk: IffChunk
): Uint8Array => {
  return data.subarray(chunk.dataStart, chunk.dataEnd);
};

export const findChild = (
  data: Uint8Array,
  parent: IffChunk,
  id: string
): IffChunk | null => {
  const children = parseFormChildren(data, parent);
  for (const child of children) {
    if (child.id === id) return child;
  }
  return null;
};

export const findChildren = (
  data: Uint8Array,
  parent: IffChunk,
  id: string
): IffChunk[] => {
  const result: IffChunk[] = [];
  for (const child of parseFormChildren(data, parent)) {
    if (child.id === id) result.push(child);
  }
  return result;
};

const textDecoder = new TextDecoder("utf-8");

export const decodeUtf8 = (data: Uint8Array): string => {
  return textDecoder.decode(data);
};

// 读取以 \0 结尾的字符串（DIRM 的 ZSTR，可能与块尾部截断）
export const readZeroTerminatedString = (
  data: Uint8Array,
  offset: number
): { value: string; next: number } => {
  let end = offset;
  while (end < data.length && data[end] !== 0) end++;
  return {
    value: textDecoder.decode(data.subarray(offset, end)),
    next: end < data.length ? end + 1 : end,
  };
};
