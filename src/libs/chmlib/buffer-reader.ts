/**
 * Cursor-based binary reader using DataView with little-endian reads.
 * Replaces all _unmarshal_* functions from chm_lib.c.
 */
export class BufferReader {
  private view: DataView;
  private _offset: number;

  constructor(buffer: Uint8Array, offset = 0) {
    this.view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    this._offset = offset;
  }

  get offset(): number {
    return this._offset;
  }

  get remaining(): number {
    return this.view.byteLength - this._offset;
  }

  readUint8(): number {
    if (this._offset + 1 > this.view.byteLength)
      throw new RangeError(`BufferReader: read past end (offset=${this._offset}, need 1)`);
    const val = this.view.getUint8(this._offset);
    this._offset += 1;
    return val;
  }

  readInt16LE(): number {
    if (this._offset + 2 > this.view.byteLength)
      throw new RangeError(`BufferReader: read past end (offset=${this._offset}, need 2)`);
    const val = this.view.getInt16(this._offset, true);
    this._offset += 2;
    return val;
  }

  readUint16LE(): number {
    if (this._offset + 2 > this.view.byteLength)
      throw new RangeError(`BufferReader: read past end (offset=${this._offset}, need 2)`);
    const val = this.view.getUint16(this._offset, true);
    this._offset += 2;
    return val;
  }

  readInt32LE(): number {
    if (this._offset + 4 > this.view.byteLength)
      throw new RangeError(`BufferReader: read past end (offset=${this._offset}, need 4)`);
    const val = this.view.getInt32(this._offset, true);
    this._offset += 4;
    return val;
  }

  readUint32LE(): number {
    if (this._offset + 4 > this.view.byteLength)
      throw new RangeError(`BufferReader: read past end (offset=${this._offset}, need 4)`);
    const val = this.view.getUint32(this._offset, true);
    this._offset += 4;
    return val;
  }

  readBigInt64LE(): bigint {
    if (this._offset + 8 > this.view.byteLength)
      throw new RangeError(`BufferReader: read past end (offset=${this._offset}, need 8)`);
    const val = this.view.getBigInt64(this._offset, true);
    this._offset += 8;
    return val;
  }

  readBigUint64LE(): bigint {
    if (this._offset + 8 > this.view.byteLength)
      throw new RangeError(`BufferReader: read past end (offset=${this._offset}, need 8)`);
    const val = this.view.getBigUint64(this._offset, true);
    this._offset += 8;
    return val;
  }

  readBytes(count: number): Uint8Array {
    if (this._offset + count > this.view.byteLength)
      throw new RangeError(`BufferReader: read past end (offset=${this._offset}, need ${count})`);
    const result = new Uint8Array(this.view.buffer, this.view.byteOffset + this._offset, count);
    this._offset += count;
    // Return a copy so the caller owns the data
    return result.slice();
  }

  /** Read a fixed-length ASCII string */
  readAscii(count: number): string {
    const bytes = this.readBytes(count);
    return String.fromCharCode(...bytes);
  }

  skip(count: number): void {
    if (this._offset + count > this.view.byteLength)
      throw new RangeError(`BufferReader: skip past end (offset=${this._offset}, skip ${count})`);
    this._offset += count;
  }

  /** Read a LEB128 compressed word (variable-length integer used by CHM PMGL entries) */
  readCWord(): bigint {
    let accum = 0n;
    let temp: number;
    while ((temp = this.readUint8()) >= 0x80) {
      accum <<= 7n;
      accum += BigInt(temp & 0x7f);
    }
    return (accum << 7n) + BigInt(temp);
  }
}
