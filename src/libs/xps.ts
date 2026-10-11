import JSZip from "jszip";

// XPS/OXPS 解析与渲染，解析流程参考 GNOME libgxps：
//   gxps-file.c      包关系(_rels/.rels) → FixedDocumentSequence
//   gxps-document.c  FixedDocumentSequence → FixedDocument → FixedPage 列表
//   gxps-page.c      FixedPage 内容树（Canvas/Path/Glyphs）与资源字典
//   gxps-path.c      Path Data 迷你语言 / PathGeometry 解析
//   gxps-glyphs.c    Glyphs 与 Indices 解析
//   gxps-fonts.c     odttf 字体反混淆（GUID 派生密钥 XOR 前 32 字节）
//   gxps-brush.c     画刷（纯色/图像/渐变）解析
//   gxps-resources.c 资源字典（本地与 Source 引用）
// 与 libgxps 用 Cairo 绘制不同，这里把页面转换为 SVG 由浏览器渲染。

const REL_FIXED_REPRESENTATION = [
  "http://schemas.microsoft.com/xps/2005/06/fixedrepresentation",
  "http://schemas.openxps.org/oxps/v1.0/fixedrepresentation",
];
const REL_THUMBNAIL =
  "http://schemas.openxmlformats.org/package/2006/relationships/metadata/thumbnail";
const REL_CORE_PROPERTIES =
  "http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties";

const DEFAULT_PAGE_WIDTH = 816;
const DEFAULT_PAGE_HEIGHT = 1056;

export interface XpsColor {
  a: number;
  r: number;
  g: number;
  b: number;
}

export interface XpsGradientStop {
  offset: number;
  color: XpsColor;
}

export interface XpsSolidBrush {
  type: "solid";
  color: XpsColor;
  opacity: number;
}

export interface XpsImageBrush {
  type: "image";
  imageUri: string;
  opacity: number;
  transform?: number[][];
  viewport?: number[];
  viewportUnits?: string;
  viewbox?: number[];
  viewboxUnits?: string;
  tileMode?: string;
}

export interface XpsGradientBrushBase {
  opacity: number;
  transform?: number[][];
  spreadMethod?: string;
  stops: XpsGradientStop[];
}

export interface XpsLinearGradientBrush extends XpsGradientBrushBase {
  type: "linear";
  startPoint?: number[];
  endPoint?: number[];
}

export interface XpsRadialGradientBrush extends XpsGradientBrushBase {
  type: "radial";
  gradientOrigin?: number[];
  center?: number[];
  radiusX?: number;
  radiusY?: number;
}

export type XpsGradientBrush = XpsLinearGradientBrush | XpsRadialGradientBrush;

export type XpsBrush = XpsSolidBrush | XpsImageBrush | XpsGradientBrush;

export interface XpsClip {
  d: string;
  fillRule: "evenodd" | "nonzero";
}

export interface XpsBaseElement {
  opacity?: number;
  transform?: number[][];
  clip?: XpsClip | null;
}

export interface XpsPathElement extends XpsBaseElement {
  type: "path";
  data: string;
  fillRule: "evenodd" | "nonzero";
  fill?: XpsBrush | null;
  stroke?: XpsBrush | null;
  strokeThickness?: number;
  strokeDashArray?: number[];
  strokeDashOffset?: number;
  strokeLineCap?: string;
  strokeLineJoin?: string;
  strokeMiterLimit?: number;
}

export interface XpsGlyphsElement extends XpsBaseElement {
  type: "glyphs";
  fontUri: string;
  fontSize: number;
  originX: number;
  originY: number;
  text: string;
  resolvedText: string;
  indices?: string;
  fill?: XpsBrush | null;
  bidiLevel: number;
  isSideways: boolean;
  italic: boolean;
  bold: boolean;
}

export interface XpsCanvasElement extends XpsBaseElement {
  type: "canvas";
  children: XpsElement[];
}

export type XpsElement = XpsPathElement | XpsGlyphsElement | XpsCanvasElement;

export interface XpsPage {
  source: string;
  width: number;
  height: number;
  lang?: string;
  elements: XpsElement[];
}

export interface XpsMetadata {
  title: string;
  author: string;
  description: string;
  publisher: string;
  language: string;
  identifier: string;
}

interface XpsPageSource {
  source: string;
  width: number;
  height: number;
}

interface XpsHost {
  readXmlText(path: string): Promise<string | null>;
}

const parseXml = (text: string): Document => {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) {
    throw new Error("Invalid XML content");
  }
  return doc;
};

const elementChildren = (el: Element): Element[] => {
  const result: Element[] = [];
  const nodes = el.childNodes;
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].nodeType === 1) {
      result.push(nodes[i] as Element);
    }
  }
  return result;
};

const findElements = (root: Element, localName: string): Element[] => {
  const result: Element[] = [];
  const walk = (el: Element) => {
    for (const child of elementChildren(el)) {
      if (child.localName === localName) {
        result.push(child);
      }
      walk(child);
    }
  };
  walk(root);
  return result;
};

const attrFloat = (el: Element, name: string): number | null => {
  const value = el.getAttribute(name);
  if (value === null || value.trim() === "") return null;
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
};

const attrBool = (el: Element, name: string, defaultValue: boolean): boolean => {
  const value = el.getAttribute(name);
  if (value === "true") return true;
  if (value === "false") return false;
  return defaultValue;
};

const parsePoint = (value: string): number[] | null => {
  if (!value) return null;
  const index = value.lastIndexOf(",");
  if (index < 0) return null;
  const x = parseFloat(value.slice(0, index));
  const y = parseFloat(value.slice(index + 1));
  if (isNaN(x) || isNaN(y)) return null;
  return [x, y];
};

const parsePoints = (value: string): number[][] => {
  const result: number[][] = [];
  if (!value) return result;
  for (const item of value.split(" ")) {
    if (!item) continue;
    const point = parsePoint(item);
    if (point) result.push(point);
  }
  return result;
};

const parseBox = (value: string): number[] | null => {
  if (!value) return null;
  const parts = value.split(",");
  if (parts.length !== 4) return null;
  const nums = parts.map((part) => parseFloat(part));
  if (nums.some((num) => isNaN(num))) return null;
  return nums;
};

const parseMatrix = (value: string): number[] | null => {
  if (!value) return null;
  const parts = value.split(",");
  if (parts.length !== 6) return null;
  const nums = parts.map((part) => parseFloat(part));
  if (nums.some((num) => isNaN(num))) return null;
  return nums;
};

const parseDashArray = (value: string): number[] | null => {
  if (!value) return null;
  const parts = value.trim().split(" ");
  const nums: number[] = [];
  for (const part of parts) {
    if (part === "") continue;
    const num = parseFloat(part);
    if (isNaN(num) || num < 0) return null;
    nums.push(num);
  }
  return nums.length > 0 ? nums : null;
};

const extractStaticResource = (value: string): string | null => {
  const match = /^\s*\{StaticResource\s+([^}]+)\}\s*$/.exec(value);
  return match ? match[1].trim() : null;
};

const canonicalizePath = (path: string): string => {
  const stack: string[] = [];
  for (const part of path.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (stack.length > 0) stack.pop();
      continue;
    }
    stack.push(part);
  }
  return "/" + stack.join("/");
};

// 对应 gxps-parse-utils.c 的 gxps_resolve_relative_path
const resolveRelativePath = (source: string, target: string): string => {
  if (!target) return "";
  if (target.charAt(0) === "/") return target;
  const index = source.lastIndexOf("/");
  const dir = index >= 0 ? source.slice(0, index) : "";
  return canonicalizePath(dir + "/" + target);
};

