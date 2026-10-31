// DjVu 隐藏文本（TXTa/TXTz）与注释（ANTa/ANTz）解析。
// 规范 §8.3.4/§8.3.5：
//   - 文本块：BE24 文本长度 + UTF-8 文本 + 版本字节(1) + 分层 zone 树
//   - zone：类型字节 + x/y/width/height + text_start/text_length + BE24 子节点数
//     坐标以 0x8000 为零点偏移，并相对前一个兄弟/父节点编码（矩形为半开区间：
//     xmax = x + width）；文本偏移同样相对前一个兄弟/父节点累加
//   - 注释为 S 表达式：(maparea <url> <comment> (<shape> ...) ...)、
//     (background #rrggbb)、(zoom ...)、(mode ...)、(align ...)、(metadata "...")
import { readUint24BE, readUint16BE, decodeUtf8 } from "./iff";
import { bzzDecode } from "./bzz";

export type DjvuTextZoneType =
  | "page"
  | "column"
  | "region"
  | "paragraph"
  | "line"
  | "word"
  | "character";

// 文本 zone。注意：文件里的 zone 坐标是自下而上的（与其他 DjVu 图像数据一致），
// DjvuFile.getPageTextZones() 已统一转换为左上原点，叠加到页面上时无需再翻转。
export interface DjvuTextZone {
  type: DjvuTextZoneType;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  children: DjvuTextZone[];
}

export interface DjvuTextLayer {
  text: string;
  // 页面 zone 的直接子节点（列/区域/段落），叶子节点为词/字符
  zones: DjvuTextZone[];
}

export interface DjvuAnnotationShape {
  kind: "rect" | "oval" | "poly";
  x: number;
  y: number;
  width: number;
  height: number;
  points?: number[];
}

export interface DjvuAnnotation {
  type: "link" | "region";
  url: string;
  target: string;
  comment: string;
  shape: DjvuAnnotationShape;
}

export interface DjvuAnnotationSet {
  annotations: DjvuAnnotation[];
  background?: string;
  zoom?: string | number;
  mode?: string;
  align?: string;
  metadata?: string;
}

const ZONE_TYPES: DjvuTextZoneType[] = [
  "page",
  "column",
  "region",
  "paragraph",
  "line",
  "word",
  "character",
];

// PAGE / PARAGRAPH / LINE 使用左下角相对定位，其余（COLUMN/WORD/CHARACTER）使用右下角
const isBlockZone = (typeCode: number): boolean =>
  typeCode === 1 || typeCode === 4 || typeCode === 5;

class ByteView {
  data: Uint8Array;
  offset: number;

  constructor(data: Uint8Array, offset: number) {
    this.data = data;
    this.offset = offset;
  }

  read8(): number {
    if (this.offset >= this.data.length) throw new Error("DjVu text: EOF");
    return this.data[this.offset++];
  }

  read16(): number {
    if (this.offset + 2 > this.data.length) throw new Error("DjVu text: EOF");
    const value = readUint16BE(this.data, this.offset);
    this.offset += 2;
    return value;
  }

  read24(): number {
    if (this.offset + 3 > this.data.length) throw new Error("DjVu text: EOF");
    const value = readUint24BE(this.data, this.offset);
    this.offset += 3;
    return value;
  }
}

interface ZoneRect {
  x: number;
  y: number;
  width: number;
  height: number;
  xmax: number;
  ymax: number;
}

interface DecodedZone {
  zone: DjvuTextZone;
  rect: ZoneRect;
  textStart: number;
  textLength: number;
}

const decodeZone = (
  view: ByteView,
  fullText: string,
  maxText: number,
  parent: { rect: ZoneRect; textStart: number } | null,
  prev: DecodedZone | null
): DecodedZone => {
  const typeCode = view.read8();
  if (typeCode < 1 || typeCode > 7) {
    throw new Error("DjVu text: corrupt zone type");
  }
  let x = view.read16() - 0x8000;
  let y = view.read16() - 0x8000;
  const width = view.read16() - 0x8000;
  const height = view.read16() - 0x8000;
  let textStart = view.read16() - 0x8000;
  const textLength = view.read24();

  if (prev) {
    if (isBlockZone(typeCode)) {
      x = x + prev.rect.x;
      y = prev.rect.y - (y + height);
    } else {
      x = x + prev.rect.xmax;
      y = y + prev.rect.y;
    }
    textStart += prev.textStart + prev.textLength;
  } else if (parent) {
    x = x + parent.rect.x;
    y = parent.rect.ymax - (y + height);
    textStart += parent.textStart;
  }

  const rect: ZoneRect = {
    x,
    y,
    width,
    height,
    xmax: x + width,
    ymax: y + height,
  };
  if (rect.xmax <= rect.x || rect.ymax <= rect.y) {
    throw new Error("DjVu text: empty zone");
  }
  if (textStart < 0 || textStart + textLength > maxText) {
    throw new Error("DjVu text: corrupt zone text range");
  }

  const childCount = view.read24();
  const zone: DjvuTextZone = {
    type: ZONE_TYPES[typeCode - 1],
    x,
    y,
    width: Math.max(0, width),
    height: Math.max(0, height),
    text: fullText.substring(textStart, textStart + textLength),
    children: [],
  };
  let prevChild: DecodedZone | null = null;
  for (let i = 0; i < childCount; i++) {
    const child = decodeZone(view, fullText, maxText, { rect, textStart }, prevChild);
    zone.children.push(child.zone);
    prevChild = child;
  }
  return { zone, rect, textStart, textLength };
};

