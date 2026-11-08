// DjVu 文档层：单个 FORM:DJVU 或捆绑多页 FORM:DJVM 的解析与页面访问。
// 规范 §7/§8：
//   - DIRM：版本字节（bit7 = bundled）+ BE16 文件数 + bundled 时的 BE32 偏移；
//     BZZ 载荷为 BE24 文件尺寸（ver>0 时）+ 标志字节 + 0 结尾的 id/name/title 字符串
//   - 标志位：HAS_NAME=0x80、HAS_TITLE=0x40、类型掩码 0x3f（0=INCLUDE 1=PAGE
//     2=THUMBNAILS 3=SHARED_ANNO）
//   - INFO：10 字节（width/height/version/dpi/gamma/flags），
//     兼容早期版本的截断写法（缺失字段取默认值）
//   - NAVM：BE16 记录总数 + 先序的 (子节点数, BE24 描述长度, 描述, BE24 URL 长度, URL)
//   - INCL：页面内的包含 chunk，其数据为共享文件（FORM:DJVI）的 ID
import {
  IffChunk,
  parseFormChildren,
  readTopLevelForm,
  readUint16BE,
  readUint24BE,
  readUint32BE,
  readZeroTerminatedString,
  decodeUtf8,
  chunkData,
} from "./iff";
import { bzzDecode } from "./bzz";
import { IW44Pixmap, decodeIW44 } from "./iw44";
import {
  DjvuAnnotation,
  DjvuAnnotationSet,
  DjvuTextLayer,
  DjvuTextZone,
  decodeTextChunk,
  extractMetadataFields,
  parseAnnotations,
} from "./text";

export interface DjvuMetadata {
  title: string;
  author: string;
  description: string;
  publisher: string;
  language: string;
  identifier: string;
}

export interface DjvuOutlineNode {
  label: string;
  href: string;
  pageIndex: number;
  children: DjvuOutlineNode[];
}

export interface DjvuPageInfo {
  width: number;
  height: number;
  dpi: number;
  gamma: number;
  // 0=0° 1=90° 2=180° 3=270°
  rotation: number;
  version: number;
}

export interface DjvuPage {
  index: number;
  id: string;
  title: string;
  info: DjvuPageInfo;
  // 页面自己的子 chunk（顺序与文件一致）
  chunks: IffChunk[];
  // INCL 指向的共享文件（FORM:DJVI）中的 chunk
  includedChunks: IffChunk[];
}

export interface DjvuSearchResult {
  pageIndex: number;
  excerpt: string;
}

interface DjvuDirEntry {
  id: string;
  name: string;
  title: string;
  size: number;
  offset: number;
  flags: number;
  type: number;
  chunk: IffChunk | null;
}

const FILE_TYPE_INCLUDE = 0;
const FILE_TYPE_PAGE = 1;
const FILE_TYPE_THUMBNAILS = 2;

// INFO chunk 解析（固定 10 字节；早期版本字段可能被截断）
export const parseInfo = (data: Uint8Array): DjvuPageInfo => {
  const size = Math.min(10, data.length);
  if (size < 5) {
    throw new Error("Invalid DjVu page: INFO chunk too short");
  }
  const width = (data[0] << 8) | data[1];
  const height = (data[2] << 8) | data[3];
  let version = data[4];
  if (size >= 6 && data[5] !== 0xff) {
    version = (data[5] << 8) + data[4];
  }
  let dpi = 300;
  if (size >= 8 && data[7] !== 0xff) {
    dpi = (data[7] << 8) + data[6];
  }
  let gamma = 2.2;
  if (size >= 9) {
    gamma = 0.1 * data[8];
  }
  if (gamma < 0.3) gamma = 0.3;
  if (gamma > 5.0) gamma = 5.0;
  if (dpi < 25 || dpi > 6000) dpi = 300;
  const flags = size >= 10 ? data[9] : 0;
  let rotation = 0;
  switch (flags & 0x7) {
    case 6:
      rotation = 1;
      break;
    case 2:
      rotation = 2;
      break;
    case 5:
      rotation = 3;
      break;
    default:
      rotation = 0;
      break;
  }
  return { width, height, dpi, gamma, rotation, version };
};