const normalizePartName = (path: string): string =>
  path.replace(/^\//, "").toLowerCase();

const round = (value: number): number => {
  if (!isFinite(value)) return 0;
  return Math.round(value * 1000) / 1000;
};

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const escapeXmlAttr = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const escapeXmlText = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const decodeUtf16 = (bytes: Uint8Array, littleEndian: boolean): string => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let result = "";
  for (let i = 0; i + 1 < view.byteLength; i += 2) {
    result += String.fromCharCode(view.getUint16(i, littleEndian));
  }
  return result;
};

const decodeXmlText = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return decodeUtf16(bytes.subarray(2), true);
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return decodeUtf16(bytes.subarray(2), false);
  }
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xef &&
    bytes[1] === 0xbb &&
    bytes[2] === 0xbf
  ) {
    return new TextDecoder("utf-8").decode(bytes.subarray(3));
  }
  return new TextDecoder("utf-8").decode(bytes);
};

const MIME_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  jpe: "image/jpeg",
  jfif: "image/jpeg",
  gif: "image/gif",
  bmp: "image/bmp",
  webp: "image/webp",
  svg: "image/svg+xml",
  tif: "image/tiff",
  tiff: "image/tiff",
  wdp: "image/vnd.ms-photo",
  hdp: "image/vnd.ms-photo",
  wmf: "image/wmf",
  emf: "image/emf",
  ico: "image/x-icon",
};

const mimeFromPath = (path: string): string => {
  const index = path.lastIndexOf(".");
  const ext = index >= 0 ? path.slice(index + 1).toLowerCase() : "";
  return MIME_TYPES[ext] || "application/octet-stream";
};

// 对应 gxps-brush.c 的 gxps_color_parse / gxps_color_s_rgb_parse / gxps_color_sc_rgb_parse
const parseColor = (value: string): XpsColor | null => {
  if (!value) return null;
  const str = value.trim();
  if (str.charAt(0) === "#") {
    const hex = str.slice(1);
    if (hex.length === 6 || hex.length === 8) {
      const nums: number[] = [];
      for (let i = 0; i < hex.length; i += 2) {
        const num = parseInt(hex.slice(i, i + 2), 16);
        if (isNaN(num)) return null;
        nums.push(num);
      }
      if (nums.length === 3) {
        return { a: 1, r: nums[0] / 255, g: nums[1] / 255, b: nums[2] / 255 };
      }
      return {
        a: nums[0] / 255,
        r: nums[1] / 255,
        g: nums[2] / 255,
        b: nums[3] / 255,
      };
    }
    return null;
  }
  if (str.indexOf("sc#") === 0) {
    const parts = str.slice(3).split(",").map((part) => parseFloat(part));
    if (parts.some((num) => isNaN(num))) return null;
    if (parts.length === 4) {
      return { a: parts[0], r: parts[1], g: parts[2], b: parts[3] };
    }
    if (parts.length === 3) {
      return { a: 1, r: parts[0], g: parts[1], b: parts[2] };
    }
    return null;
  }
  if (str.indexOf("ContextColor") === 0) {
    // ContextColor 依赖 ICC 配置文件，libgxps 用 lcms 转换；
    // 这里按通道值近似为 sRGB
    const spaceIndex = str.indexOf(" ");
    if (spaceIndex < 0) return null;
    const parts = str
      .slice(spaceIndex + 1)
      .split(",")
      .map((part) => parseFloat(part));
    if (parts.some((num) => isNaN(num))) return null;
    if (parts.length >= 4) {
      return { a: parts[0], r: parts[1], g: parts[2], b: parts[3] };
    }
    if (parts.length === 2) {
      return { a: parts[0], r: parts[1], g: parts[1], b: parts[1] };
    }
    return null;
  }
  return null;
};

const colorToCss = (color: XpsColor, alphaScale = 1): string => {
  const r = Math.round(clamp01(color.r) * 255);
  const g = Math.round(clamp01(color.g) * 255);
  const b = Math.round(clamp01(color.b) * 255);
  const a = clamp01(color.a * alphaScale);
  return `rgba(${r},${g},${b},${round(a)})`;
};

const colorToRgb = (color: XpsColor): string => {
  const r = Math.round(clamp01(color.r) * 255);
  const g = Math.round(clamp01(color.g) * 255);
  const b = Math.round(clamp01(color.b) * 255);
  return `rgb(${r},${g},${b})`;
};

const spreadMethodValue = (value: string): string => {
  if (value === "Reflect") return "reflect";
  if (value === "Repeat") return "repeat";
  return "pad";
};

const lineCapValue = (value: string): string => {
  if (value === "Round") return "round";
  if (value === "Square") return "square";
  return "butt";
};

const lineJoinValue = (value: string): string => {
  if (value === "Round") return "round";
  if (value === "Bevel") return "bevel";
  return "miter";
};

interface PathDataResult {
  d: string;
  fillRule: "evenodd" | "nonzero";
  hasFillRule: boolean;
}

// 对应 gxps-path.c 的 gxps_path_parse：把 WPF Path Data 迷你语言转换为 SVG path d
const convertPathData = (data: string): PathDataResult => {
  const commands: string[] = [];
  let fillRule: "evenodd" | "nonzero" = "evenodd";
  let hasFillRule = false;
  let i = 0;
  const length = data.length;
  const skipSeparators = () => {
    while (
      i < length &&
      (data[i] === " " || data[i] === "\t" || data[i] === ",")
    ) {
      i++;
    }
  };
  const readNumber = (): number | null => {
    skipSeparators();
    const match = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(
      data.slice(i)
    );
    if (!match) return null;
    i += match[0].length;
    return parseFloat(match[0]);
  };
  const readNumbers = (count: number): number[] | null => {
    const values: number[] = [];
    for (let k = 0; k < count; k++) {
      const num = readNumber();
      if (num === null) return null;
      values.push(num);
    }
    return values;
  };
  const formatNumbers = (nums: number[]) => nums.map((n) => round(n)).join(" ");
  let command = "";
  while (i < length) {
    skipSeparators();
    if (i >= length) break;
    const ch = data[i];
    if (/[a-zA-Z]/.test(ch)) {
      command = ch;
      i++;
      if (command === "z" || command === "Z") {
        commands.push("Z");
        command = "";
      }
      continue;
    }
    if (!command) {
      i++;
      continue;
    }
    let nums: number[] | null = null;
    switch (command) {
      case "M":
      case "m":
        nums = readNumbers(2);
        if (nums) {
          commands.push(`${command} ${formatNumbers(nums)}`);
          command = command === "M" ? "L" : "l";
        }
        break;
      case "L":
      case "l":
        nums = readNumbers(2);
        if (nums) commands.push(`${command} ${formatNumbers(nums)}`);
        break;
      case "H":
      case "h":
        nums = readNumbers(1);
        if (nums) commands.push(`${command} ${round(nums[0])}`);
        break;
      case "V":
      case "v":
        nums = readNumbers(1);
        if (nums) commands.push(`${command} ${round(nums[0])}`);
        break;
      case "C":
      case "c":
        nums = readNumbers(6);
        if (nums) commands.push(`${command} ${formatNumbers(nums)}`);
        break;
      case "S":
      case "s":
        nums = readNumbers(4);
        if (nums) commands.push(`${command} ${formatNumbers(nums)}`);
        break;
      case "Q":
      case "q":
        nums = readNumbers(4);
        if (nums) commands.push(`${command} ${formatNumbers(nums)}`);
        break;
      case "T":
      case "t":
        nums = readNumbers(2);
        if (nums) commands.push(`${command} ${formatNumbers(nums)}`);
        break;
      case "A":
      case "a":
        nums = readNumbers(7);
        if (nums) commands.push(`${command} ${formatNumbers(nums)}`);
        break;
      case "F":
        nums = readNumbers(1);
        if (nums) {
          hasFillRule = true;
          fillRule = nums[0] === 0 ? "evenodd" : "nonzero";
        }
        command = "";
        break;
      default:
        command = "";
        i++;
        break;
    }
    if (nums === null && command !== "" && command !== "F") {
      command = "";
    }
  }
  return { d: commands.join(" "), fillRule, hasFillRule };
};

