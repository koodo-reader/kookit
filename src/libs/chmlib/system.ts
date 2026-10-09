import { BufferReader } from './buffer-reader.js';

export interface ChmSystemInfo {
  tocFile?: string;
  indexFile?: string;
  defaultTopic?: string;
  title?: string;
  defaultWindow?: string;
  compiledFile?: string;
  binaryToc?: boolean;
  binaryIndex?: boolean;
  compilerVersion?: string;
  defaultFont?: string;
}

/**
 * Parse the /#SYSTEM binary file from a CHM archive.
 * Format: a sequence of (type: uint16, length: uint16, data: bytes) records.
 */
export function parseSystemInfo(data: Uint8Array): ChmSystemInfo {
  const r = new BufferReader(data);
  const info: ChmSystemInfo = {};

  // First 4 bytes are a version/unknown field
  if (r.remaining < 4) return info;
  r.readUint32LE(); // version / unknown

  while (r.remaining >= 4) {
    const code = r.readUint16LE();
    const len = r.readUint16LE();
    if (r.remaining < len) break;

    const fieldData = r.readBytes(len);

    switch (code) {
      case 0: // TOC file path
        info.tocFile = decodeNullTerminated(fieldData);
        break;
      case 1: // Index file path
        info.indexFile = decodeNullTerminated(fieldData);
        break;
      case 2: // Default topic
        info.defaultTopic = decodeNullTerminated(fieldData);
        break;
      case 3: // Title
        info.title = decodeNullTerminated(fieldData);
        break;
      case 4: // Default window
        info.defaultWindow = decodeNullTerminated(fieldData);
        break;
      case 5: // Compiled file
        info.compiledFile = decodeNullTerminated(fieldData);
        break;
      case 6: // Binary TOC flag
        if (fieldData.length >= 4) {
          const r2 = new BufferReader(fieldData);
          info.binaryToc = r2.readUint32LE() !== 0;
        }
        break;
      case 7: // Binary index flag
        if (fieldData.length >= 4) {
          const r2 = new BufferReader(fieldData);
          info.binaryIndex = r2.readUint32LE() !== 0;
        }
        break;
      case 9: // Compiler version
        info.compilerVersion = decodeNullTerminated(fieldData);
        break;
      case 16: // Default font
        info.defaultFont = decodeNullTerminated(fieldData);
        break;
      default:
        // Unknown field, skip
        break;
    }
  }

  return info;
}

function decodeNullTerminated(data: Uint8Array): string {
  let len = data.length;
  while (len > 0 && data[len - 1] === 0) len--;
  return new TextDecoder('utf-8').decode(data.subarray(0, len));
}