interface DirmData {
  bundled: boolean;
  entries: DjvuDirEntry[];
}

const parseDirm = (data: Uint8Array): DirmData => {
  let version = data[0];
  const bundled = (version & 0x80) !== 0;
  version &= 0x7f;
  const count = readUint16BE(data, 1);
  let pos = 3;
  const entries: DjvuDirEntry[] = [];
  for (let i = 0; i < count; i++) {
    let offset = 0;
    let size = 0;
    if (bundled) {
      offset = readUint32BE(data, pos);
      pos += 4;
      if (version === 0) {
        size = readUint24BE(data, pos);
        pos += 3;
      }
      if (offset === 0) {
        throw new Error("Invalid DjVu document: DIRM offset is zero");
      }
    }
    entries.push({
      id: "",
      name: "",
      title: "",
      size,
      offset,
      flags: 0,
      type: FILE_TYPE_INCLUDE,
      chunk: null,
    });
  }
  const payload = bzzDecode(data.subarray(pos));
  let p = 0;
  if (version > 0) {
    for (const entry of entries) {
      entry.size = readUint24BE(payload, p);
      p += 3;
    }
  }
  for (const entry of entries) {
    entry.flags = payload[p++];
    entry.type = entry.flags & 0x3f;
  }
  let sp = p;
  for (const entry of entries) {
    const id = readZeroTerminatedString(payload, sp);
    entry.id = id.value;
    sp = id.next;
    if (entry.flags & 0x80) {
      const name = readZeroTerminatedString(payload, sp);
      entry.name = name.value;
      sp = name.next;
    } else {
      entry.name = entry.id;
    }
    if (entry.flags & 0x40) {
      const title = readZeroTerminatedString(payload, sp);
      entry.title = title.value;
      sp = title.next;
    } else {
      entry.title = entry.id;
    }
  }
  return { bundled, entries };
};

// NAVM：BE16 记录总数 + 先序记录树
const parseNavm = (data: Uint8Array): DjvuOutlineNode[] => {
  const total = readUint16BE(data, 0);
  let pos = 2;
  let remaining = total;
  const readRecord = (): DjvuOutlineNode => {
    if (pos >= data.length) {
      throw new Error("Invalid DjVu document: NAVM truncated");
    }
    remaining -= 1;
    const children = data[pos++];
    const descLength = readUint24BE(data, pos);
    pos += 3;
    const label = decodeUtf8(data.subarray(pos, pos + descLength));
    pos += descLength;
    const urlLength = readUint24BE(data, pos);
    pos += 3;
    const href = decodeUtf8(data.subarray(pos, pos + urlLength));
    pos += urlLength;
    const node: DjvuOutlineNode = { label, href, pageIndex: -1, children: [] };
    for (let i = 0; i < children; i++) {
      node.children.push(readRecord());
    }
    return node;
  };
  const roots: DjvuOutlineNode[] = [];
  while (remaining > 0) {
    roots.push(readRecord());
  }
  return roots;
};

export class DjvuFile {
  private data: Uint8Array;
  private root: IffChunk;
  private entries: DjvuDirEntry[] = [];
  private pageEntries: DjvuDirEntry[] = [];
  private bundled = false;
  private outlineCache: DjvuOutlineNode[] | null | undefined = undefined;
  private pageCache: Map<number, DjvuPage> = new Map();
  private textCache: Map<number, DjvuTextLayer> = new Map();
  private annotationCache: Map<number, DjvuAnnotationSet> = new Map();
  private thumbnailChunks: IffChunk[] | null = null;

  metadata: DjvuMetadata = {
    title: "",
    author: "",
    description: "",
    publisher: "",
    language: "",
    identifier: "",
  };

  private constructor(data: Uint8Array, root: IffChunk) {
    this.data = data;
    this.root = root;
  }