const isSfntFont = (bytes: Uint8Array): boolean => {
  if (bytes.length < 4) return false;
  if (bytes[0] === 0x00 && bytes[1] === 0x01 && bytes[2] === 0x00 && bytes[3] === 0x00) {
    return true;
  }
  const tag = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  return tag === "OTTO" || tag === "true" || tag === "ttcf";
};

// 对应 gxps-fonts.c 的 parse_guid：按 GUID 小端字段序取出 16 个字节
const parseGuid = (str: string): number[] | null => {
  const indexes = [6, 4, 2, 0, 11, 9, 16, 14, 19, 21, 24, 26, 28, 30, 32, 34];
  if (str.length <= 35) return null;
  const guid: number[] = [];
  for (let i = 0; i < 16; i++) {
    const pos = indexes[i];
    const high = parseInt(str.charAt(pos), 16);
    const low = parseInt(str.charAt(pos + 1), 16);
    if (isNaN(high) || isNaN(low)) return null;
    guid.push(high * 16 + low);
  }
  return guid;
};

// 对应 gxps-fonts.c 的 gxps_fonts_new_ft_face 反混淆逻辑
const deobfuscateFont = (bytes: Uint8Array, uri: string): boolean => {
  const baseName = uri.split("/").pop() || "";
  const guid = parseGuid(baseName);
  if (!guid || bytes.length < 32) return false;
  const mapping = [15, 14, 13, 12, 11, 10, 9, 8, 6, 7, 4, 5, 0, 1, 2, 3];
  for (let i = 0; i < 16; i++) {
    bytes[i] ^= guid[mapping[i]];
    bytes[i + 16] ^= guid[mapping[i]];
  }
  return true;
};

const readTag = (view: DataView, offset: number): string =>
  String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3)
  );

// 解析 TrueType/OpenType cmap（format 4/12），用于 Indices 缺少 UnicodeString 时
// 把 glyph index 还原为字符（libgxps 依赖 FreeType 完成同样的映射）
const parseCmap = (buffer: ArrayBuffer): Map<number, number> | null => {
  try {
    const view = new DataView(buffer);
    if (buffer.byteLength < 12) return null;
    let offset = 0;
    if (readTag(view, 0) === "ttcf") {
      offset = view.getUint32(12);
    }
    if (offset + 12 > buffer.byteLength) return null;
    const numTables = view.getUint16(offset + 4);
    let cmapOffset = -1;
    for (let i = 0; i < numTables; i++) {
      const record = offset + 12 + i * 16;
      if (record + 16 > buffer.byteLength) break;
      if (readTag(view, record) === "cmap") {
        cmapOffset = view.getUint32(record + 8);
        break;
      }
    }
    if (cmapOffset < 0 || cmapOffset + 4 > buffer.byteLength) return null;
    const numSubtables = view.getUint16(cmapOffset + 2);
    let bestOffset = -1;
    let bestScore = -1;
    for (let i = 0; i < numSubtables; i++) {
      const record = cmapOffset + 4 + i * 8;
      if (record + 8 > buffer.byteLength) break;
      const platformId = view.getUint16(record);
      const encodingId = view.getUint16(record + 2);
      const subOffset = cmapOffset + view.getUint32(record + 4);
      if (subOffset + 2 > buffer.byteLength) continue;
      const format = view.getUint16(subOffset);
      let score = 0;
      if (format === 12) score = 2;
      else if (format === 4) score = 1;
      else continue;
      if (platformId === 3 && encodingId === 10) score += 4;
      if (platformId === 3 && encodingId === 1) score += 3;
      if (score > bestScore) {
        bestScore = score;
        bestOffset = subOffset;
      }
    }
    if (bestOffset < 0) return null;
    const map = new Map<number, number>();
    const format = view.getUint16(bestOffset);
    if (format === 12) {
      if (bestOffset + 16 > buffer.byteLength) return null;
      const numGroups = view.getUint32(bestOffset + 12);
      for (let i = 0; i < numGroups; i++) {
        const group = bestOffset + 16 + i * 12;
        if (group + 12 > buffer.byteLength) break;
        const startChar = view.getUint32(group);
        const endChar = view.getUint32(group + 4);
        const startGid = view.getUint32(group + 8);
        if (endChar - startChar > 0x10ffff) continue;
        for (let c = startChar; c <= endChar; c++) {
          const gid = startGid + (c - startChar);
          if (!map.has(gid)) map.set(gid, c);
        }
      }
    } else {
      const segCount = view.getUint16(bestOffset + 6) / 2;
      const endOffset = bestOffset + 14;
      const startOffset = endOffset + segCount * 2 + 2;
      const deltaOffset = startOffset + segCount * 2;
      const rangeOffset = deltaOffset + segCount * 2;
      if (rangeOffset + segCount * 2 > buffer.byteLength) return null;
      for (let seg = 0; seg < segCount; seg++) {
        const end = view.getUint16(endOffset + seg * 2);
        const start = view.getUint16(startOffset + seg * 2);
        const delta = view.getInt16(deltaOffset + seg * 2);
        const range = view.getUint16(rangeOffset + seg * 2);
        if (start === 0xffff) continue;
        for (let c = start; c <= end && c !== 0xffff; c++) {
          let gid: number;
          if (range === 0) {
            gid = (c + delta) & 0xffff;
          } else {
            const gidOffset = rangeOffset + seg * 2 + range + (c - start) * 2;
            if (gidOffset + 2 > buffer.byteLength) continue;
            gid = view.getUint16(gidOffset);
            if (gid !== 0) gid = (gid + delta) & 0xffff;
          }
          if (gid !== 0 && !map.has(gid)) map.set(gid, c);
        }
      }
    }
    return map.size > 0 ? map : null;
  } catch (error) {
    console.error(error);
    return null;
  }
};

// 对应 gxps-glyphs.c 的 glyphs_indices_parse，仅提取 glyph index 序列
const parseGlyphIndices = (indices: string): number[] => {
  const result: number[] = [];
  let i = 0;
  const length = indices.length;
  const skipSpaces = () => {
    while (i < length && /\s/.test(indices[i])) i++;
  };
  const readNumber = (): number | null => {
    skipSpaces();
    const match = /^[+-]?\d+(\.\d+)?/.exec(indices.slice(i));
    if (!match) return null;
    i += match[0].length;
    return parseFloat(match[0]);
  };
  while (i < length) {
    skipSpaces();
    const ch = indices[i];
    if (ch === "(") {
      while (i < length && indices[i] !== ")") i++;
      i++;
      continue;
    }
    if (ch === ";" || ch === "," || ch === ":") {
      i++;
      continue;
    }
    const num = readNumber();
    if (num === null) {
      i++;
      continue;
    }
    result.push(num);
    // glyph index 后可跟随最多三组 ",advance[,hOffset[,vOffset]]"
    for (let k = 0; k < 3; k++) {
      const save = i;
      skipSpaces();
      if (i < length && indices[i] === ",") {
        i++;
        if (readNumber() === null) {
          i = save;
          break;
        }
      } else {
        i = save;
        break;
      }
    }
  }
  return result;
};

const mapIndicesToText = (
  indices: string,
  cmap: Map<number, number>
): string => {
  const gids = parseGlyphIndices(indices);
  let text = "";
  for (const gid of gids) {
    const code = cmap.get(gid);
    if (code !== undefined) {
      text += String.fromCodePoint(code);
    }
  }
  return text;
};