// 解析 DjVuTXT 数据（TXTa 原文或 TXTz 解压后的内容）
export const decodeDjVuText = (data: Uint8Array): DjvuTextLayer => {
  if (data.length < 3) return { text: "", zones: [] };
  const textSize = readUint24BE(data, 0);
  if (textSize + 3 > data.length) {
    throw new Error("DjVu text: corrupt chunk");
  }
  const text = decodeUtf8(data.subarray(3, 3 + textSize));
  const layer: DjvuTextLayer = { text, zones: [] };
  // 版本字节（当前为 1）；老文件可能没有 zone 数据
  if (3 + textSize >= data.length) return layer;
  const view = new ByteView(data, 3 + textSize + 1);
  try {
    const root = decodeZone(view, text, textSize, null, null);
    layer.zones = root.zone.children;
  } catch (error) {
    // zone 结构损坏时退化为纯文本
    console.error(error);
  }
  return layer;
};

export const decodeTextChunk = (
  data: Uint8Array,
  compressed: boolean
): DjvuTextLayer => {
  return decodeDjVuText(compressed ? bzzDecode(data) : data);
};

export const flattenTextZones = (zones: DjvuTextZone[]): DjvuTextZone[] => {
  const result: DjvuTextZone[] = [];
  const walk = (list: DjvuTextZone[]) => {
    for (const zone of list) {
      if (zone.children.length > 0) {
        walk(zone.children);
      } else {
        result.push(zone);
      }
    }
  };
  walk(zones);
  return result;
};

// ---------------------------------------------------------------------------
// 注释（ANTa/ANTz）：S 表达式解析
// ---------------------------------------------------------------------------

type SExpr = string | number | SExpr[];

interface TokenState {
  text: string;
  pos: number;
}

const skipSpace = (state: TokenState) => {
  while (state.pos < state.text.length) {
    const c = state.text[state.pos];
    if (c === " " || c === "\t" || c === "\r" || c === "\n") state.pos++;
    else break;
  }
};

const parseStringToken = (state: TokenState): string => {
  const quote = state.text[state.pos++];
  let result = "";
  while (state.pos < state.text.length) {
    const c = state.text[state.pos++];
    if (c === quote) break;
    if (c === "\\" && state.pos < state.text.length) {
      const next = state.text[state.pos++];
      if (next === "n") result += "\n";
      else if (next === "r") result += "\r";
      else if (next === "t") result += "\t";
      else result += next;
    } else {
      result += c;
    }
  }
  return result;
};

const parseAtom = (state: TokenState): string | number => {
  let token = "";
  while (state.pos < state.text.length) {
    const c = state.text[state.pos];
    if (
      c === " " ||
      c === "\t" ||
      c === "\r" ||
      c === "\n" ||
      c === "(" ||
      c === ")" ||
      c === '"'
    ) {
      break;
    }
    token += c;
    state.pos++;
  }
  if (/^-?\d+$/.test(token)) return parseInt(token, 10);
  if (/^-?\d*\.\d+$/.test(token)) return parseFloat(token);
  return token;
};

const parseList = (state: TokenState): SExpr[] => {
  const items: SExpr[] = [];
  for (;;) {
    skipSpace(state);
    if (state.pos >= state.text.length) break;
    const c = state.text[state.pos];
    if (c === ")") {
      state.pos++;
      break;
    }
    if (c === "(") {
      state.pos++;
      items.push(parseList(state));
    } else if (c === '"' || c === "'") {
      items.push(parseStringToken(state));
    } else {
      const atom = parseAtom(state);
      if (atom === "") {
        // 未知字符（如孤立的 #），跳过避免死循环
        state.pos++;
      } else {
        items.push(atom);
      }
    }
  }
  return items;
};

