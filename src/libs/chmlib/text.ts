export interface DecodedText {
  text: string;
  encoding: string;
  source: 'explicit' | 'bom' | 'meta' | 'xml' | 'utf16-heuristic' | 'utf8' | 'fallback';
}

export function decodeText(
  data: Uint8Array,
  options: { charset?: string } = {},
): DecodedText {
  const explicitCharset = options.charset?.trim();
  if (explicitCharset) {
    return {
      text: decodeWithCharset(data, explicitCharset),
      encoding: explicitCharset,
      source: 'explicit',
    };
  }

  const bomCharset = detectBomCharset(data);
  if (bomCharset) {
    return {
      text: decodeWithCharset(data, bomCharset),
      encoding: bomCharset,
      source: 'bom',
    };
  }

  const utf16Charset = detectUtf16WithoutBom(data);
  if (utf16Charset) {
    return {
      text: decodeWithCharset(data, utf16Charset),
      encoding: utf16Charset,
      source: 'utf16-heuristic',
    };
  }

  const declared = sniffDeclaredCharset(data);
  if (declared) {
    return {
      text: decodeWithCharset(data, declared.encoding),
      encoding: declared.encoding,
      source: declared.source,
    };
  }

  if (isValidUtf8(data)) {
    return {
      text: new TextDecoder('utf-8').decode(data),
      encoding: 'utf-8',
      source: 'utf8',
    };
  }

  return {
    text: decodeWithCharset(data, 'windows-1252'),
    encoding: 'windows-1252',
    source: 'fallback',
  };
}

function decodeWithCharset(data: Uint8Array, charset: string): string {
  try {
    return new TextDecoder(charset).decode(data);
  } catch (error) {
    throw new Error(`Unsupported charset: ${charset}`);
  }
}

function detectBomCharset(data: Uint8Array): string | null {
  if (data.length >= 3 && data[0] === 0xef && data[1] === 0xbb && data[2] === 0xbf) {
    return 'utf-8';
  }
  if (data.length >= 2 && data[0] === 0xff && data[1] === 0xfe) {
    return 'utf-16le';
  }
  if (data.length >= 2 && data[0] === 0xfe && data[1] === 0xff) {
    return 'utf-16be';
  }
  return null;
}

function detectUtf16WithoutBom(data: Uint8Array): string | null {
  const sampleLen = Math.min(data.length, 256);
  if (sampleLen < 8) return null;

  let evenZeros = 0;
  let oddZeros = 0;

  for (let i = 0; i < sampleLen; i++) {
    if (data[i] !== 0) continue;
    if (i % 2 === 0) evenZeros++;
    else oddZeros++;
  }

  const evenRatio = evenZeros / Math.ceil(sampleLen / 2);
  const oddRatio = oddZeros / Math.max(1, Math.floor(sampleLen / 2));

  if (oddRatio > 0.3 && evenRatio < 0.05) return 'utf-16le';
  if (evenRatio > 0.3 && oddRatio < 0.05) return 'utf-16be';
  return null;
}

function sniffDeclaredCharset(
  data: Uint8Array,
): { encoding: string; source: 'meta' | 'xml' } | null {
  const sample = asciiSample(data);

  const xmlMatch = /<\?xml[^>]+encoding\s*=\s*["']([^"']+)["']/iu.exec(sample);
  if (xmlMatch?.[1]) {
    return { encoding: xmlMatch[1], source: 'xml' };
  }

  const metaCharsetMatch = /<meta[^>]+charset\s*=\s*["']?\s*([^"'>\s;]+)/iu.exec(sample);
  if (metaCharsetMatch?.[1]) {
    return { encoding: metaCharsetMatch[1], source: 'meta' };
  }

  const metaContentMatch = /<meta[^>]+content\s*=\s*["'][^"']*charset\s*=\s*([^"'>\s;]+)/iu.exec(sample);
  if (metaContentMatch?.[1]) {
    return { encoding: metaContentMatch[1], source: 'meta' };
  }

  return null;
}

function asciiSample(data: Uint8Array): string {
  const limit = Math.min(data.length, 4096);
  let result = '';

  for (let i = 0; i < limit; i++) {
    const byte = data[i];
    result += byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : ' ';
  }

  return result;
}

function isValidUtf8(data: Uint8Array): boolean {
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(data);
    return true;
  } catch {
    return false;
  }
}