class PageParser {
  private host: XpsHost;
  private source: string;
  private resources: Map<string, Element>[] = [];

  constructor(host: XpsHost, source: string) {
    this.host = host;
    this.source = source;
  }

  async parsePage(root: Element): Promise<XpsPage> {
    const width = attrFloat(root, "Width") || 0;
    const height = attrFloat(root, "Height") || 0;
    const lang = root.getAttribute("xml:lang") || undefined;
    const pushed = await this.pushResourceContainers(root, [
      "FixedPage.Resources",
    ]);
    const elements = await this.parseChildren(root, ["FixedPage.Resources"]);
    this.popResources(pushed);
    return { source: this.source, width, height, lang, elements };
  }

  private async pushResourceContainers(
    node: Element,
    containerNames: string[]
  ): Promise<number> {
    let count = 0;
    for (const child of elementChildren(node)) {
      if (containerNames.indexOf(child.localName) === -1) continue;
      for (const dict of elementChildren(child)) {
        if (dict.localName !== "ResourceDictionary") continue;
        const maps = await this.parseResourceDictionary(dict);
        this.resources.push(...maps);
        count += maps.length;
      }
    }
    return count;
  }

  private popResources(count: number) {
    for (let i = 0; i < count; i++) {
      this.resources.pop();
    }
  }

  private async parseResourceDictionary(
    dict: Element
  ): Promise<Map<string, Element>[]> {
    let root = dict;
    const sourceAttr = dict.getAttribute("Source");
    if (sourceAttr) {
      const path = resolveRelativePath(this.source, sourceAttr);
      const text = await this.host.readXmlText(path);
      if (!text) return [];
      try {
        root = parseXml(text).documentElement;
      } catch (error) {
        console.error(error);
        return [];
      }
      if (root.localName !== "ResourceDictionary") return [];
    }
    const own = new Map<string, Element>();
    const maps: Map<string, Element>[] = [own];
    for (const child of elementChildren(root)) {
      if (child.localName === "ResourceDictionary") {
        maps.push(...(await this.parseResourceDictionary(child)));
        continue;
      }
      const key = child.getAttribute("x:Key");
      if (key) own.set(key, child);
    }
    return maps;
  }

  private lookupResource(key: string): Element | null {
    for (let i = this.resources.length - 1; i >= 0; i--) {
      const found = this.resources[i].get(key);
      if (found) return found;
    }
    return null;
  }

  private async parseChildren(
    parent: Element,
    skipNames: string[]
  ): Promise<XpsElement[]> {
    const result: XpsElement[] = [];
    for (const child of elementChildren(parent)) {
      if (skipNames.indexOf(child.localName) > -1) continue;
      const element = await this.parseElement(child);
      if (element) result.push(element);
    }
    return result;
  }

  private async parseElement(node: Element): Promise<XpsElement | null> {
    switch (node.localName) {
      case "Canvas":
        return this.parseCanvas(node);
      case "Path":
        return this.parsePath(node);
      case "Glyphs":
        return this.parseGlyphs(node);
      default:
        return null;
    }
  }

  private async parseCanvas(node: Element): Promise<XpsCanvasElement> {
    const transform = await this.readTransform(
      node,
      "RenderTransform",
      "Canvas.RenderTransform"
    );
    const clip = this.readClip(node.getAttribute("Clip"));
    const opacity = attrFloat(node, "Opacity");
    const pushed = await this.pushResourceContainers(node, [
      "Canvas.Resources",
    ]);
    const children = await this.parseChildren(node, [
      "Canvas.Resources",
      "Canvas.RenderTransform",
      "Canvas.OpacityMask",
    ]);
    this.popResources(pushed);
    return {
      type: "canvas",
      transform,
      clip,
      opacity: opacity === null ? undefined : opacity,
      children,
    };
  }

  private async parsePath(node: Element): Promise<XpsPathElement | null> {
    let data = "";
    let fillRule: "evenodd" | "nonzero" = "evenodd";
    let geometryTransform: number[][] | undefined;
    const dataAttr = node.getAttribute("Data");
    const dataChild = elementChildren(node).find(
      (child) => child.localName === "Path.Data"
    );
    if (dataAttr) {
      const resourceKey = extractStaticResource(dataAttr);
      if (resourceKey) {
        const resourceNode = this.lookupResource(resourceKey);
        if (resourceNode) {
          const geometry = await this.parseGeometry(resourceNode);
          if (geometry) {
            data = geometry.d;
            fillRule = geometry.fillRule;
            geometryTransform = geometry.transform;
          }
        }
      } else {
        const converted = convertPathData(dataAttr);
        data = converted.d;
        fillRule = converted.fillRule;
      }
    } else if (dataChild) {
      const geometry = await this.parseGeometry(dataChild);
      if (geometry) {
        data = geometry.d;
        fillRule = geometry.fillRule;
        geometryTransform = geometry.transform;
      }
    }
    const transform = await this.readTransform(
      node,
      "RenderTransform",
      "Path.RenderTransform"
    );
    if (geometryTransform) {
      // 与 libgxps 一致：RenderTransform 先应用，几何自身的 Transform 后应用
      transform.push(...geometryTransform);
    }
    const fill = await this.readBrush(node, "Fill", "Path.Fill");
    const stroke = await this.readBrush(node, "Stroke", "Path.Stroke");
    const clip = this.readClip(node.getAttribute("Clip"));
    const opacity = attrFloat(node, "Opacity");
    const strokeThickness = attrFloat(node, "StrokeThickness");
    const dashArray = parseDashArray(node.getAttribute("StrokeDashArray") || "");
    const dashOffset = attrFloat(node, "StrokeDashOffset");
    const miterLimit = attrFloat(node, "StrokeMiterLimit");
    return {
      type: "path",
      data,
      fillRule,
      fill,
      stroke,
      transform,
      clip,
      opacity: opacity === null ? undefined : opacity,
      strokeThickness: strokeThickness === null ? undefined : strokeThickness,
      strokeDashArray: dashArray || undefined,
      strokeDashOffset: dashOffset === null ? undefined : dashOffset,
      strokeLineCap: node.getAttribute("StrokeDashCap") || undefined,
      strokeLineJoin: node.getAttribute("StrokeLineJoin") || undefined,
      strokeMiterLimit: miterLimit === null ? undefined : miterLimit,
    };
  }

  private async parseGeometry(
    node: Element
  ): Promise<{ d: string; fillRule: "evenodd" | "nonzero"; transform?: number[][] } | null> {
    let geometryNode = node;
    if (node.localName !== "PathGeometry") {
      const child = elementChildren(node).find(
        (item) => item.localName === "PathGeometry"
      );
      if (!child) return null;
      geometryNode = child;
    }
    const transforms: number[][] = [];
    const transformAttr = geometryNode.getAttribute("Transform");
    if (transformAttr) {
      const matrix = parseMatrix(transformAttr);
      if (matrix) transforms.push(matrix);
    }
    const transformChild = elementChildren(geometryNode).find(
      (child) => child.localName === "PathGeometry.Transform"
    );
    if (transformChild) {
      for (const item of elementChildren(transformChild)) {
        if (item.localName !== "MatrixTransform") continue;
        const matrix = parseMatrix(item.getAttribute("Matrix") || "");
        if (matrix) transforms.push(matrix);
      }
    }
    let fillRule: "evenodd" | "nonzero" =
      geometryNode.getAttribute("FillRule") === "NonZero" ? "nonzero" : "evenodd";
    let d = "";
    const figures = geometryNode.getAttribute("Figures");
    if (figures) {
      const converted = convertPathData(figures);
      d = converted.d;
      if (converted.hasFillRule) fillRule = converted.fillRule;
    } else {
      d = this.parsePathFigures(geometryNode);
    }
    return {
      d,
      fillRule,
      transform: transforms.length > 0 ? transforms : undefined,
    };
  }