  static async open(buffer: ArrayBuffer): Promise<DjvuFile> {
    const data = new Uint8Array(buffer);
    const root = readTopLevelForm(data);
    const file = new DjvuFile(data, root);
    file.init();
    return file;
  }

  get pageCount(): number {
    return this.pageEntries.length;
  }

  get isBundled(): boolean {
    return this.bundled;
  }

  // 原始文件数据（页面解码器需要）
  getData(): Uint8Array {
    return this.data;
  }

  private init() {
    if (this.root.form === "DJVU") {
      // 单页文档：页面 chunk 即根 FORM 的子 chunk
      const children = parseFormChildren(this.data, this.root);
      const info = this.readInfo(children);
      this.pageEntries = [
        {
          id: "page.djvu",
          name: "page.djvu",
          title: "page.djvu",
          size: this.root.length,
          offset: 0,
          flags: FILE_TYPE_PAGE,
          type: FILE_TYPE_PAGE,
          chunk: this.root,
        },
      ];
      this.pageCache.set(0, {
        index: 0,
        id: "page.djvu",
        title: "page.djvu",
        info,
        chunks: children,
        includedChunks: [],
      });
      return;
    }
    if (this.root.form !== "DJVM") {
      throw new Error(
        "Invalid DjVu file: unsupported FORM type " + (this.root.form || "?")
      );
    }
    const children = parseFormChildren(this.data, this.root);
    const forms: IffChunk[] = [];
    let dirmChunk: IffChunk | null = null;
    let navmChunk: IffChunk | null = null;
    for (const child of children) {
      if (child.id === "FORM") forms.push(child);
      else if (child.id === "DIRM") dirmChunk = child;
      else if (child.id === "NAVM") navmChunk = child;
    }
    if (!dirmChunk) {
      throw new Error("Invalid DjVu document: DIRM chunk not found");
    }
    const dirm = parseDirm(chunkData(this.data, dirmChunk));
    if (!dirm.bundled) {
      throw new Error("DjVu: 间接多页文档（多文件）暂不支持");
    }
    this.bundled = true;
    this.entries = dirm.entries;
    // 按 DIRM 偏移匹配物理 chunk；偏移不可用时退化为物理顺序
    const byOffset = new Map<number, IffChunk>();
    for (const form of forms) byOffset.set(form.start, form);
    this.entries.forEach((entry, index) => {
      entry.chunk = byOffset.get(entry.offset) || forms[index] || null;
    });
    this.pageEntries = this.entries.filter((e) => e.type === FILE_TYPE_PAGE);
    if (this.pageEntries.length === 0) {
      throw new Error("Invalid DjVu document: no pages found");
    }
    if (navmChunk) {
      const outline = parseNavm(bzzDecode(chunkData(this.data, navmChunk)));
      for (const node of outline) this.resolveOutlinePages(node);
      this.outlineCache = outline;
    } else {
      this.outlineCache = null;
    }
  }

  private readInfo(chunks: IffChunk[]): DjvuPageInfo {
    const infoChunk = chunks.find((c) => c.id === "INFO");
    if (!infoChunk) {
      throw new Error("Invalid DjVu page: INFO chunk not found");
    }
    return parseInfo(chunkData(this.data, infoChunk));
  }

  private resolveOutlinePages(node: DjvuOutlineNode) {
    node.pageIndex = this.resolvePageIndex(node.href);
    for (const child of node.children) this.resolveOutlinePages(child);
  }

