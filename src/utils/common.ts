declare var window: any;
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