  private parsePathFigures(geometryNode: Element): string {
    const parts: string[] = [];
    for (const figure of elementChildren(geometryNode)) {
      if (figure.localName !== "PathFigure") continue;
      const start = parsePoint(figure.getAttribute("StartPoint") || "");
      if (!start) continue;
      parts.push(`M ${round(start[0])} ${round(start[1])}`);
      for (const segment of elementChildren(figure)) {
        if (segment.getAttribute("IsStroked") === "false") continue;
        switch (segment.localName) {
          case "LineSegment": {
            const point = parsePoint(segment.getAttribute("Point") || "");
            if (point) parts.push(`L ${round(point[0])} ${round(point[1])}`);
            break;
          }
          case "PolyLineSegment": {
            for (const point of parsePoints(segment.getAttribute("Points") || "")) {
              parts.push(`L ${round(point[0])} ${round(point[1])}`);
            }
            break;
          }
          case "BezierSegment": {
            const p1 = parsePoint(segment.getAttribute("Point1") || "");
            const p2 = parsePoint(segment.getAttribute("Point2") || "");
            const p3 = parsePoint(segment.getAttribute("Point3") || "");
            if (p1 && p2 && p3) {
              parts.push(
                `C ${round(p1[0])} ${round(p1[1])} ${round(p2[0])} ${round(p2[1])} ${round(p3[0])} ${round(p3[1])}`
              );
            }
            break;
          }
          case "PolyBezierSegment": {
            const points = parsePoints(segment.getAttribute("Points") || "");
            for (let i = 0; i + 2 < points.length; i += 3) {
              parts.push(
                `C ${round(points[i][0])} ${round(points[i][1])} ${round(points[i + 1][0])} ${round(points[i + 1][1])} ${round(points[i + 2][0])} ${round(points[i + 2][1])}`
              );
            }
            break;
          }
          case "QuadraticBezierSegment": {
            const p1 = parsePoint(segment.getAttribute("Point1") || "");
            const p2 = parsePoint(segment.getAttribute("Point2") || "");
            if (p1 && p2) {
              parts.push(
                `Q ${round(p1[0])} ${round(p1[1])} ${round(p2[0])} ${round(p2[1])}`
              );
            }
            break;
          }
          case "PolyQuadraticBezierSegment": {
            const points = parsePoints(segment.getAttribute("Points") || "");
            for (let i = 0; i + 1 < points.length; i += 2) {
              parts.push(
                `Q ${round(points[i][0])} ${round(points[i][1])} ${round(points[i + 1][0])} ${round(points[i + 1][1])}`
              );
            }
            break;
          }
          case "ArcSegment": {
            const point = parsePoint(segment.getAttribute("Point") || "");
            const size = parsePoint(segment.getAttribute("Size") || "");
            if (!point || !size) break;
            const rotation = attrFloat(segment, "RotationAngle") || 0;
            const largeArc = attrBool(segment, "IsLargeArc", false) ? 1 : 0;
            const sweep =
              segment.getAttribute("SweepDirection") === "Clockwise" ? 1 : 0;
            parts.push(
              `A ${round(size[0])} ${round(size[1])} ${round(rotation)} ${largeArc} ${sweep} ${round(point[0])} ${round(point[1])}`
            );
            break;
          }
          default:
            break;
        }
      }
      if (attrBool(figure, "IsClosed", false)) parts.push("Z");
    }
    return parts.join(" ");
  }

  private readClip(value: string | null): XpsClip | null {
    if (!value) return null;
    const converted = convertPathData(value);
    if (!converted.d) return null;
    return { d: converted.d, fillRule: converted.fillRule };
  }

  private async readTransform(
    node: Element,
    attrName: string,
    childName: string
  ): Promise<number[][]> {
    const transforms: number[][] = [];
    const attrValue = node.getAttribute(attrName);
    if (attrValue) {
      const matrix = parseMatrix(attrValue);
      if (matrix) transforms.push(matrix);
    }
    const child = elementChildren(node).find(
      (item) => item.localName === childName
    );
    if (child) {
      for (const item of elementChildren(child)) {
        if (item.localName !== "MatrixTransform") continue;
        const matrix = parseMatrix(item.getAttribute("Matrix") || "");
        if (matrix) transforms.push(matrix);
      }
    }
    return transforms;
  }

  private async readBrush(
    node: Element,
    attrName: string,
    childName: string
  ): Promise<XpsBrush | null> {
    const attrValue = node.getAttribute(attrName);
    if (attrValue) {
      const resourceKey = extractStaticResource(attrValue);
      if (resourceKey) {
        const resourceNode = this.lookupResource(resourceKey);
        if (resourceNode) return this.parseBrushElement(resourceNode);
        return null;
      }
      const color = parseColor(attrValue);
      if (color) return { type: "solid", color, opacity: 1 };
      return null;
    }
    const child = elementChildren(node).find(
      (item) => item.localName === childName
    );
    if (!child) return null;
    for (const item of elementChildren(child)) {
      const brush = this.parseBrushElement(item);
      if (brush) return brush;
    }
    return null;
  }

  private parseBrushElement(node: Element): XpsBrush | null {
    switch (node.localName) {
      case "SolidColorBrush": {
        const color = parseColor(node.getAttribute("Color") || "");
        if (!color) return null;
        const opacity = attrFloat(node, "Opacity");
        return {
          type: "solid",
          color,
          opacity: opacity === null ? 1 : clamp01(opacity),
        };
      }
      case "ImageBrush": {
        const imageSource = node.getAttribute("ImageSource");
        if (!imageSource) return null;
        const opacity = attrFloat(node, "Opacity");
        const brush: XpsImageBrush = {
          type: "image",
          imageUri: resolveRelativePath(this.source, imageSource),
          opacity: opacity === null ? 1 : clamp01(opacity),
        };
        const transform = this.readBrushTransform(node);
        if (transform.length > 0) brush.transform = transform;
        const viewport = parseBox(node.getAttribute("Viewport") || "");
        if (viewport) {
          brush.viewport = viewport;
          brush.viewportUnits =
            node.getAttribute("ViewportUnits") || undefined;
        }
        const viewbox = parseBox(node.getAttribute("Viewbox") || "");
        if (viewbox) {
          brush.viewbox = viewbox;
          brush.viewboxUnits = node.getAttribute("ViewboxUnits") || undefined;
        }
        brush.tileMode = node.getAttribute("TileMode") || undefined;
        return brush;
      }
      case "LinearGradientBrush": {
        const opacity = attrFloat(node, "Opacity");
        const brush: XpsGradientBrush = {
          type: "linear",
          opacity: opacity === null ? 1 : clamp01(opacity),
          startPoint:
            parsePoint(node.getAttribute("StartPoint") || "") || undefined,
          endPoint: parsePoint(node.getAttribute("EndPoint") || "") || undefined,
          spreadMethod: node.getAttribute("SpreadMethod") || undefined,
          stops: this.parseGradientStops(node),
        };
        const transform = this.readBrushTransform(node);
        if (transform.length > 0) brush.transform = transform;
        return brush;
      }
      case "RadialGradientBrush": {
        const opacity = attrFloat(node, "Opacity");
        const radiusX = attrFloat(node, "RadiusX");
        const radiusY = attrFloat(node, "RadiusY");
        const brush: XpsGradientBrush = {
          type: "radial",
          opacity: opacity === null ? 1 : clamp01(opacity),
          gradientOrigin:
            parsePoint(node.getAttribute("GradientOrigin") || "") || undefined,
          center: parsePoint(node.getAttribute("Center") || "") || undefined,
          radiusX: radiusX === null ? undefined : radiusX,
          radiusY: radiusY === null ? undefined : radiusY,
          spreadMethod: node.getAttribute("SpreadMethod") || undefined,
          stops: this.parseGradientStops(node),
        };
        const transform = this.readBrushTransform(node);
        if (transform.length > 0) brush.transform = transform;
        return brush;
      }
      default:
        return null;
    }
  }

