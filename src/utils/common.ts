declare var window: any;
export const classes = [
  "color-0",
  "color-1",
  "color-2",
  "color-3",
  "line-0",
  "line-1",
  "line-2",
  "line-3",
];
export const colors = ["#FEF3CD", "#FBFACC", "#CEFACD", "#CDE9FA"];
export const lines = ["#FF0000", "#000080", "#0000FF", "#2EFF2E"];
export const buildHighlightStyleForType = (
  colorCode: string | number,
  forPDFOverlay: boolean,
  isVertical?: boolean
): string => {
  let styleType: string = "background";
  let rawColor: string = "#FEF3CD";
  if (typeof colorCode === "number") {
    if (colorCode >= 0 && colorCode < classes.length) {
      const isBackground = classes[colorCode].indexOf("color") > -1;
      const colorIdx = parseInt(classes[colorCode].split("-")[1]);
      styleType = isBackground ? "background" : "underline";
      rawColor = isBackground ? colors[colorIdx] : lines[colorIdx];
    }
  } else {
    styleType = colorCode.split("-")[0];
    rawColor = colorCode.split("-")[1];
  }
  const color =
    styleType === "background" ? hexToRgba(rawColor, 0.8) : rawColor;

  switch (styleType) {
    case "background":
      if (forPDFOverlay) {
        // Use multiply blend mode so the highlight tints the text area without
        // covering it — the same visual effect as a physical highlighter pen.
        // Fully opaque color is intentional: mix-blend-mode: multiply handles
        // the visual blending; alpha transparency is not needed and would fight it.
        return `background: ${color}; mix-blend-mode: multiply;`;
      }
      return `background: ${color};`;
    case "underline":
      // In vertical writing mode, border-bottom stays on the physical bottom;
      // the underline should run along the inline-end (right) edge instead.
      if (isVertical && !forPDFOverlay) {
        return `border-right: 2px solid ${color};`;
      }
      return `border-bottom: 2px solid ${color};`;
    case "strikethrough":
      if (forPDFOverlay) {
        // text-decoration doesn't render on empty divs; simulate with a gradient
        // line through the middle. Vertical: rotate the gradient axis so the line
        // runs vertically through the middle.
        return `background: linear-gradient(transparent calc(50% - 1px), ${color} calc(50% - 1px), ${color} calc(50% + 1px), transparent calc(50% + 1px));`;
      }
      if (isVertical) {
        return `background: linear-gradient(to right, transparent calc(50% - 1px), ${color} calc(50% - 1px), ${color} calc(50% + 1px), transparent calc(50% + 1px));`;
      }
      return `text-decoration: line-through; text-decoration-color: ${color};`;
    case "wavy":
      const encodedColor = rawColor.replace("#", "%23");
      if (forPDFOverlay) {
        // text-decoration doesn't render on empty divs; simulate with a repeating
        // SVG wavy line. Horizontal: wavy line at the bottom edge; vertical: wavy
        // line along the right edge, repeated vertically.

        const svgWavy = `url("data:image/svg+xml,%3Csvg xmlns='http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg' width='6' height='3'%3E%3Cpath d='M0 2 Q1.5 0 3 2 Q4.5 4 6 2' fill='none' stroke='${encodedColor}' stroke-width='1.5'%2F%3E%3C%2Fsvg%3E")`;
        return `background-image: ${svgWavy}; background-repeat: repeat-x; background-position: bottom; background-size: 6px 3px;`;
      }
      if (isVertical) {
        const svgWavyVertical = `url("data:image/svg+xml,%3Csvg xmlns='http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg' width='3' height='6'%3E%3Cpath d='M2 0 Q0 1.5 2 3 Q4 4.5 2 6' fill='none' stroke='${encodedColor}' stroke-width='1.5'%2F%3E%3C%2Fsvg%3E")`;
        return `background-image: ${svgWavyVertical}; background-repeat: repeat-y; background-position: right; background-size: 3px 6px;`;
      }
      // Native text-decoration follows writing-mode automatically; no vertical override needed.
      return `text-decoration-line: underline; text-decoration-style: wavy; text-decoration-color: ${color}; text-decoration-thickness: 2px; text-decoration-skip-ink: none;`;
    default:
      return `background: ${color};`;
  }
};