  // 把 DjVu 注释/大纲中的 URL 解析为页索引（找不到返回 -1）
  resolvePageIndex(url: string): number {
    if (!url) return -1;
    let fileId = url;
    if (fileId.startsWith("#")) {
      fileId = fileId.substring(1);
      const hash = fileId.indexOf("#");
      if (hash >= 0) fileId = fileId.substring(0, hash);
    } else {
      fileId = fileId.split("#")[0];
      const slash = Math.max(fileId.lastIndexOf("/"), fileId.lastIndexOf("\\"));
      if (slash >= 0) fileId = fileId.substring(slash + 1);
    }
    if (!fileId) return -1;
    // "#1"、"#2" 形式的页码引用（1 起）
    if (/^\d+$/.test(fileId)) {
      const pageNumber = parseInt(fileId, 10);
      if (pageNumber >= 1 && pageNumber <= this.pageEntries.length) {
        return pageNumber - 1;
      }
      return -1;
    }
    for (let i = 0; i < this.pageEntries.length; i++) {
      const entry = this.pageEntries[i];
      if (entry.id === fileId || entry.name === fileId) return i;
    }
    for (let i = 0; i < this.entries.length; i++) {
      const entry = this.entries[i];
      if (
        (entry.id === fileId || entry.name === fileId) &&
        entry.type === FILE_TYPE_PAGE
      ) {
        return this.pageEntries.indexOf(entry);
      }
    }
    return -1;
  }

  getPageInfo(index: number): DjvuPageInfo {
    return this.getPage(index).info;
  }

  getPage(index: number): DjvuPage {
    const cached = this.pageCache.get(index);
    if (cached) return cached;
    const entry = this.pageEntries[index];
    if (!entry || !entry.chunk) {
      throw new Error("DjVu: page " + index + " not found");
    }
    const chunks = parseFormChildren(this.data, entry.chunk);
    const info = this.readInfo(chunks);
    const includedChunks: IffChunk[] = [];
    for (const chunk of chunks) {
      if (chunk.id !== "INCL") continue;
      const fileId = decodeUtf8(chunkData(this.data, chunk)).replace(
        /\0+$/,
        ""
      );
      const shared = this.entries.find(
        (e) => e.id === fileId || e.name === fileId
      );
      if (shared && shared.chunk) {
        includedChunks.push(...parseFormChildren(this.data, shared.chunk));
      }
    }
    const page: DjvuPage = {
      index,
      id: entry.id,
      title: entry.title || entry.id,
      info,
      chunks,
      includedChunks,
    };
    this.pageCache.set(index, page);
    return page;
  }

  getThumbnailChunks(): IffChunk[] {
    if (this.thumbnailChunks) return this.thumbnailChunks;
    const result: IffChunk[] = [];
    if (this.bundled) {
      for (const entry of this.entries) {
        if (entry.type !== FILE_TYPE_THUMBNAILS || !entry.chunk) continue;
        for (const child of parseFormChildren(this.data, entry.chunk)) {
          if (child.id === "TH44") result.push(child);
        }
      }
    }
    this.thumbnailChunks = result;
    return result;
  }

