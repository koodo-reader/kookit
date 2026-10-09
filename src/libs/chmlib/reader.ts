/**
 * ChmReader interface and built-in implementations.
 * Provides random-access reads over a CHM file without loading the entire file into memory.
 */

export interface ChmReader {
  read(offset: bigint, length: number): Promise<Uint8Array>;
  close?(): void | Promise<void>;
}

/** In-memory reader backed by a Uint8Array. Works in any environment. */
export function chmReaderFromBuffer(data: Uint8Array): ChmReader {
  return {
    read(offset: bigint, length: number): Promise<Uint8Array> {
      const start = Number(offset);
      const end = Math.min(start + length, data.length);
      return Promise.resolve(data.slice(start, end));
    },
  };
}