  private readBrushTransform(node: Element): number[][] {
    const transforms: number[][] = [];
    const attrValue = node.getAttribute("Transform");
    if (attrValue) {
      const matrix = parseMatrix(attrValue);
      if (matrix) transforms.push(matrix);
    }
    const childName =
      node.localName === "ImageBrush"
        ? "ImageBrush.Transform"
        : node.localName === "LinearGradientBrush"
          ? "LinearGradientBrush.Transform"
          : "RadialGradientBrush.Transform";
    const child = elementChildren(node).find(
      (item) => item.localName === childName
    );
    if (child) {
      for (const item of elementChildren(child)) {
        if (item.localName !== "MatrixTransform") continue;
        const matrix = parseMatrix(item.getAttribute("Matrix") || "");
        if (matrix) transforms.push(matrix);
      }
    }
    return transforms;
  }

  private parseGradientStops(node: Element): XpsGradientStop[] {
    const stops: XpsGradientStop[] = [];
    const collect = (parent: Element) => {
      for (const child of elementChildren(parent)) {
        if (child.localName === "GradientStop") {
          const color = parseColor(child.getAttribute("Color") || "");
          const offset = attrFloat(child, "Offset");
          if (color && offset !== null) {
            stops.push({ color, offset: clamp01(offset) });
          }
        } else if (
          child.localName === "LinearGradientBrush.GradientStops" ||
          child.localName === "RadialGradientBrush.GradientStops"
        ) {
          collect(child);
        }
      }
    };
    collect(node);
    return stops;
  }

  private async parseGlyphs(node: Element): Promise<XpsGlyphsElement | null> {
    const fontUriAttr = node.getAttribute("FontUri");
    const fontSize = attrFloat(node, "FontRenderingEmSize");
    const originX = attrFloat(node, "OriginX");
    const originY = attrFloat(node, "OriginY");
    if (
      !fontUriAttr ||
      fontSize === null ||
      originX === null ||
      originY === null
    ) {
      return null;
    }
    let text = node.getAttribute("UnicodeString") || "";
    if (text.indexOf("{}") === 0) text = text.slice(2);
    const indices = node.getAttribute("Indices") || undefined;
    const fill = await this.readBrush(node, "Fill", "Glyphs.Fill");
    const transform = await this.readTransform(
      node,
      "RenderTransform",
      "Glyphs.RenderTransform"
    );
    const clip = this.readClip(node.getAttribute("Clip"));
    const opacity = attrFloat(node, "Opacity");
    const bidiLevel = parseInt(node.getAttribute("BidiLevel") || "0", 10) || 0;
    const simulations = node.getAttribute("StyleSimulations") || "";
    return {
      type: "glyphs",
      fontUri: resolveRelativePath(this.source, fontUriAttr),
      fontSize,
      originX,
      originY,
      text,
      resolvedText: text,
      indices,
      fill,
      transform,
      clip,
      opacity: opacity === null ? undefined : opacity,
      bidiLevel,
      isSideways: node.getAttribute("IsSideways") === "true",
      italic:
        simulations === "ItalicSimulation" ||
        simulations === "BoldItalicSimulation",
      bold:
        simulations === "BoldSimulation" ||
        simulations === "BoldItalicSimulation",
    };
  }
}

const parseCoreProperties = (text: string): XpsMetadata => {
  const metadata: XpsMetadata = {
    title: "",
    author: "",
    description: "",
    publisher: "",
    language: "",
    identifier: "",
  };
  try {
    const doc = parseXml(text);
    const read = (localName: string): string => {
      const element = findElements(doc.documentElement, localName)[0];
      return element ? (element.textContent || "").trim() : "";
    };
    metadata.title = read("title");
    metadata.author = read("creator");
    metadata.description = read("description");
    metadata.publisher = read("publisher");
    metadata.language = read("language");
    metadata.identifier = read("identifier");
  } catch (error) {
    console.error(error);
  }
  return metadata;
};

export class XpsFile implements XpsHost {
  private zip: JSZip;
  private entries: Map<string, JSZip.JSZipObject> = new Map();
  private fileCache: Map<string, ArrayBuffer> = new Map();
  private pageCache: Map<string, XpsPage> = new Map();
  private fontCache: Map<string, ArrayBuffer | null> = new Map();
  private cmapCache: Map<string, Map<number, number> | null> = new Map();
  private pages: XpsPageSource[] = [];
  private thumbnailPart: string = "";

  metadata: XpsMetadata = {
    title: "",
    author: "",
    description: "",
    publisher: "",
    language: "",
    identifier: "",
  };

  private constructor(zip: JSZip) {
    this.zip = zip;
  }

  static async open(buffer: ArrayBuffer): Promise<XpsFile> {
    const zip = await JSZip.loadAsync(buffer);
    const file = new XpsFile(zip);
    await file.init();
    return file;
  }

  get pageCount(): number {
    return this.pages.length;
  }

  async readXmlText(path: string): Promise<string | null> {
    const data = await this.readBinary(path);
    if (!data) return null;
    return decodeXmlText(data);
  }