const itemName = (item: SExpr): string =>
  Array.isArray(item) && item.length > 0 && typeof item[0] === "string"
    ? item[0]
    : "";

const itemStrings = (item: SExpr): string[] =>
  Array.isArray(item) ? (item.filter((i) => typeof i === "string") as string[]) : [];

const itemNumbers = (item: SExpr): number[] =>
  Array.isArray(item) ? (item.filter((i) => typeof i === "number") as number[]) : [];

export const parseAnnotations = (text: string): DjvuAnnotationSet => {
  const result: DjvuAnnotationSet = { annotations: [] };
  if (!text || !text.trim()) return result;
  const state: TokenState = { text, pos: 0 };
  let items: SExpr[] = [];
  try {
    items = parseList(state);
  } catch (error) {
    console.error(error);
    return result;
  }
  for (const item of items) {
    const name = itemName(item);
    if (name === "maparea") {
      // (maparea <url|("url" "..." "target")> <comment> (<shape> ...) ...)
      const list = item as SExpr[];
      let url = "";
      let target = "_self";
      const urlItem = list[1];
      if (Array.isArray(urlItem) && itemName(urlItem) === "url") {
        const values = itemStrings(urlItem);
        url = values[1] || values[0] || "";
        target = values[2] || "_self";
      } else if (typeof urlItem === "string") {
        url = urlItem;
      }
      const comment = typeof list[2] === "string" ? list[2] : "";
      const shapeItem = list[3];
      const shapeName = itemName(shapeItem);
      let shape: DjvuAnnotationShape | null = null;
      if (shapeName === "rect" || shapeName === "oval") {
        const nums = itemNumbers(shapeItem);
        if (nums.length >= 4) {
          shape = {
            kind: shapeName,
            x: nums[0],
            y: nums[1],
            width: nums[2],
            height: nums[3],
          };
        }
      } else if (shapeName === "poly") {
        const nums = itemNumbers(shapeItem);
        if (nums.length >= 4 && nums.length % 2 === 0) {
          let minX = nums[0];
          let minY = nums[1];
          let maxX = nums[0];
          let maxY = nums[1];
          for (let i = 0; i < nums.length; i += 2) {
            minX = Math.min(minX, nums[i]);
            minY = Math.min(minY, nums[i + 1]);
            maxX = Math.max(maxX, nums[i]);
            maxY = Math.max(maxY, nums[i + 1]);
          }
          shape = {
            kind: "poly",
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
            points: nums,
          };
        }
      }
      if (shape) {
        result.annotations.push({ type: "link", url, target, comment, shape });
      }
    } else if (name === "background") {
      const values = itemStrings(item);
      if (values[1]) result.background = values[1];
    } else if (name === "zoom") {
      const list = item as SExpr[];
      if (typeof list[1] === "number" || typeof list[1] === "string") {
        result.zoom = list[1];
      }
    } else if (name === "mode") {
      const values = itemStrings(item);
      if (values[1]) result.mode = values[1];
    } else if (name === "align" || name === "halign" || name === "valign") {
      const values = itemStrings(item);
      if (values[1]) result.align = values[1];
    } else if (name === "metadata") {
      const values = itemStrings(item);
      if (values[1]) result.metadata = values[1];
    }
  }
  return result;
};

export const decodeAnnotationChunk = (
  data: Uint8Array,
  compressed: boolean
): DjvuAnnotationSet => {
  return parseAnnotations(decodeUtf8(compressed ? bzzDecode(data) : data));
};

// 从注释元数据字符串中尽力提取常见字段（XMP/普通 XML 片段）
export const extractMetadataFields = (
  metadata: string
): {
  title?: string;
  author?: string;
  description?: string;
  publisher?: string;
  language?: string;
} => {
  const pick = (tag: string): string | undefined => {
    const patterns = [
      new RegExp("<" + tag + "[^>]*>([\\s\\S]*?)</" + tag + ">", "i"),
      new RegExp(tag + "\\s*=\\s*\"([^\"]*)\"", "i"),
    ];
    for (const pattern of patterns) {
      const match = metadata.match(pattern);
      if (match) return match[1].trim();
    }
    return undefined;
  };
  return {
    title: pick("dc:title") || pick("title"),
    author: pick("dc:creator") || pick("creator") || pick("author"),
    description: pick("dc:description") || pick("description"),
    publisher: pick("dc:publisher") || pick("publisher"),
    language: pick("dc:language") || pick("language"),
  };
};
