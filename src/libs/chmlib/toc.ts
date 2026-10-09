export interface ChmTocEntry {
  name: string;
  local?: string;       // path within the CHM
  children: ChmTocEntry[];
}

export interface ChmToc {
  entries: ChmTocEntry[];
}

/**
 * Parse a CHM .hhc / .hhk HTML sitemap file into a tree structure.
 * Format: HTML with <ul>/<li>/<object type="text/sitemap"> elements.
 */
export function parseToc(html: string): ChmToc {
  const entries = parseLevel(html, 0).entries;
  return { entries };
}

interface ParseResult {
  entries: ChmTocEntry[];
  endPos: number;
}

function parseLevel(html: string, startPos: number): ParseResult {
  const entries: ChmTocEntry[] = [];
  let pos = startPos;
  const len = html.length;

  while (pos < len) {
    // Find next tag
    const tagStart = html.indexOf('<', pos);
    if (tagStart === -1) break;

    const tagEnd = html.indexOf('>', tagStart);
    if (tagEnd === -1) break;

    const tag = html.slice(tagStart, tagEnd + 1);
    const tagLower = tag.toLowerCase();

    if (tagLower.startsWith('<li')) {
      // Parse a list item
      pos = tagEnd + 1;
      const entry = parseListItem(html, pos);
      entries.push(entry.entry);
      pos = entry.endPos;
    } else if (tagLower.startsWith('</ul') || tagLower.startsWith('</ol')) {
      // End of list
      return { entries, endPos: tagEnd + 1 };
    } else if (tagLower.startsWith('<ul') || tagLower.startsWith('<ol')) {
      // Start of nested list (unexpected at this level)
      pos = tagEnd + 1;
    } else {
      pos = tagEnd + 1;
    }
  }

  return { entries, endPos: len };
}

interface ListItemResult {
  entry: ChmTocEntry;
  endPos: number;
}

function peekTag(
  html: string,
  pos: number,
): { start: number; end: number } | null {
  let i = pos;
  while (i < html.length && /\s/.test(html[i])) i++;
  if (i >= html.length || html[i] !== '<') return null;
  const end = html.indexOf('>', i);
  if (end === -1) return null;
  return { start: i, end };
}

function parseListItem(html: string, startPos: number): ListItemResult {
  const len = html.length;
  let pos = startPos;
  let name = '';
  let local: string | undefined;
  const children: ChmTocEntry[] = [];

  while (pos < len) {
    const tagStart = html.indexOf('<', pos);
    if (tagStart === -1) break;

    const tagEnd = html.indexOf('>', tagStart);
    if (tagEnd === -1) break;

    const tag = html.slice(tagStart, tagEnd + 1);
    const tagLower = tag.toLowerCase();

    if (tagLower.includes('type="text/sitemap"') || tagLower.includes("type='text/sitemap'")) {
      // Parse <object type="text/sitemap">...</object>
      pos = tagEnd + 1;
      const objResult = parseObject(html, pos);
      name = objResult.name ?? name;
      local = objResult.local ?? local;
      pos = objResult.endPos;
    } else if (tagLower.startsWith('<ul') || tagLower.startsWith('<ol')) {
      // Nested list = children
      pos = tagEnd + 1;
      const childResult = parseLevel(html, pos);
      children.push(...childResult.entries);
      pos = childResult.endPos;
    } else if (tagLower.startsWith('</li')) {
      pos = tagEnd + 1;
      // HTML Help Workshop may emit child <UL>/<OL> blocks as siblings of a
      // closed </LI>; those blocks are the children of this item
      while (true) {
        const peek = peekTag(html, pos);
        if (!peek) break;
        const peekTagLower = html.slice(peek.start, peek.end + 1).toLowerCase();
        if (!peekTagLower.startsWith('<ul') && !peekTagLower.startsWith('<ol')) break;
        const childResult = parseLevel(html, peek.start);
        children.push(...childResult.entries);
        pos = childResult.endPos;
      }
      break;
    } else if (tagLower.startsWith('<li')) {
      // Next sibling item - don't consume
      break;
    } else if (tagLower.startsWith('</ul') || tagLower.startsWith('</ol')) {
      // End of parent list - don't consume
      break;
    } else {
      pos = tagEnd + 1;
    }
  }

  const entry: ChmTocEntry = { name, children };
  if (local !== undefined) entry.local = local;
  return { entry, endPos: pos };
}

interface ObjectResult {
  name?: string;
  local?: string;
  endPos: number;
}

function parseObject(html: string, startPos: number): ObjectResult {
  const len = html.length;
  let pos = startPos;
  let name: string | undefined;
  let local: string | undefined;

  while (pos < len) {
    const tagStart = html.indexOf('<', pos);
    if (tagStart === -1) break;

    const tagEnd = html.indexOf('>', tagStart);
    if (tagEnd === -1) break;

    const tag = html.slice(tagStart, tagEnd + 1);
    const tagLower = tag.toLowerCase();

    if (tagLower.startsWith('<param')) {
      const nameAttr = extractAttr(tag, 'name');
      const valueAttr = extractAttr(tag, 'value');
      if (nameAttr !== null && valueAttr !== null) {
        const n = nameAttr.toLowerCase();
        if (n === 'name') name = valueAttr;
        else if (n === 'local') local = valueAttr;
      }
      pos = tagEnd + 1;
    } else if (tagLower.startsWith('</object')) {
      pos = tagEnd + 1;
      break;
    } else {
      pos = tagEnd + 1;
    }
  }

  return { name, local, endPos: pos };
}

function extractAttr(tag: string, attrName: string): string | null {
  const re = new RegExp(`${attrName}\\s*=\\s*(?:"([^"]*)"|\\'([^\\']*)\\'|(\\S+))`, 'i');
  const m = re.exec(tag);
  if (!m) return null;
  return m[1] ?? m[2] ?? m[3] ?? null;
}