const hexToRgba = (hexColor: string, alpha: number): string => {
  const hex = hexColor.replace("#", "");
  const isShort = hex.length === 3;
  const normalized = isShort
    ? hex
        .split("")
        .map((ch) => ch + ch)
        .join("")
    : hex;
  if (normalized.length !== 6) return hexColor;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
export const isElectron = () => {
  // Renderer process
  if (
    typeof window !== "undefined" &&
    typeof window.process === "object" &&
    window.process.type === "renderer"
  ) {
    return true;
  }
  // Main process
  if (
    typeof process !== "undefined" &&
    typeof process.versions === "object" &&
    !!process.versions.electron
  ) {
    return true;
  }
  // Detect the user agent when the `nodeIntegration` option is set to true
  if (
    typeof navigator === "object" &&
    typeof navigator.userAgent === "string" &&
    navigator.userAgent.indexOf("Electron") >= 0
  ) {
    return true;
  }

  return false;
};
export const getBlockElement = (Element) => {
  return Array.from(
    Element.querySelectorAll(
      "h1,h2,h3,h4,h5,h6,p,div,ul,dl,ol,li,dt,dd,pre,blockquote,address,kookitmarker"
    )
  ) as HTMLElement[];
};
export const isParentBlock = (myDiv: Element) => {
  var children = myDiv.children;
  let flag = false;
  var blockRegex =
    /^(address|kookitmarker|section|blockquote|body|center|dir|div|dl|fieldset|form|h[1-6]|hr|isindex|menu|noframes|noscript|ol|p|pre|table|ul|dd|dt|frameset|li|tbody|td|tfoot|th|thead|tr|html)$/i;
  // let blockElementList = Array.from(children).filter((item) =>
  //   blockRegex.test(item.nodeName)
  // );
  // // some elements might contain image and image subtitle
  // if (blockElementList.length < 3) {
  //   return false;
  // }
  for (var i = 0; i < children.length; i++) {
    if (blockRegex.test(children[i].nodeName)) {
      flag = true;
      break;
    }
  }
  return flag;
};
export function parseStyleToMap(styleText: string): Record<string, string> {
  const map: Record<string, string> = {};
  if (!styleText) return map;
  const parts = styleText.split(";");
  for (const rawPart of parts) {
    const part = rawPart.trim();
    if (!part) continue;
    const idx = part.indexOf(":");
    if (idx <= 0) continue;
    const prop = part.slice(0, idx).trim().toLowerCase();
    const value = part.slice(idx + 1).trim();
    if (!prop) continue;
    map[prop] = value;
  }
  return map;
}

export function styleMapToString(map: Record<string, string>): string {
  const entries = Object.entries(map).filter(([, v]) => (v || "").trim());
  if (entries.length === 0) return "";
  // Preserve declaration order to keep shorthand/longhand cascade semantics.
  return entries.map(([k, v]) => `${k}: ${v}`).join("; ");
}

export function mergeStyleStrings(
  baseStyle: string,
  extraStyle: string
): string {
  const base = parseStyleToMap(baseStyle);
  const extra = parseStyleToMap(extraStyle);
  // extra overrides base; no duplication of identical declarations
  const merged: Record<string, string> = { ...base, ...extra };
  return styleMapToString(merged);
}

export function getViewportSize(
  htmlStr: string
): { width?: number; height?: number } | null {
  if (!htmlStr) return null;
  const metaMatch = htmlStr.match(
    /<meta\b[^>]*name\s*=\s*["']viewport["'][^>]*content\s*=\s*["']([^"']+)["'][^>]*>/i
  );
  if (!metaMatch) return null;
  const content = metaMatch[1] || "";
  const widthMatch = content.match(/\bwidth\s*=\s*(\d+(?:\.\d+)?)\b/i);
  const heightMatch = content.match(/\bheight\s*=\s*(\d+(?:\.\d+)?)\b/i);
  const width = widthMatch ? parseFloat(widthMatch[1]) : undefined;
  const height = heightMatch ? parseFloat(heightMatch[1]) : undefined;
  if (!width && !height) return null;
  return { width, height };
}

export function getStylePxNumber(
  styleText: string,
  prop: string
): number | null {
  if (!styleText || !prop) return null;
  const map = parseStyleToMap(styleText);
  const val = map[prop.toLowerCase()];
  if (!val) return null;
  // Only accept plain numbers or px values (e.g. "1571" / "1571px").
  // Reject values with other units like "%", "em", "rem", etc.
  const normalized = val.replace(/\s*!important\s*$/i, "").trim();
  const m = normalized.match(/^(-?\d+(?:\.\d+)?)(?:px)?$/i);
  if (!m) return null;
  const num = parseFloat(m[1]);
  return Number.isFinite(num) && num > 0 ? num : null;
}

export function getPageWidth(element: HTMLElement, readerMode: string): number {
  if (!element) return 0;
  const section = Math.floor(element.clientWidth / 12);
  const gap = section % 2 === 0 ? section : section - 1;
  const scale = readerMode === "double" ? 2 : 1;
  return (element.clientWidth - gap) / scale;
}
export const detectLocalLanguage = (text: string): string => {
  const chinesePattern = /[\u4e00-\u9fff\u3000-\u303f\uf900-\ufaff]/g;
  const japanesePattern = /[\u3040-\u309f\u30a0-\u30ff]/g;
  const koreanPattern = /[\uac00-\ud7af\u1100-\u11ff]/g;

  const chineseCount = (text.match(chinesePattern) || []).length;
  const japaneseCount = (text.match(japanesePattern) || []).length;
  const koreanCount = (text.match(koreanPattern) || []).length;

  const cjkTotal = chineseCount + japaneseCount + koreanCount;
  if (cjkTotal / text.length <= 0.3) return "en";

  if (chineseCount >= japaneseCount && chineseCount >= koreanCount) return "zh";
  if (japaneseCount >= chineseCount && japaneseCount >= koreanCount)
    return "ja";
  return "ko";
};