  private async readBinary(path: string): Promise<ArrayBuffer | null> {
    const key = normalizePartName(path);
    if (this.fileCache.has(key)) {
      return this.fileCache.get(key) || null;
    }
    const entry = this.entries.get(key);
    if (!entry) return null;
    try {
      const data = await entry.async("arraybuffer");
      this.fileCache.set(key, data);
      return data;
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  private async init() {
    this.zip.forEach((path, entry) => {
      if (!entry.dir) {
        this.entries.set(normalizePartName(path), entry);
      }
    });
    const relsText = await this.readXmlText("_rels/.rels");
    if (!relsText) {
      throw new Error("Invalid XPS file: _rels/.rels not found");
    }
    const rels = parseXml(relsText);
    let fixedRepresentation = "";
    let thumbnail = "";
    let coreProperties = "";
    for (const rel of findElements(rels.documentElement, "Relationship")) {
      const type = rel.getAttribute("Type") || "";
      const target = rel.getAttribute("Target") || "";
      if (!target) continue;
      if (REL_FIXED_REPRESENTATION.indexOf(type) > -1) {
        fixedRepresentation = target;
      } else if (type === REL_THUMBNAIL) {
        thumbnail = target;
      } else if (type === REL_CORE_PROPERTIES) {
        coreProperties = target;
      }
    }
    if (!fixedRepresentation) {
      throw new Error("Invalid XPS file: fixed representation not found");
    }
    const sequenceText = await this.readXmlText(fixedRepresentation);
    if (!sequenceText) {
      throw new Error(
        "Invalid XPS file: " + fixedRepresentation + " not found"
      );
    }
    const sequence = parseXml(sequenceText);
    const documentSources: string[] = [];
    for (const reference of findElements(
      sequence.documentElement,
      "DocumentReference"
    )) {
      const source = reference.getAttribute("Source");
      if (source) {
        documentSources.push(resolveRelativePath(fixedRepresentation, source));
      }
    }
    if (documentSources.length === 0) {
      throw new Error("Invalid XPS file: no documents found");
    }
    for (const documentSource of documentSources) {
      const documentText = await this.readXmlText(documentSource);
      if (!documentText) continue;
      const document = parseXml(documentText);
      for (const pageContent of findElements(
        document.documentElement,
        "PageContent"
      )) {
        const source = pageContent.getAttribute("Source");
        if (!source) continue;
        this.pages.push({
          source: resolveRelativePath(documentSource, source),
          width: attrFloat(pageContent, "Width") || 0,
          height: attrFloat(pageContent, "Height") || 0,
        });
      }
    }
    if (this.pages.length === 0) {
      throw new Error("Invalid XPS file: no pages found");
    }
    if (coreProperties) {
      const text = await this.readXmlText(coreProperties);
      if (text) {
        this.metadata = parseCoreProperties(text);
      }
    }
    this.thumbnailPart = thumbnail;
  }

  async getPageSize(index: number): Promise<{ width: number; height: number }> {
    const info = this.pages[index];
    if (info && info.width > 0 && info.height > 0) {
      return { width: info.width, height: info.height };
    }
    const page = await this.getPage(index);
    return { width: page.width, height: page.height };
  }

  async getPage(index: number): Promise<XpsPage> {
    if (index < 0 || index >= this.pages.length) {
      throw new Error("XPS page index out of range: " + index);
    }
    const info = this.pages[index];
    const cached = this.pageCache.get(info.source);
    if (cached) return cached;
    const text = await this.readXmlText(info.source);
    if (!text) {
      throw new Error("XPS page not found: " + info.source);
    }
    const root = parseXml(text).documentElement;
    if (root.localName !== "FixedPage") {
      throw new Error("Invalid XPS page: " + info.source);
    }
    const parser = new PageParser(this, info.source);
    const page = await parser.parsePage(root);
    if (page.width <= 0) page.width = info.width || DEFAULT_PAGE_WIDTH;
    if (page.height <= 0) page.height = info.height || DEFAULT_PAGE_HEIGHT;
    await this.resolveGlyphsText(page);
    this.pageCache.set(info.source, page);
    return page;
  }

  async getPageText(index: number): Promise<string> {
    const page = await this.getPage(index);
    const parts: string[] = [];
    const walk = (elements: XpsElement[]) => {
      for (const element of elements) {
        if (element.type === "glyphs") {
          parts.push(element.resolvedText);
        } else if (element.type === "canvas") {
          walk(element.children);
        }
      }
    };
    walk(page.elements);
    return parts.join("").replace(/\s+/g, " ").trim();
  }

  async search(
    keyword: string
  ): Promise<{ pageIndex: number; excerpt: string }[]> {
    const results: { pageIndex: number; excerpt: string }[] = [];
    if (!keyword) return results;
    const lower = keyword.toLowerCase();
    for (let i = 0; i < this.pages.length; i++) {
      let text = "";
      try {
        text = await this.getPageText(i);
      } catch (error) {
        console.error(error);
        continue;
      }
      const index = text.toLowerCase().indexOf(lower);
      if (index > -1) {
        results.push({
          pageIndex: i,
          excerpt: text.slice(
            Math.max(0, index - 20),
            index + keyword.length + 20
          ),
        });
      }
    }
    return results;
  }

  async getImage(
    uri: string
  ): Promise<{ data: ArrayBuffer; mime: string } | null> {
    const data = await this.readBinary(uri);
    if (!data) return null;
    return { data, mime: mimeFromPath(uri) };
  }

  async getFont(uri: string): Promise<ArrayBuffer | null> {
    if (this.fontCache.has(uri)) {
      return this.fontCache.get(uri) || null;
    }
    let result: ArrayBuffer | null = null;
    const data = await this.readBinary(uri);
    if (data) {
      const bytes = new Uint8Array(data);
      if (isSfntFont(bytes)) {
        result = data;
      } else {
        // 对应 gxps-fonts.c：先直接加载，失败后再按文件名 GUID 反混淆
        const copy = new Uint8Array(data.slice(0));
        if (deobfuscateFont(copy, uri)) {
          result = copy.buffer;
        }
      }
    }
    this.fontCache.set(uri, result);
    return result;
  }

  async getFontCmap(uri: string): Promise<Map<number, number> | null> {
    if (this.cmapCache.has(uri)) {
      return this.cmapCache.get(uri) || null;
    }
    let cmap: Map<number, number> | null = null;
    const data = await this.getFont(uri);
    if (data) {
      cmap = parseCmap(data);
    }
    this.cmapCache.set(uri, cmap);
    return cmap;
  }

  async getThumbnail(): Promise<Blob | null> {
    if (!this.thumbnailPart) return null;
    const data = await this.readBinary(this.thumbnailPart);
    if (!data) return null;
    return new Blob([data], { type: mimeFromPath(this.thumbnailPart) });
  }

  private async resolveGlyphsText(page: XpsPage) {
    const glyphsList: XpsGlyphsElement[] = [];
    const walk = (elements: XpsElement[]) => {
      for (const element of elements) {
        if (element.type === "glyphs") {
          glyphsList.push(element);
        } else if (element.type === "canvas") {
          walk(element.children);
        }
      }
    };
    walk(page.elements);
    for (const glyphs of glyphsList) {
      if (glyphs.text) {
        glyphs.resolvedText = glyphs.text;
        continue;
      }
      if (!glyphs.indices) {
        glyphs.resolvedText = "";
        continue;
      }
      const cmap = await this.getFontCmap(glyphs.fontUri);
      if (!cmap) {
        glyphs.resolvedText = "";
        continue;
      }
      glyphs.resolvedText = mapIndicesToText(glyphs.indices, cmap);
    }
  }
}

export interface XpsRenderImage {
  url: string;
  width: number;
  height: number;
}

export interface XpsPageRenderOptions {
  getImage: (uri: string) => Promise<XpsRenderImage | null>;
  getFontFamily: (uri: string) => string;
}

export interface XpsPageRenderResult {
  svg: string;
  fonts: string[];
  images: string[];
}

// 把解析后的 FixedPage 内容树渲染为 SVG（等价于 gxps_page_render 的绘制过程）
export const renderXpsPage = async (
  page: XpsPage,
  options: XpsPageRenderOptions
): Promise<XpsPageRenderResult> => {
  const defs: string[] = [];
  const fonts = new Set<string>();
  const images = new Set<string>();
  let idCounter = 0;
  const nextId = (prefix: string) => prefix + ++idCounter;

  const matrixString = (list?: number[][]): string => {
    if (!list || list.length === 0) return "";
    return list
      .map((m) => `matrix(${m.map((value) => round(value)).join(" ")})`)
      .join(" ");
  };

  const commonAttrs = (el: XpsBaseElement, transformValue: string): string => {
    let attrs = transformValue ? ` transform="${transformValue}"` : "";
    if (typeof el.opacity === "number" && el.opacity !== 1) {
      attrs += ` opacity="${round(clamp01(el.opacity))}"`;
    }
    if (el.clip && el.clip.d) {
      const id = nextId("clip");
      defs.push(
        `<clipPath id="${id}"><path d="${escapeXmlAttr(el.clip.d)}" fill-rule="${el.clip.fillRule}"/></clipPath>`
      );
      attrs += ` clip-path="url(#${id})"`;
    }
    return attrs;
  };

  const gradientStops = (brush: XpsGradientBrush): string =>
    brush.stops
      .map(
        (stop) =>
          `<stop offset="${round(clamp01(stop.offset))}" stop-color="${colorToRgb(stop.color)}" stop-opacity="${round(clamp01(stop.color.a * brush.opacity))}"/>`
      )
      .join("");

  const brushPaint = async (brush: XpsBrush): Promise<string | null> => {
    if (brush.type === "solid") {
      return colorToCss(brush.color, brush.opacity);
    }
    if (brush.type === "linear") {
      const start = brush.startPoint || [0, 0];
      const end = brush.endPoint || [1, 1];
      const id = nextId("lg");
      const spread = brush.spreadMethod
        ? ` spreadMethod="${spreadMethodValue(brush.spreadMethod)}"`
        : "";
      const gradientTransform = matrixString(brush.transform);
      defs.push(
        `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${round(start[0])}" y1="${round(start[1])}" x2="${round(end[0])}" y2="${round(end[1])}"${spread}${gradientTransform ? ` gradientTransform="${gradientTransform}"` : ""}>${gradientStops(brush)}</linearGradient>`
      );
      return `url(#${id})`;
    }
    if (brush.type === "radial") {
      const center = brush.center || [0.5, 0.5];
      const origin = brush.gradientOrigin || center;
      const radiusX = brush.radiusX || 0.5;
      const radiusY = brush.radiusY || radiusX;
      const id = nextId("rg");
      const spread = brush.spreadMethod
        ? ` spreadMethod="${spreadMethodValue(brush.spreadMethod)}"`
        : "";
      const fx = radiusX !== 0 ? (origin[0] - center[0]) / radiusX : 0;
      const fy = radiusY !== 0 ? (origin[1] - center[1]) / radiusY : 0;
      const brushTransform = matrixString(brush.transform);
      const gradientTransform = `${brushTransform ? brushTransform + " " : ""}translate(${round(center[0])} ${round(center[1])}) scale(${round(radiusX)} ${round(radiusY)})`;
      defs.push(
        `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1" fx="${round(fx)}" fy="${round(fy)}"${spread} gradientTransform="${gradientTransform}">${gradientStops(brush)}</radialGradient>`
      );
      return `url(#${id})`;
    }
    const uri = brush.imageUri;
    const image = await options.getImage(uri);
    if (!image) return null;
    images.add(uri);
    const id = nextId("ib");
    let viewbox = brush.viewbox;
    if (!viewbox || (viewbox[2] <= 0 && viewbox[3] <= 0)) {
      viewbox = [0, 0, image.width || 1, image.height || 1];
    } else if ((brush.viewboxUnits || "RelativeToBoundingBox") === "RelativeToBoundingBox") {
      viewbox = [
        viewbox[0] * image.width,
        viewbox[1] * image.height,
        viewbox[2] * image.width,
        viewbox[3] * image.height,
      ];
    }
    let viewport = brush.viewport;
    let viewportUnits = brush.viewportUnits || "RelativeToBoundingBox";
    if (!viewport) {
      viewport = [0, 0, 1, 1];
      viewportUnits = "RelativeToBoundingBox";
    } else if (!brush.viewportUnits && (viewport[2] > 1 || viewport[3] > 1)) {
      viewportUnits = "Absolute";
    }
    const scaleX = viewbox[2] !== 0 ? 1 / viewbox[2] : 0;
    const scaleY = viewbox[3] !== 0 ? 1 / viewbox[3] : 0;
    const imageX = -viewbox[0] * scaleX;
    const imageY = -viewbox[1] * scaleY;
    const imageWidth = (image.width || viewbox[2]) * scaleX;
    const imageHeight = (image.height || viewbox[3]) * scaleY;
    const patternUnits =
      viewportUnits === "Absolute" ? "userSpaceOnUse" : "objectBoundingBox";
    const patternTransform = matrixString(brush.transform);
    const opacity =
      brush.opacity !== 1 ? ` opacity="${round(clamp01(brush.opacity))}"` : "";
    defs.push(
      `<pattern id="${id}" patternUnits="${patternUnits}" x="${round(viewport[0])}" y="${round(viewport[1])}" width="${round(viewport[2])}" height="${round(viewport[3])}"${patternTransform ? ` patternTransform="${patternTransform}"` : ""} patternContentUnits="objectBoundingBox"><image href="${escapeXmlAttr(image.url)}" xlink:href="${escapeXmlAttr(image.url)}" x="${round(imageX)}" y="${round(imageY)}" width="${round(imageWidth)}" height="${round(imageHeight)}" preserveAspectRatio="none"${opacity}/></pattern>`
    );
    return `url(#${id})`;
  };

  const renderElement = async (el: XpsElement): Promise<string> => {
    if (el.type === "canvas") {
      const children: string[] = [];
      for (const child of el.children) {
        children.push(await renderElement(child));
      }
      return `<g${commonAttrs(el, matrixString(el.transform))}>${children.join("")}</g>`;
    }
    if (el.type === "path") {
      if (!el.data) return "";
      const attrs: string[] = [`d="${escapeXmlAttr(el.data)}"`];
      let hasFill = false;
      if (el.fill) {
        const paint = await brushPaint(el.fill);
        if (paint) {
          attrs.push(`fill="${escapeXmlAttr(paint)}"`);
          attrs.push(`fill-rule="${el.fillRule}"`);
          hasFill = true;
        }
      }
      if (!hasFill) attrs.push(`fill="none"`);
      if (el.stroke) {
        const paint = await brushPaint(el.stroke);
        if (paint) {
          attrs.push(`stroke="${escapeXmlAttr(paint)}"`);
          attrs.push(`stroke-width="${round(el.strokeThickness ?? 1)}"`);
          if (el.strokeDashArray && el.strokeDashArray.length > 0) {
            attrs.push(
              `stroke-dasharray="${el.strokeDashArray.map((value) => round(value)).join(" ")}"`
            );
          }
          if (typeof el.strokeDashOffset === "number") {
            attrs.push(`stroke-dashoffset="${round(el.strokeDashOffset)}"`);
          }
          if (el.strokeLineCap) {
            attrs.push(`stroke-linecap="${lineCapValue(el.strokeLineCap)}"`);
          }
          if (el.strokeLineJoin) {
            attrs.push(`stroke-linejoin="${lineJoinValue(el.strokeLineJoin)}"`);
          }
          if (typeof el.strokeMiterLimit === "number") {
            attrs.push(`stroke-miterlimit="${round(el.strokeMiterLimit)}"`);
          }
        }
      }
      return `<path ${attrs.join(" ")}${commonAttrs(el, matrixString(el.transform))}/>`;
    }
    const text = el.resolvedText;
    if (!text) return "";
    fonts.add(el.fontUri);
    const family = options.getFontFamily(el.fontUri);
    const attrs: string[] = [
      `x="${round(el.originX)}"`,
      `y="${round(el.originY)}"`,
      `font-size="${round(el.fontSize)}"`,
      `font-family="${escapeXmlAttr(family)}"`,
      `xml:space="preserve"`,
    ];
    let fillColor = "#000000";
    if (el.fill) {
      const paint = await brushPaint(el.fill);
      if (paint) fillColor = paint;
    }
    attrs.push(`fill="${escapeXmlAttr(fillColor)}"`);
    if (el.italic) attrs.push(`font-style="italic"`);
    if (el.bold) attrs.push(`font-weight="bold"`);
    if (el.bidiLevel % 2 === 1) {
      attrs.push(`direction="rtl"`);
      attrs.push(`unicode-bidi="bidi-override"`);
    }
    let transformValue = matrixString(el.transform);
    if (el.isSideways) {
      // 对应 gxps-page.c 中 is_sideways 时 font_matrix 旋转 -PI/2
      transformValue = `${transformValue ? transformValue + " " : ""}rotate(-90 ${round(el.originX)} ${round(el.originY)})`;
    }
    return `<text ${attrs.join(" ")}${commonAttrs(el, transformValue)}>${escapeXmlText(text)}</text>`;
  };

  const body: string[] = [];
  for (const element of page.elements) {
    body.push(await renderElement(element));
  }

  const width = page.width || DEFAULT_PAGE_WIDTH;
  const height = page.height || DEFAULT_PAGE_HEIGHT;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${round(width)} ${round(height)}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">` +
    `<rect width="${round(width)}" height="${round(height)}" fill="#ffffff"/>` +
    `<defs>${defs.join("")}</defs>` +
    body.join("") +
    `</svg>`;
  return { svg, fonts: [...fonts], images: [...images] };
};