  // 解码第 index 张缩略图（TH44，IW44 编码）；没有缩略图时返回 null
  getThumbnailPixmap(index = 0): IW44Pixmap | null {
    const chunks = this.getThumbnailChunks();
    if (chunks.length === 0) return null;
    const chunk = chunks[Math.min(index, chunks.length - 1)];
    try {
      return decodeIW44(chunkData(this.data, chunk));
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  private textChunksOf(page: DjvuPage): { chunk: IffChunk; compressed: boolean }[] {
    const pick = (
      chunks: IffChunk[]
    ): { chunk: IffChunk; compressed: boolean }[] => {
      const list: { chunk: IffChunk; compressed: boolean }[] = [];
      for (const chunk of chunks) {
        if (chunk.id === "TXTz") list.push({ chunk, compressed: true });
        else if (chunk.id === "TXTa") list.push({ chunk, compressed: false });
      }
      return list;
    };
    const own = pick(page.chunks);
    return own.length > 0 ? own : pick(page.includedChunks);
  }

  getPageTextLayer(index: number): DjvuTextLayer {
    const cached = this.textCache.get(index);
    if (cached) return cached;
    const page = this.getPage(index);
    let layer: DjvuTextLayer = { text: "", zones: [] };
    // 与其他解码器一致：最后一个文本 chunk 生效
    for (const { chunk, compressed } of this.textChunksOf(page)) {
      try {
        layer = decodeTextChunk(chunkData(this.data, chunk), compressed);
      } catch (error) {
        console.error(error);
      }
    }
    // area 坐标（zone 与注释）在文件里是自下而上的，对外统一转换到左上原点
    for (const zone of layer.zones) {
      this.flipZoneToTopOrigin(zone, page.info.height);
    }
    this.textCache.set(index, layer);
    return layer;
  }

  private flipZoneToTopOrigin(zone: DjvuTextZone, pageHeight: number): void {
    zone.y = pageHeight - (zone.y + zone.height);
    for (const child of zone.children) {
      this.flipZoneToTopOrigin(child, pageHeight);
    }
  }

  getPageText(index: number): string {
    return this.getPageTextLayer(index).text;
  }

  getPageTextZones(index: number): DjvuTextZone[] {
    return this.getPageTextLayer(index).zones;
  }

  getAnnotationSet(index: number): DjvuAnnotationSet {
    const cached = this.annotationCache.get(index);
    if (cached) return cached;
    const page = this.getPage(index);
    // 规范 §8.3.4：拼接本页与共享文件中的所有注释文本
    let text = "";
    const collect = (chunks: IffChunk[]) => {
      for (const chunk of chunks) {
        if (chunk.id === "ANTz") {
          text += decodeUtf8(bzzDecode(chunkData(this.data, chunk)));
        } else if (chunk.id === "ANTa") {
          text += decodeUtf8(chunkData(this.data, chunk));
        }
      }
    };
    collect(page.includedChunks);
    collect(page.chunks);
    const set = parseAnnotations(text);
    // 注释的矩形同样自下而上，转换到左上原点
    for (const annotation of set.annotations) {
      const shape = annotation.shape;
      if (!shape) continue;
      shape.y = page.info.height - (shape.y + shape.height);
      if (shape.kind === "poly" && shape.points) {
        for (let i = 1; i < shape.points.length; i += 2) {
          shape.points[i] = page.info.height - shape.points[i];
        }
      }
    }
    this.annotationCache.set(index, set);
    return set;
  }

  getAnnotations(index: number): DjvuAnnotation[] {
    return this.getAnnotationSet(index).annotations;
  }

  getOutline(): DjvuOutlineNode[] | null {
    return this.outlineCache || null;
  }

  // 文档级元数据：优先取注释中的 (metadata "...")，否则留空（由调用方回退到文件名）
  applyMetadataFromAnnotations(): void {
    if (this.metadata.title || this.pageCount === 0) return;
    try {
      const set = this.getAnnotationSet(0);
      if (set.metadata) {
        const fields = extractMetadataFields(set.metadata);
        this.metadata.title = fields.title || "";
        this.metadata.author = fields.author || "";
        this.metadata.description = fields.description || "";
        this.metadata.publisher = fields.publisher || "";
        this.metadata.language = fields.language || "";
      }
    } catch (error) {
      console.error(error);
    }
  }

  search(keyword: string): DjvuSearchResult[] {
    const results: DjvuSearchResult[] = [];
    if (!keyword) return results;
    const needle = keyword.toLowerCase();
    for (let i = 0; i < this.pageCount; i++) {
      let text = "";
      try {
        text = this.getPageText(i);
      } catch (error) {
        continue;
      }
      const haystack = text.toLowerCase();
      let from = 0;
      let found = haystack.indexOf(needle, from);
      while (found >= 0) {
        const start = Math.max(0, found - 30);
        const end = Math.min(text.length, found + keyword.length + 30);
        const excerpt =
          (start > 0 ? "..." : "") +
          text.substring(start, end).replace(/\s+/g, " ") +
          (end < text.length ? "..." : "");
        results.push({ pageIndex: i, excerpt });
        from = found + needle.length;
        found = haystack.indexOf(needle, from);
        if (results.length >= 200) return results;
      }
    }
    return results;
  }
}
