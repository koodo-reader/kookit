/*
Vendored from rtf.js (https://github.com/tbluemel/rtf.js)
The MIT License (MIT)

Copyright (c) 2015-2018 Thomas Bluemel
Copyright (c) 2018 Tom Zoehner

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

// 源码按 strictNullChecks: false 编写，内联后对文件整体关闭类型检查
// @ts-nocheck
import { SVG, SVGPathBuilder, SVGFilters } from "./svg";

// ===== wmfjs/Helper.ts =====
class WMFJSError extends Error {
    constructor(message: string) {
        super(message); // 'Error' breaks prototype chain here
        Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain
    }
}

let isLoggingEnabled = true;

function loggingEnabled(enabled: boolean): void {
    isLoggingEnabled = enabled;
}

class Helper {
    public static GDI = {
        METAHEADER_SIZE: 18,
        BITMAPINFOHEADER_SIZE: 40,
        BITMAPCOREHEADER_SIZE: 12,
        MetafileType: {
            MEMORYMETAFILE: 1,
            DISKMETAFILE: 2,
        },
        MetafileVersion: {
            METAVERSION100: 0x100,
            METAVERSION300: 0x300,
        },
        RecordType: {
            META_EOF: 0x0000,
            META_REALIZEPALETTE: 0x0035,
            META_SETPALENTRIES: 0x0037,
            META_SETBKMODE: 0x0102,
            META_SETMAPMODE: 0x0103,
            META_SETROP2: 0x0104,
            META_SETRELABS: 0x0105,
            META_SETPOLYFILLMODE: 0x0106,
            META_SETSTRETCHBLTMODE: 0x0107,
            META_SETTEXTCHAREXTRA: 0x0108,
            META_RESTOREDC: 0x0127,
            META_RESIZEPALETTE: 0x0139,
            META_DIBCREATEPATTERNBRUSH: 0x0142,
            META_SETLAYOUT: 0x0149,
            META_SETBKCOLOR: 0x0201,
            META_SETTEXTCOLOR: 0x0209,
            META_OFFSETVIEWPORTORG: 0x0211,
            META_LINETO: 0x0213,
            META_MOVETO: 0x0214,
            META_OFFSETCLIPRGN: 0x0220,
            META_FILLREGION: 0x0228,
            META_SETMAPPERFLAGS: 0x0231,
            META_SELECTPALETTE: 0x0234,
            META_POLYGON: 0x0324,
            META_POLYLINE: 0x0325,
            META_SETTEXTJUSTIFICATION: 0x020a,
            META_SETWINDOWORG: 0x020b,
            META_SETWINDOWEXT: 0x020c,
            META_SETVIEWPORTORG: 0x020d,
            META_SETVIEWPORTEXT: 0x020e,
            META_OFFSETWINDOWORG: 0x020f,
            META_SCALEWINDOWEXT: 0x0410,
            META_SCALEVIEWPORTEXT: 0x0412,
            META_EXCLUDECLIPRECT: 0x0415,
            META_INTERSECTCLIPRECT: 0x0416,
            META_ELLIPSE: 0x0418,
            META_FLOODFILL: 0x0419,
            META_FRAMEREGION: 0x0429,
            META_ANIMATEPALETTE: 0x0436,
            META_TEXTOUT: 0x0521,
            META_POLYPOLYGON: 0x0538,
            META_EXTFLOODFILL: 0x0548,
            META_RECTANGLE: 0x041b,
            META_SETPIXEL: 0x041f,
            META_ROUNDRECT: 0x061c,
            META_PATBLT: 0x061d,
            META_SAVEDC: 0x001e,
            META_PIE: 0x081a,
            META_STRETCHBLT: 0x0b23,
            META_ESCAPE: 0x0626,
            META_INVERTREGION: 0x012a,
            META_PAINTREGION: 0x012b,
            META_SELECTCLIPREGION: 0x012c,
            META_SELECTOBJECT: 0x012d,
            META_SETTEXTALIGN: 0x012e,
            META_ARC: 0x0817,
            META_CHORD: 0x0830,
            META_BITBLT: 0x0922,
            META_EXTTEXTOUT: 0x0a32,
            META_SETDIBTODEV: 0x0d33,
            META_DIBBITBLT: 0x0940,
            META_DIBSTRETCHBLT: 0x0b41,
            META_STRETCHDIB: 0x0f43,
            META_DELETEOBJECT: 0x01f0,
            META_CREATEPALETTE: 0x00f7,
            META_CREATEPATTERNBRUSH: 0x01f9,
            META_CREATEPENINDIRECT: 0x02fa,
            META_CREATEFONTINDIRECT: 0x02fb,
            META_CREATEBRUSHINDIRECT: 0x02fc,
            META_CREATEREGION: 0x06ff,
        },
        MetafileEscapes: {
            NEWFRAME: 0x0001,
            ABORTDOC: 0x0002,
            NEXTBAND: 0x0003,
            SETCOLORTABLE: 0x0004,
            GETCOLORTABLE: 0x0005,
            FLUSHOUT: 0x0006,
            DRAFTMODE: 0x0007,
            QUERYESCSUPPORT: 0x0008,
            SETABORTPROC: 0x0009,
            STARTDOC: 0x000a,
            ENDDOC: 0x000b,
            GETPHYSPAGESIZE: 0x000c,
            GETPRINTINGOFFSET: 0x000d,
            GETSCALINGFACTOR: 0x000e,
            META_ESCAPE_ENHANCED_METAFILE: 0x000f,
            SETPENWIDTH: 0x0010,
            SETCOPYCOUNT: 0x0011,
            SETPAPERSOURCE: 0x0012,
            PASSTHROUGH: 0x0013,
            GETTECHNOLOGY: 0x0014,
            SETLINECAP: 0x0015,
            SETLINEJOIN: 0x0016,
            SETMITERLIMIT: 0x0017,
            BANDINFO: 0x0018,
            DRAWPATTERNRECT: 0x0019,
            GETVECTORPENSIZE: 0x001a,
            GETVECTORBRUSHSIZE: 0x001b,
            ENABLEDUPLEX: 0x001c,
            GETSETPAPERBINS: 0x001d,
            GETSETPRINTORIENT: 0x001e,
            ENUMPAPERBINS: 0x001f,
            SETDIBSCALING: 0x0020,
            EPSPRINTING: 0x0021,
            ENUMPAPERMETRICS: 0x0022,
            GETSETPAPERMETRICS: 0x0023,
            POSTSCRIPT_DATA: 0x0025,
            POSTSCRIPT_IGNORE: 0x0026,
            GETDEVICEUNITS: 0x002a,
            GETEXTENDEDTEXTMETRICS: 0x0100,
            GETPAIRKERNTABLE: 0x0102,
            EXTTEXTOUT: 0x0200,
            GETFACENAME: 0x0201,
            DOWNLOADFACE: 0x0202,
            METAFILE_DRIVER: 0x0801,
            QUERYDIBSUPPORT: 0x0c01,
            BEGIN_PATH: 0x1000,
            CLIP_TO_PATH: 0x1001,
            END_PATH: 0x1002,
            OPEN_CHANNEL: 0x100e,
            DOWNLOADHEADER: 0x100f,
            CLOSE_CHANNEL: 0x1010,
            POSTSCRIPT_PASSTHROUGH: 0x1013,
            ENCAPSULATED_POSTSCRIPT: 0x1014,
            POSTSCRIPT_IDENTIFY: 0x1015,
            POSTSCRIPT_INJECTION: 0x1016,
            CHECKJPEGFORMAT: 0x1017,
            CHECKPNGFORMAT: 0x1018,
            GET_PS_FEATURESETTING: 0x1019,
            MXDC_ESCAPE: 0x101a,
            SPCLPASSTHROUGH2: 0x11d8,
        },
        MapMode: {
            MM_TEXT: 1,
            MM_LOMETRIC: 2,
            MM_HIMETRIC: 3,
            MM_LOENGLISH: 4,
            MM_HIENGLISH: 5,
            MM_TWIPS: 6,
            MM_ISOTROPIC: 7,
            MM_ANISOTROPIC: 8,
        },
        StretchMode: {
            BLACKONWHITE: 1,
            WHITEONBLACK: 2,
            COLORONCOLOR: 3,
            HALFTONE: 4,
        },
        TextAlignmentMode: {
            TA_UPDATECP: 1,
            TA_RIGHT: 2,
            TA_CENTER: 6,
            TA_BOTTOM: 8,
            TA_BASELINE: 24,
            TA_RTLREADING: 256,
        },
        MixMode: {
            TRANSPARENT: 1,
            OPAQUE: 2,
        },
        VerticalTextAlignmentMode: {
            VTA_BOTTOM: 2,
            VTA_CENTER: 6,
            VTA_LEFT: 8,
            VTA_BASELINE: 24,
        },
        BrushStyle: {
            BS_SOLID: 0,
            BS_NULL: 1,
            BS_HATCHED: 2,
            BS_PATTERN: 3,
            BS_INDEXED: 4,
            BS_DIBPATTERN: 5,
            BS_DIBPATTERNPT: 6,
            BS_PATTERN8X8: 7,
            BS_DIBPATTERN8X8: 8,
            BS_MONOPATTERN: 9,
        },
        PenStyle: {
            PS_SOLID: 0,
            PS_DASH: 1,
            PS_DOT: 2,
            PS_DASHDOT: 3,
            PS_DASHDOTDOT: 4,
            PS_NULL: 5,
            PS_INSIDEFRAME: 6,
            PS_USERSTYLE: 7,
            PS_ALTERNATE: 8,
            PS_ENDCAP_SQUARE: 256,
            PS_ENDCAP_FLAT: 512,
            PS_JOIN_BEVEL: 4096,
            PS_JOIN_MITER: 8192,
        },
        PolyFillMode: {
            ALTERNATE: 1,
            WINDING: 2,
        },
        ColorUsage: {
            DIB_RGB_COLORS: 0,
            DIB_PAL_COLORS: 1,
            DIB_PAL_INDICES: 2,
        },
        PaletteEntryFlag: {
            PC_RESERVED: 1,
            PC_EXPLICIT: 2,
            PC_NOCOLLAPSE: 4,
        },
        BitmapCompression: {
            BI_RGB: 0,
            BI_RLE8: 1,
            BI_RLE4: 2,
            BI_BITFIELDS: 3,
            BI_JPEG: 4,
            BI_PNG: 5,
        },
    };
    public static _uniqueId = 0;

    public static log(message: string): void {
        if (isLoggingEnabled) {
            console.log(message);
        }
    }

    public static _makeUniqueId(prefix: string): string {
        return "wmfjs_" + prefix + (this._uniqueId++);
    }

    public static _writeUint32Val(uint8arr: Uint8Array, pos: number, val: number): void {
        uint8arr[pos++] = val & 0xff;
        uint8arr[pos++] = (val >>> 8) & 0xff;
        uint8arr[pos++] = (val >>> 16) & 0xff;
        uint8arr[pos++] = (val >>> 24) & 0xff;
    }

    public static _blobToBinary(blob: Uint8Array): string {
        let ret = "";
        const len = blob.length;
        for (let i = 0; i < len; i++) {
            ret += String.fromCharCode(blob[i]);
        }
        return ret;
    }
}

// ===== wmfjs/Blob.ts =====
class Blob {
    public pos: number;
    private blob: Blob | ArrayBuffer;
    private data: Uint8Array;

    constructor(blob: Blob | ArrayBuffer, offset?: number) {
        if (blob instanceof Blob) {
            this.blob = blob.blob;
            this.data = blob.data;
            this.pos = offset || blob.pos;
        } else {
            this.blob = blob;
            this.data = new Uint8Array(blob);
            this.pos = offset || 0;
        }
    }

    public eof(): boolean {
        return this.pos >= this.data.length;
    }

    public seek(newpos: number): void {
        if (newpos < 0 || newpos > this.data.length) {
            throw new WMFJSError("Invalid seek position");
        }
        this.pos = newpos;
    }

    public skip(cnt: number): void {
        const newPos = this.pos + cnt;
        if (newPos > this.data.length) {
            throw new WMFJSError("Unexpected end of file");
        }
        this.pos = newPos;
    }

    public readBinary(cnt: number): string {
        const end = this.pos + cnt;
        if (end > this.data.length) {
            throw new WMFJSError("Unexpected end of file");
        }
        let ret = "";
        while (cnt-- > 0) {
            ret += String.fromCharCode(this.data[this.pos++]);
        }
        return ret;
    }

    public readInt8(): number {
        if (this.pos + 1 > this.data.length) {
            throw new WMFJSError("Unexpected end of file");
        }
        return this.data[this.pos++];
    }

    public readUint8(): number {
        return this.readInt8() >>> 0;
    }

    public readInt32(): number {
        if (this.pos + 4 > this.data.length) {
            throw new WMFJSError("Unexpected end of file");
        }
        let val = this.data[this.pos++];
        val |= this.data[this.pos++] << 8;
        val |= this.data[this.pos++] << 16;
        val |= this.data[this.pos++] << 24;
        return val;
    }

    public readUint32(): number {
        return this.readInt32() >>> 0;
    }

    public readUint16(): number {
        if (this.pos + 2 > this.data.length) {
            throw new WMFJSError("Unexpected end of file");
        }
        let val = this.data[this.pos++];
        val |= this.data[this.pos++] << 8;
        return val;
    }

    public readInt16(): number {
        let val = this.readUint16();
        if (val > 32767) {
            val -= 65536;
        }
        return val;
    }

    public readString(length: number): string {
        if (this.pos + length > this.data.length) {
            throw new WMFJSError("Unexpected end of file");
        }
        let ret = "";
        for (let i = 0; i < length; i++) {
            ret += String.fromCharCode(this.data[this.pos++] >>> 0);
        }
        return ret;
    }

    public readNullTermString(maxSize: number): string {
        let ret = "";
        if (maxSize > 0) {
            maxSize--;
            for (let i = 0; i < maxSize; i++) {
                if (this.pos + i + 1 > this.data.length) {
                    throw new WMFJSError("Unexpected end of file");
                }
                const byte = this.data[this.pos + i] >>> 0;
                if (byte === 0) {
                    break;
                }
                ret += String.fromCharCode(byte);
            }
        }
        return ret;
    }
}

// ===== wmfjs/Primitives.ts =====
class PointS {
    public x: number;
    public y: number;

    constructor(reader: Blob, x?: number, y?: number) {
        if (reader != null) {
            this.x = reader.readInt16();
            this.y = reader.readInt16();
        } else {
            this.x = x;
            this.y = y;
        }
    }

    public clone(): PointS {
        return new PointS(null, this.x, this.y);
    }

    public toString(): string {
        return "{x: " + this.x + ", y: " + this.y + "}";
    }
}

class Rect {
    public bottom: number;
    public right: number;
    public top: number;
    public left: number;

    constructor(reader: Blob, left?: number, top?: number, right?: number, bottom?: number) {
        if (reader != null) {
            this.bottom = reader.readInt16();
            this.right = reader.readInt16();
            this.top = reader.readInt16();
            this.left = reader.readInt16();
        } else {
            this.bottom = bottom;
            this.right = right;
            this.top = top;
            this.left = left;
        }
    }

    public clone(): Rect {
        return new Rect(null, this.left, this.top, this.right, this.bottom);
    }

    public toString(): string {
        return "{left: " + this.left + ", top: " + this.top + ", right: " + this.right
            + ", bottom: " + this.bottom + "}";
    }

    public empty(): boolean {
        return this.left >= this.right || this.top >= this.bottom;
    }

    public intersect(rect: Rect): null | Rect {
        if (this.empty() || rect.empty()) {
            return null;
        }
        if (this.left >= rect.right || this.top >= rect.bottom ||
            this.right <= rect.left || this.bottom <= rect.top) {
            return null;
        }
        return new Rect(null, Math.max(this.left, rect.left), Math.max(this.top, rect.top),
            Math.min(this.right, rect.right), Math.min(this.bottom, rect.bottom));
    }
}

class Obj {
    public type: string;

    constructor(type: string) {
        this.type = type;
    }

    public clone(): Obj {
        throw new WMFJSError("clone not implemented");
    }

    public toString(): string {
        throw new WMFJSError("toString not implemented");
    }
}

// ===== wmfjs/Bitmap.ts =====
interface Bitmap {
    getWidth(): number

    getHeight(): number
}

class BitmapCoreHeader {
    public width: number;
    public height: number;
    public planes: number;
    public bitcount: number;

    constructor(reader: Blob, skipsize: boolean) {
        if (skipsize) {
            reader.skip(4);
        }
        this.width = reader.readUint16();
        this.height = reader.readUint16();
        this.planes = reader.readUint16();
        this.bitcount = reader.readUint16();
    }

    public colors(): number {
        return this.bitcount <= 8 ? 1 << this.bitcount : 0;
    }
}

class BitmapInfoHeader {
    public width: number;
    public height: number;
    public planes: number;
    public bitcount: number;
    public compression: number;
    public sizeimage: number;
    public xpelspermeter: number;
    public ypelspermeter: number;
    public clrused: number;
    public clrimportant: number;

    constructor(reader: Blob, skipsize: boolean) {
        if (skipsize) {
            reader.skip(4);
        }
        this.width = reader.readInt32();
        this.height = reader.readInt32();
        this.planes = reader.readUint16();
        this.bitcount = reader.readUint16();
        this.compression = reader.readUint32();
        this.sizeimage = reader.readUint32();
        this.xpelspermeter = reader.readInt32();
        this.ypelspermeter = reader.readInt32();
        this.clrused = reader.readUint32();
        this.clrimportant = reader.readUint32();
    }

    public colors(): number {
        if (this.clrused !== 0) {
            return this.clrused < 256 ? this.clrused : 256;
        } else {
            return this.bitcount > 8 ? 0 : 1 << this.bitcount;
        }
    }
}

class BitmapInfo implements Bitmap {
    private _reader: Blob;
    private _offset: number;
    private _usergb: boolean;
    private _infosize: number;
    private _header: BitmapCoreHeader | BitmapInfoHeader;

    constructor(reader: Blob, usergb: boolean) {
        this._reader = reader;
        this._offset = reader.pos;
        this._usergb = usergb;
        const hdrsize = reader.readUint32();
        this._infosize = hdrsize;
        if (hdrsize === Helper.GDI.BITMAPCOREHEADER_SIZE) {
            this._header = new BitmapCoreHeader(reader, false);
            this._infosize += this._header.colors() * (usergb ? 3 : 2);
        } else {
            this._header = new BitmapInfoHeader(reader, false);
            const masks =
                (this._header as BitmapInfoHeader).compression === Helper.GDI.BitmapCompression.BI_BITFIELDS ? 3 : 0;
            if (hdrsize <= Helper.GDI.BITMAPINFOHEADER_SIZE + (masks * 4)) {
                this._infosize = Helper.GDI.BITMAPINFOHEADER_SIZE + (masks * 4);
            }
            this._infosize += this._header.colors() * (usergb ? 4 : 2);
        }
    }

    public getWidth(): number {
        return this._header.width;
    }

    public getHeight(): number {
        return Math.abs(this._header.height);
    }

    public infosize(): number {
        return this._infosize;
    }

    public header(): BitmapCoreHeader | BitmapInfoHeader {
        return this._header;
    }
}

class DIBitmap implements Bitmap {
    private _reader: Blob;
    private _offset: number;
    private _size: number;
    private _info: BitmapInfo;

    constructor(reader: Blob, size: number) {
        this._reader = reader;
        this._offset = reader.pos;
        this._size = size;
        this._info = new BitmapInfo(reader, true);
    }

    public getWidth(): number {
        return this._info.getWidth();
    }

    public getHeight(): number {
        return this._info.getHeight();
    }

    public base64ref(): string {
        const prevpos = this._reader.pos;
        this._reader.seek(this._offset);
        let mime = "image/bmp";
        const header = this._info.header();
        let data;
        if (header instanceof BitmapInfoHeader && header.compression != null) {
            switch (header.compression) {
                case Helper.GDI.BitmapCompression.BI_JPEG:
                    mime = "data:image/jpeg";
                    break;
                case Helper.GDI.BitmapCompression.BI_PNG:
                    mime = "data:image/png";
                    break;
                default:
                    data = this.makeBitmapFileHeader();
                    break;
            }
        } else {
            data = this.makeBitmapFileHeader();
        }

        if (data != null) {
            data += this._reader.readBinary(this._size);
        } else {
            data = this._reader.readBinary(this._size);
        }

        const ref = "data:" + mime + ";base64," + btoa(data);
        this._reader.seek(prevpos);
        return ref;
    }

    private makeBitmapFileHeader() {
        const buf = new ArrayBuffer(14);
        const view = new Uint8Array(buf);
        view[0] = 0x42;
        view[1] = 0x4d;
        Helper._writeUint32Val(view, 2, this._size + 14);
        Helper._writeUint32Val(view, 10, this._info.infosize() + 14);
        return Helper._blobToBinary(view);
    }
}

class Bitmap16 implements Bitmap {
    public type: number;
    public width: number;
    public height: number;
    public widthBytes: number;
    public planes: number;
    public bitsPixel: number;
    public bitsOffset: number;
    public bitsSize: number;
    private _reader: Blob;
    private _offset: number;
    private _size: number;

    constructor(reader: Blob, size: number | Bitmap16) {
        if (reader != null) {
            size = size as number;
            this._reader = reader;
            this._offset = reader.pos;
            this._size = size;
            this.type = reader.readInt16();
            this.width = reader.readInt16();
            this.height = reader.readInt16();
            this.widthBytes = reader.readInt16();
            this.planes = reader.readUint8();
            this.bitsPixel = reader.readUint8();
            this.bitsOffset = reader.pos;
            this.bitsSize = (((this.width * this.bitsPixel + 15) >> 4) << 1) * this.height;
            if (this.bitsSize > size - 10) {
                throw new WMFJSError("Bitmap should have " + this.bitsSize + " bytes, but has " + (size - 10));
            }
        } else {
            const copy = size as Bitmap16;
            this._reader = copy._reader;
            this._offset = copy._offset;
            this._size = copy._size;
            this.type = copy.type;
            this.width = copy.width;
            this.height = copy.height;
            this.widthBytes = copy.widthBytes;
            this.planes = copy.planes;
            this.bitsPixel = copy.bitsPixel;
            this.bitsOffset = copy.bitsOffset;
            this.bitsSize = copy.bitsSize;
        }
    }

    public getWidth(): number {
        return this.width;
    }

    public getHeight(): number {
        return this.height;
    }

    public clone(): Bitmap16 {
        return new Bitmap16(null, this);
    }
}

class PatternBitmap16 extends Bitmap16 {
    constructor(reader: Blob, size: number | Bitmap16) {
        super(reader, size);
        if (reader != null) {
            this.bitsOffset += 22; // skip bits (4 bytes) + reserved (18 bytes)
        }
    }

    public clone(): PatternBitmap16 {
        return new PatternBitmap16(null, this);
    }
}

// ===== wmfjs/Style.ts =====
class ColorRef {
    public r: number;
    public g: number;
    public b: number;

    constructor(reader: Blob, r?: number, g?: number, b?: number) {
        if (reader != null) {
            this.r = reader.readUint8();
            this.g = reader.readUint8();
            this.b = reader.readUint8();
            reader.skip(1);
        } else {
            this.r = r;
            this.g = g;
            this.b = b;
        }
    }

    public clone(): ColorRef {
        return new ColorRef(null, this.r, this.g, this.b);
    }

    public toHex(): string {
        const rgb = (this.r << 16) | (this.g << 8) | this.b;
        return (0x1000000 + rgb).toString(16).slice(1);
    }

    public toString(): string {
        return "{r: " + this.r + ", g: " + this.g + ", b: " + this.b + "}";
    }
}

class Font extends Obj {
    public height: number;
    public width: number;
    public escapement: number;
    public orientation: number;
    public weight: number;
    public italic: number;
    public underline: number;
    public strikeout: number;
    public charset: number;
    public outprecision: number;
    public clipprecision: number;
    public quality: number;
    public pitch: number;
    public family: number;
    public facename: string;

    constructor(reader: Blob, copy: Font | number) {
        super("font");
        if (reader != null) {
            this.height = reader.readInt16();
            this.width = reader.readInt16();
            this.escapement = reader.readInt16();
            this.orientation = reader.readInt16();
            this.weight = reader.readInt16();
            this.italic = reader.readUint8();
            this.underline = reader.readUint8();
            this.strikeout = reader.readUint8();
            this.charset = reader.readUint8();
            this.outprecision = reader.readUint8();
            this.clipprecision = reader.readUint8();
            this.quality = reader.readUint8();
            const pitchAndFamily = reader.readUint8();
            this.pitch = pitchAndFamily & 0xf; // TODO: double check
            this.family = (pitchAndFamily >> 6) & 0x3; // TODO: double check

            const dataLength = copy as number;
            const start = reader.pos;
            this.facename = reader.readNullTermString(Math.min(dataLength - (reader.pos - start), 32));
        } else if (copy != null) {
            copy = copy as Font;
            this.height = copy.height;
            this.width = copy.width;
            this.escapement = copy.escapement;
            this.orientation = copy.orientation;
            this.weight = copy.weight;
            this.italic = copy.italic;
            this.underline = copy.underline;
            this.strikeout = copy.strikeout;
            this.charset = copy.charset;
            this.outprecision = copy.outprecision;
            this.clipprecision = copy.clipprecision;
            this.quality = copy.quality;
            this.pitch = copy.pitch;
            this.family = copy.family;
            this.facename = copy.facename;
        } else {
            // TODO: Values for a default font?
            this.height = -80;
            this.width = 0;
            this.escapement = 0;
            this.orientation = 0;
            this.weight = 400;
            this.italic = 0;
            this.underline = 0;
            this.strikeout = 0;
            this.charset = 0;
            this.outprecision = 0;
            this.clipprecision = 0;
            this.quality = 0;
            this.pitch = 0;
            this.family = 0;
            this.facename = "Helvetica";
        }
    }

    public clone(): Font {
        return new Font(null, this);
    }

    public toString(): string {
        return JSON.stringify(this);
    }
}

class Brush extends Obj {
    public style: number;
    public color: ColorRef;
    public pattern: Bitmap16;
    public colorusage: number;
    public dibpatternpt: DIBitmap;
    public hatchstyle: number;

    constructor(reader: Blob, copy: Brush | number, forceDibPattern?: boolean | PatternBitmap16) {
        super("brush");
        if (reader != null) {
            const dataLength = copy as number;
            const start = reader.pos;

            if (forceDibPattern === true || forceDibPattern === false) {
                this.style = reader.readUint16();
                if (forceDibPattern && this.style !== Helper.GDI.BrushStyle.BS_PATTERN) {
                    this.style = Helper.GDI.BrushStyle.BS_DIBPATTERNPT;
                }
                switch (this.style) {
                    case Helper.GDI.BrushStyle.BS_SOLID:
                        this.color = new ColorRef(reader);
                        break;
                    case Helper.GDI.BrushStyle.BS_PATTERN:
                        reader.skip(forceDibPattern ? 2 : 6);
                        this.pattern = new Bitmap16(reader, dataLength - (reader.pos - start));
                        break;
                    case Helper.GDI.BrushStyle.BS_DIBPATTERNPT:
                        this.colorusage = forceDibPattern ? reader.readUint16() : reader.readUint32();
                        if (!forceDibPattern) {
                            reader.skip(2);
                        }
                        this.dibpatternpt = new DIBitmap(reader, dataLength - (reader.pos - start));
                        break;
                    case Helper.GDI.BrushStyle.BS_HATCHED:
                        this.color = new ColorRef(reader);
                        this.hatchstyle = reader.readUint16();
                        break;
                }
            } else if (forceDibPattern instanceof PatternBitmap16) {
                this.style = Helper.GDI.BrushStyle.BS_PATTERN;
                this.pattern = forceDibPattern;
            }
        } else if (copy != null) {
            copy = copy as Brush;
            this.style = copy.style;
            switch (this.style) {
                case Helper.GDI.BrushStyle.BS_SOLID:
                    this.color = copy.color.clone();
                    break;
                case Helper.GDI.BrushStyle.BS_PATTERN:
                    this.pattern = copy.pattern.clone();
                    break;
                case Helper.GDI.BrushStyle.BS_DIBPATTERNPT:
                    this.colorusage = copy.colorusage;
                    this.dibpatternpt = copy.dibpatternpt;
                    break;
                case Helper.GDI.BrushStyle.BS_HATCHED:
                    this.color = copy.color.clone();
                    this.hatchstyle = copy.hatchstyle;
                    break;
            }
        }
    }

    public clone(): Brush {
        return new Brush(null, this);
    }

    public toString(): string {
        let ret = "{style: " + this.style;
        switch (this.style) {
            case Helper.GDI.BrushStyle.BS_SOLID:
                ret += ", color: " + this.color.toString();
                break;
            case Helper.GDI.BrushStyle.BS_DIBPATTERNPT:
                ret += ", colorusage: " + this.colorusage;
                break;
            case Helper.GDI.BrushStyle.BS_HATCHED:
                ret += ", color: " + this.color.toString() + ", hatchstyle: " + this.hatchstyle;
                break;
        }
        return ret + "}";
    }
}

class Pen extends Obj {
    public style: number;
    public width: PointS;
    public color: ColorRef;
    public linecap: number;
    public join: number;

    constructor(reader: Blob, style?: number, width?: PointS, color?: ColorRef, linecap?: number, join?: number) {
        super("pen");
        if (reader != null) {
            style = reader.readUint16();
            this.style = style & 0xFF;
            this.width = new PointS(reader);
            this.color = new ColorRef(reader);
            this.linecap = (style & (Helper.GDI.PenStyle.PS_ENDCAP_SQUARE | Helper.GDI.PenStyle.PS_ENDCAP_FLAT));
            this.join = (style & (Helper.GDI.PenStyle.PS_JOIN_BEVEL | Helper.GDI.PenStyle.PS_JOIN_MITER));
        } else {
            this.style = style;
            this.width = width;
            this.color = color;
            this.linecap = linecap;
            this.join = join;
        }
    }

    public clone(): Pen {
        return new Pen(null, this.style, this.width.clone(), this.color.clone(), this.linecap, this.join);
    }

    public toString(): string {
        return "{style: " + this.style + ", width: " + this.width.toString() + ", color: " + this.color.toString()
            + ", linecap: " + this.linecap + ", join: " + this.join + "}";
    }
}

class PaletteEntry {
    public flag: number;
    public b: number;
    public g: number;
    public r: number;

    constructor(reader: Blob, copy?: PaletteEntry) {
        if (reader != null) {
            this.flag = reader.readUint8();
            this.b = reader.readUint8();
            this.g = reader.readUint8();
            this.r = reader.readUint8();
        } else {
            this.flag = copy.flag;
            this.b = copy.b;
            this.g = copy.g;
            this.r = copy.r;
        }
    }

    public clone(): PaletteEntry {
        return new PaletteEntry(null, this);
    }
}

class Palette extends Obj {
    public start: number;
    public entries: PaletteEntry[];

    constructor(reader: Blob, copy?: Palette) {
        super("palette");
        if (reader != null) {
            this.start = reader.readUint16();
            let cnt = reader.readUint16();
            this.entries = [];
            while (cnt > 0) {
                this.entries.push(new PaletteEntry(reader));
                cnt--;
            }
        } else {
            this.start = copy.start;
            this.entries = [];
            const len = copy.entries.length;
            for (let i = 0; i < len; i++) {
                this.entries.push(copy.entries[i]);
            }
        }
    }

    public clone(): Palette {
        return new Palette(null, this);
    }

    public toString(): string {
        return "{ #entries: " + this.entries.length + "}"; // TODO
    }
}

// ===== wmfjs/Region.ts =====
class Region extends Obj {
    public bounds: Rect;
    public scans: Scan[];
    public complexity: number;

    constructor(reader: Blob, copy?: Region) {
        super("region");
        if (reader != null) {
            reader.skip(2);
            if (reader.readInt16() !== 6) {
                throw new WMFJSError("Invalid region identifier");
            }
            reader.skip(2);
            const rgnSize = reader.readInt16();
            const scanCnt = reader.readInt16();
            reader.skip(2);
            // note, Rect in reverse, can't use Rect(reader) directly
            const left = reader.readInt16();
            const top = reader.readInt16();
            const right = reader.readInt16();
            const bottom = reader.readInt16();
            this.bounds = new Rect(null, left, top, right, bottom);
            this.scans = [];
            for (let i = 0; i < scanCnt; i++) {
                this.scans.push(new Scan(reader));
            }
            this._updateComplexity();
        } else if (copy != null) {
            this.bounds = copy.bounds != null ? copy.bounds.clone() : null;
            if (copy.scans != null) {
                this.scans = [];
                for (let i = 0; i < copy.scans.length; i++) {
                    this.scans.push(copy.scans[i].clone());
                }
            } else {
                this.scans = null;
            }
            this.complexity = copy.complexity;
        } else {
            this.bounds = null;
            this.scans = null;
            this.complexity = 0;
        }
    }

    public clone(): Region {
        return new Region(null, this);
    }

    public toString(): string {
        const _complexity = ["null", "simple", "complex"];
        return "{complexity: " + _complexity[this.complexity]
            + " bounds: " + (this.bounds != null ? this.bounds.toString() : "[none]")
            + " #scans: " + (this.scans != null ? this.scans.length : "[none]") + "}";
    }

    public _updateComplexity(): void {
        if (this.bounds == null) {
            this.complexity = 0;
            this.scans = null;
        } else if (this.bounds.empty()) {
            this.complexity = 0;
            this.scans = null;
            this.bounds = null;
        } else if (this.scans == null) {
            this.complexity = 1;
        } else {
            this.complexity = 2;
            if (this.scans.length === 1) {
                const scan = this.scans[0];
                if (scan.top === this.bounds.top && scan.bottom === this.bounds.bottom && scan.scanlines.length === 1) {
                    const scanline = scan.scanlines[0];
                    if (scanline.left === this.bounds.left && scanline.right === this.bounds.right) {
                        this.scans = null;
                        this.complexity = 1;
                    }
                }
            }
        }
    }

    public subtract(rect: Rect): void {
        Helper.log("[wmf] Region " + this.toString() + " subtract " + rect.toString());

        if (this.bounds != null) {
            const isect = this.bounds.intersect(rect);
            if (isect != null) { // Only need to do anything if there is any chance of an overlap
                if (this.scans == null) {
                    // We currently have a simple region and there is some kind of an overlap.
                    // We need to create scanlines now.  Simplest method is to fake one scan line
                    // that equals the simple region and re-use the same logic as for complex regions
                    this.scans = [];
                    this.scans.push(new Scan(null, null, this.bounds.top, this.bounds.bottom,
                        [{left: this.bounds.left, right: this.bounds.right}]));
                    this.complexity = 2;
                }

                // We (now) have a complex region.  First we skip any scans that are entirely above rect.top
                // The first scan that falls partially below rect.top needs to be split into two scans.
                let si = 0;
                while (si < this.scans.length) {
                    const scan = this.scans[si];
                    if (scan.bottom >= rect.top) {
                        // We need to clone this scan into two so that we can subtract from the second one
                        const cloned = scan.clone();
                        scan.bottom = rect.top - 1;
                        cloned.top = rect.top;
                        if (scan.top >= scan.bottom) {
                            this.scans[si] = cloned;
                        } else {
                            Helper.log("[wmf] Region split top scan " + si + " for substraction");
                            this.scans.splice(++si, 0, cloned);
                        }
                        break;
                    }
                    si++;
                }

                // Now find the first one that falls at least partially below rect.bottom, which needs to be
                // split if it is only partially below rect.bottom
                const first = si;
                while (si < this.scans.length) {
                    const scan = this.scans[si];
                    if (scan.top > rect.bottom) {
                        break;
                    }
                    if (scan.bottom > rect.bottom) {
                        // We need to clone this scan into two so that we can subtract from the first one
                        const cloned = scan.clone();
                        scan.bottom = rect.bottom;
                        cloned.top = rect.bottom + 1;
                        if (scan.top >= scan.bottom) {
                            this.scans[si] = cloned;
                        } else {
                            Helper.log("[wmf] Region split bottom scan " + si + " for substraction");
                            this.scans.splice(++si, 0, cloned);
                        }
                        break;
                    }
                    si++;
                }

                // Now perform a subtraction on each scan in between rect.top and rect.bottom.  Because we
                // cloned scans that partially overlapped rect.top and rect.bottom, we don't have to
                // account for this anymore.
                if (first < this.scans.length) {
                    let last = si;
                    si = first;
                    while (si < last) {
                        const scan = this.scans[si];
                        if (!scan.subtract(rect.left, rect.right)) {
                            Helper.log("[wmf] Region remove now empty scan " + si + " due to subtraction");
                            this.scans.splice(si, 1);
                            last--;
                            continue;
                        }

                        si++;
                    }
                }

                // Update bounds
                if (this.scans != null) {
                    let left;
                    let top;
                    let right;
                    let bottom;
                    const len = this.scans.length;
                    for (let i = 0; i < len; i++) {
                        const scan = this.scans[i];
                        if (i === 0) {
                            top = scan.top;
                        }
                        if (i === len - 1) {
                            bottom = scan.bottom;
                        }

                        const slen = scan.scanlines.length;
                        if (slen > 0) {
                            let scanline = scan.scanlines[0];
                            if (left == null || scanline.left < left) {
                                left = scanline.left;
                            }
                            scanline = scan.scanlines[slen - 1];
                            if (right == null || scanline.right > right) {
                                right = scanline.right;
                            }
                        }
                    }

                    if (left != null && top != null && right != null && bottom != null) {
                        this.bounds = new Rect(null, left, top, right, bottom);
                        this._updateComplexity();
                    } else {
                        // This has to be a null region now
                        this.bounds = null;
                        this.scans = null;
                        this.complexity = 0;
                    }
                } else {
                    this._updateComplexity();
                }
            }
        }

        Helper.log("[wmf] Region subtraction -> " + this.toString());
    }

    public intersect(rect: Rect): void {
        Helper.log("[wmf] Region " + this.toString() + " intersect with " + rect.toString());
        if (this.bounds != null) {
            this.bounds = this.bounds.intersect(rect);
            if (this.bounds != null) {
                if (this.scans != null) {
                    let si = 0;
                    // Remove any scans that are entirely above the new bounds.top
                    while (si < this.scans.length) {
                        const scan = this.scans[si];
                        if (scan.bottom < this.bounds.top) {
                            si++;
                        } else {
                            break;
                        }
                    }
                    if (si > 0) {
                        Helper.log("[wmf] Region remove " + si + " scans from top");
                        this.scans.splice(0, si);

                        // Adjust the first scan's top to match the new bounds.top
                        if (this.scans.length > 0) {
                            this.scans[0].top = this.bounds.top;
                        }
                    }

                    // Get rid of anything that falls outside the new bounds.left/bounds.right
                    si = 0;
                    while (si < this.scans.length) {
                        const scan = this.scans[si];
                        if (scan.top > this.bounds.bottom) {
                            // Remove this and all remaining scans that fall entirely below the new bounds.bottom
                            Helper.log("[wmf] Region remove " + (this.scans.length - si) + " scans from bottom");
                            this.scans.splice(si, this.scans.length - si);
                            break;
                        }
                        if (!scan.intersect(this.bounds.left, this.bounds.right)) {
                            // Remove now empty scan
                            Helper.log("[wmf] Region remove now empty scan " + si + " due to intersection");
                            this.scans.splice(si, 1);
                            continue;
                        }
                        si++;
                    }

                    // If there are any scans left, adjust the last one's bottom to the new bounds.bottom
                    if (this.scans.length > 0) {
                        this.scans[this.scans.length - 1].bottom = this.bounds.bottom;
                    }

                    this._updateComplexity();
                }
            } else {
                this.scans = null;
                this.complexity = 0;
            }
        }
        Helper.log("[wmf] Region intersection -> " + this.toString());
    }

    public offset(offX: number, offY: number): void {
        if (this.bounds != null) {
            this.bounds.left += offX;
            this.bounds.top += offY;
            this.bounds.right += offX;
            this.bounds.bottom += offY;
        }

        if (this.scans != null) {
            const slen = this.scans.length;
            for (let si = 0; si < slen; si++) {
                const scan = this.scans[si];
                scan.top += offY;
                scan.bottom += offY;

                const len = scan.scanlines.length;
                for (let i = 0; i < len; i++) {
                    const scanline = scan.scanlines[i];
                    scanline.left += offX;
                    scanline.right += offX;
                }
            }
        }
    }
}

function CreateSimpleRegion(left: number, top: number, right: number, bottom: number): Region {
    const rgn = new Region(null, null);
    rgn.bounds = new Rect(null, left, top, right, bottom);
    rgn._updateComplexity();
    return rgn;
}

class Scan {
    public top: number;
    public bottom: number;
    public scanlines: { left: number, right: number }[];

    constructor(reader: Blob, copy?: Scan, top?: number, bottom?: number,
                scanlines?: { left: number, right: number }[]) {
        if (reader != null) {
            const cnt = reader.readUint16();
            this.top = reader.readUint16();
            this.bottom = reader.readUint16();
            this.scanlines = [];
            for (let i = 0; i < cnt; i++) {
                const left = reader.readUint16();
                const right = reader.readUint16();
                this.scanlines.push({left, right});
            }
            reader.skip(2);
        } else if (copy != null) {
            this.top = copy.top;
            this.bottom = copy.bottom;
            this.scanlines = [];
            for (let i = 0; i < copy.scanlines.length; i++) {
                const scanline = copy.scanlines[i];
                this.scanlines.push({left: scanline.left, right: scanline.right});
            }
        } else {
            this.top = top;
            this.bottom = bottom;
            this.scanlines = scanlines;
        }
    }

    public clone(): Scan {
        return new Scan(null, this);
    }

    public subtract(left: number, right: number): boolean {
        let i;

        // Keep everything on the left side
        i = 0;
        while (i < this.scanlines.length) {
            const scanline = this.scanlines[i];
            if (scanline.left <= left) {
                if (scanline.right >= left) {
                    scanline.right = left - 1;
                    if (scanline.left >= scanline.right) {
                        this.scanlines.splice(i, 1);
                        continue;
                    }
                }
                i++;
            } else {
                break;
            }
        }

        // Find the first one that may exceed to the right side
        const first = i;
        let cnt = 0;
        while (i < this.scanlines.length) {
            const scanline = this.scanlines[i];
            if (scanline.right > right) {
                scanline.left = right;
                cnt = i - first;
                if (scanline.left >= scanline.right) {
                    cnt++;
                }
                break;
            }
            i++;
        }

        // Delete everything we're subtracting
        if (cnt > 0 && first < this.scanlines.length) {
            this.scanlines.splice(first, cnt);
        }

        return this.scanlines.length > 0;
    }

    public intersect(left: number, right: number): boolean {
        // Get rid of anything that falls entirely outside to the left
        for (let i = 0; i < this.scanlines.length; i++) {
            const scanline = this.scanlines[i];
            if (scanline.left >= left || scanline.right >= left) {
                if (i > 0) {
                    this.scanlines.splice(0, i);
                }
                break;
            }
        }

        if (this.scanlines.length > 0) {
            // Adjust the first to match the left, if needed
            let scanline = this.scanlines[0];
            if (scanline.left < left) {
                scanline.left = left;
            }

            // Get rid of anything that falls entirely outside to the right
            for (let i = 0; i < this.scanlines.length; i++) {
                scanline = this.scanlines[i];
                if (scanline.left > right) {
                    this.scanlines.splice(i, this.scanlines.length - i);
                    break;
                }
            }

            if (this.scanlines.length > 0) {
                // Adjust the last to match the right, if needed
                scanline = this.scanlines[this.scanlines.length - 1];
                if (scanline.right > right) {
                    scanline.right = right;
                }
            }
        }
        return this.scanlines.length > 0;
    }

    public toString(): string {
        return "{ #scanlines: " + this.scanlines.length + "}";
    }
}

// ===== wmfjs/GDIContext.ts =====
interface ISelectedStyle {
    brush?: Brush;
    pen?: Pen;
    font?: Font;
    palette?: Palette;
    region?: Region;

    [key: string]: Obj | undefined;
}

class GDIContextState {
    public _svggroup: SVGElement;
    public _svgclipChanged: boolean;
    public _svgtextbkfilter: SVGFilterElement;
    public mapmode: number;
    public stretchmode: number;
    public textalign: number;
    public bkmode: number;
    public textcolor: ColorRef;
    public bkcolor: ColorRef;
    public polyfillmode: number;
    public wx: number;
    public wy: number;
    public ww: number;
    public wh: number;
    public vx: number;
    public vy: number;
    public vw: number;
    public vh: number;
    public x: number;
    public y: number;
    public clip: Region;
    public ownclip: boolean;
    public selected: ISelectedStyle;

    constructor(copy: GDIContextState, defObjects?: ISelectedStyle) {
        if (copy != null) {
            this._svggroup = copy._svggroup;
            this._svgclipChanged = copy._svgclipChanged;
            this._svgtextbkfilter = copy._svgtextbkfilter;
            this.mapmode = copy.mapmode;
            this.stretchmode = copy.stretchmode;
            this.textalign = copy.textalign;
            this.bkmode = copy.bkmode;
            this.textcolor = copy.textcolor.clone();
            this.bkcolor = copy.bkcolor.clone();
            this.polyfillmode = copy.polyfillmode;
            this.wx = copy.wx;
            this.wy = copy.wy;
            this.ww = copy.ww;
            this.wh = copy.wh;
            this.vx = copy.vx;
            this.vy = copy.vy;
            this.vw = copy.vw;
            this.vh = copy.vh;
            this.x = copy.x;
            this.y = copy.y;

            this.clip = copy.clip;
            this.ownclip = false;

            this.selected = {};
            for (const type in copy.selected) {
                this.selected[type] = copy.selected[type];
            }
        } else {
            this._svggroup = null;
            this._svgclipChanged = false;
            this._svgtextbkfilter = null;
            this.mapmode = Helper.GDI.MapMode.MM_ANISOTROPIC;
            this.stretchmode = Helper.GDI.StretchMode.COLORONCOLOR;
            this.textalign = 0; // TA_LEFT | TA_TOP | TA_NOUPDATECP
            this.bkmode = Helper.GDI.MixMode.OPAQUE;
            this.textcolor = new ColorRef(null, 0, 0, 0);
            this.bkcolor = new ColorRef(null, 255, 255, 255);
            this.polyfillmode = Helper.GDI.PolyFillMode.ALTERNATE;
            this.wx = 0;
            this.wy = 0;
            this.ww = 0;
            this.wh = 0;
            this.vx = 0;
            this.vy = 0;
            this.vw = 0;
            this.vh = 0;
            this.x = 0;
            this.y = 0;

            this.clip = null;
            this.ownclip = false;

            this.selected = {};
            for (const type in defObjects) {
                const defObj = defObjects[type];
                this.selected[type] = defObj != null ? defObj.clone() : null;
            }
        }
    }
}

class GDIContext {
    private _svg: SVG;
    private _svgdefs: SVGDefsElement;
    private _svgPatterns: { [key: string]: Brush };
    private _svgClipPaths: { [key: string]: Region };
    private defObjects: ISelectedStyle;
    private state: GDIContextState;
    private statestack: GDIContextState[];
    private objects: { [key: string]: Obj };

    constructor(svg: SVG) {
        this._svg = svg;
        this._svgdefs = null;
        this._svgPatterns = {};
        this._svgClipPaths = {};

        this.defObjects = {
            brush: new Brush(null, null),
            pen: new Pen(null, Helper.GDI.PenStyle.PS_SOLID, new PointS(null, 1, 1), new ColorRef(null, 0, 0, 0), 0, 0),
            font: new Font(null, null),
            palette: null,
            region: null,
        };

        this.state = new GDIContextState(null, this.defObjects);
        this.statestack = [this.state];
        this.objects = {};
    }

    public setMapMode(mode: number): void {
        Helper.log("[gdi] setMapMode: mode=" + mode);
        this.state.mapmode = mode;
        this.state._svggroup = null;
    }

    public setWindowOrg(x: number, y: number): void {
        Helper.log("[gdi] setWindowOrg: x=" + x + " y=" + y);
        this.state.wx = x;
        this.state.wy = y;
        this.state._svggroup = null;
    }

    public setWindowExt(x: number, y: number): void {
        Helper.log("[gdi] setWindowExt: x=" + x + " y=" + y);
        this.state.ww = x;
        this.state.wh = y;
        this.state._svggroup = null;
    }

    public offsetWindowOrg(offX: number, offY: number): void {
        Helper.log("[gdi] offsetWindowOrg: offX=" + offX + " offY=" + offY);
        this.state.wx += offX;
        this.state.wy += offY;
        this.state._svggroup = null;
    }

    public setViewportOrg(x: number, y: number): void {
        Helper.log("[gdi] setViewportOrg: x=" + x + " y=" + y);
        this.state.vx = x;
        this.state.vy = y;
        this.state._svggroup = null;
    }

    public setViewportExt(x: number, y: number): void {
        Helper.log("[gdi] setViewportExt: x=" + x + " y=" + y);
        this.state.vw = x;
        this.state.vh = y;
        this.state._svggroup = null;
    }

    public offsetViewportOrg(offX: number, offY: number): void {
        Helper.log("[gdi] offsetViewportOrg: offX=" + offX + " offY=" + offY);
        this.state.vx += offX;
        this.state.vy += offY;
        this.state._svggroup = null;
    }

    public saveDC(): void {
        Helper.log("[gdi] saveDC");
        const prevstate = this.state;
        this.state = new GDIContextState(this.state);
        this.statestack.push(prevstate);
        this.state._svggroup = null;
    }

    public restoreDC(saved: number): void {
        Helper.log("[gdi] restoreDC: saved=" + saved);
        if (this.statestack.length > 1) {
            if (saved === -1) {
                this.state = this.statestack.pop();
            } else if (saved < -1) {
                throw new WMFJSError("restoreDC: relative restore not implemented");
            } else if (saved > 1) {
                throw new WMFJSError("restoreDC: absolute restore not implemented");
            }
        } else {
            throw new WMFJSError("No saved contexts");
        }

        this.state._svggroup = null;
    }

    public escape(func: number, blob: Blob, offset: number, count: number): void {
        Helper.log("[gdi] escape: func=" + func + " offset=" + offset + " count=" + count);
    }

    public setStretchBltMode(stretchMode: number): void {
        Helper.log("[gdi] setStretchBltMode: stretchMode=" + stretchMode);
    }

    public stretchDib(srcX: number, srcY: number, srcW: number, srcH: number,
                      dstX: number, dstY: number, dstW: number, dstH: number,
                      rasterOp: number, colorUsage: number, dib: DIBitmap): void {
        Helper.log("[gdi] stretchDib: srcX=" + srcX + " srcY=" + srcY + " srcW=" + srcW + " srcH=" + srcH
            + " dstX=" + dstX + " dstY=" + dstY + " dstW=" + dstW + " dstH=" + dstH
            + " rasterOp=0x" + rasterOp.toString(16));
        srcX = this._todevX(srcX);
        srcY = this._todevY(srcY);
        srcW = this._todevW(srcW);
        srcH = this._todevH(srcH);
        dstX = this._todevX(dstX);
        dstY = this._todevY(dstY);
        dstW = this._todevW(dstW);
        dstH = this._todevH(dstH);
        Helper.log("[gdi] stretchDib: TRANSLATED: srcX=" + srcX + " srcY=" + srcY + " srcW=" + srcW + " srcH=" + srcH
            + " dstX=" + dstX + " dstY=" + dstY + " dstW=" + dstW + " dstH=" + dstH
            + " rasterOp=0x" + rasterOp.toString(16) + " colorUsage=0x" + colorUsage.toString(16));
        this._pushGroup();
        this._svg.image(this.state._svggroup, dstX, dstY, dstW, dstH, dib.base64ref());
    }

    public dibBits(srcX: number, srcY: number, dstX: number, dstY: number, width: number, height: number,
                   rasterOp: number, dib: DIBitmap): void {
        Helper.log("[gdi] stretchDibBits: srcX=" + srcX + " srcY=" + srcY
            + " dstX=" + dstX + " dstY=" + dstY + " width=" + width + " height=" + height
            + " rasterOp=0x" + rasterOp.toString(16));
        srcX = this._todevX(srcX);
        srcY = this._todevY(srcY);
        dstX = this._todevX(dstX);
        dstY = this._todevY(dstY);
        width = this._todevW(width);
        height = this._todevH(height);
        Helper.log("[gdi] dibBits: TRANSLATED:"
            + " srcX=" + srcX + " srcY=" + srcY + +" dstX=" + dstX + " dstY=" + dstY
            + " width=" + width + " height=" + height + " rasterOp=0x" + rasterOp.toString(16));
        this._pushGroup();
        this._svg.image(this.state._svggroup, dstX, dstY, width, height, dib.base64ref());
    }

    public stretchDibBits(srcX: number, srcY: number, srcW: number, srcH: number,
                          dstX: number, dstY: number, dstW: number, dstH: number,
                          rasterOp: number, dib: DIBitmap): void {
        Helper.log("[gdi] stretchDibBits: srcX=" + srcX + " srcY=" + srcY + " srcW=" + srcW + " srcH=" + srcH
            + " dstX=" + dstX + " dstY=" + dstY + " dstW=" + dstW + " dstH=" + dstH
            + " rasterOp=0x" + rasterOp.toString(16));
        srcX = this._todevX(srcX);
        srcY = this._todevY(srcY);
        srcW = this._todevW(srcW);
        srcH = this._todevH(srcH);
        dstX = this._todevX(dstX);
        dstY = this._todevY(dstY);
        dstW = this._todevW(dstW);
        dstH = this._todevH(dstH);
        Helper.log("[gdi] stretchDibBits: TRANSLATED:"
            + " srcX=" + srcX + " srcY=" + srcY + " srcW=" + srcW + " srcH=" + srcH
            + " dstX=" + dstX + " dstY=" + dstY + " dstW=" + dstW + " dstH=" + dstH
            + " rasterOp=0x" + rasterOp.toString(16));
        this._pushGroup();
        this._svg.image(this.state._svggroup, dstX, dstY, dstW, dstH, dib.base64ref());
    }

    public rectangle(rect: Rect, rw: number, rh: number): void {
        Helper.log("[gdi] rectangle: rect=" + rect.toString() + " with pen " + this.state.selected.pen.toString()
            + " and brush " + this.state.selected.brush.toString());
        const bottom = this._todevY(rect.bottom);
        const right = this._todevX(rect.right);
        const top = this._todevY(rect.top);
        const left = this._todevX(rect.left);
        rw = this._todevH(rw);
        rh = this._todevH(rh);
        Helper.log("[gdi] rectangle: TRANSLATED: bottom=" + bottom + " right=" + right + " top=" + top
            + " left=" + left + " rh=" + rh + " rw=" + rw);
        this._pushGroup();

        const opts = this._applyOpts(null, true, true, false);
        this._svg.rect(this.state._svggroup, left, top, right - left, bottom - top, rw / 2, rh / 2, opts);
    }

    public textOut(x: number, y: number, text: string): void {
        Helper.log("[gdi] textOut: x=" + x + " y=" + y + " text=" + text
            + " with font " + this.state.selected.font.toString());
        x = this._todevX(x);
        y = this._todevY(y);
        Helper.log("[gdi] textOut: TRANSLATED: x=" + x + " y=" + y);
        this._pushGroup();

        const opts = this._applyOpts(null, false, false, true);
        if (this.state.selected.font.escapement !== 0) {
            opts.transform = "rotate(" + [(-this.state.selected.font.escapement / 10), x, y] + ")";
            opts.style = "dominant-baseline: middle; text-anchor: start;";
        }
        if (this.state.bkmode === Helper.GDI.MixMode.OPAQUE) {
            if (this.state._svgtextbkfilter == null) {
                const filterId = Helper._makeUniqueId("f");
                const filter = this._svg.filter(this._getSvgDef(), filterId, 0, 0, 1, 1);
                this._svg.filters.flood(filter, null, "#" + this.state.bkcolor.toHex(), 1.0);
                this._svg.filters.composite(filter, null, null, "SourceGraphic");
                this.state._svgtextbkfilter = filter;
            }

            opts.filter = "url(#" + this.state._svgtextbkfilter.id + ")";
        }
        this._svg.text(this.state._svggroup, x, y, text, opts);
    }

    public extTextOut(x: number, y: number, text: string, fwOpts: number, rect: Rect, dx: number[]): void {
        Helper.log("[gdi] extTextOut: x=" + x + " y=" + y + " text=" + text
            + " with font " + this.state.selected.font.toString());
        x = this._todevX(x);
        y = this._todevY(y);
        Helper.log("[gdi] extTextOut: TRANSLATED: x=" + x + " y=" + y);
        this._pushGroup();

        const opts = this._applyOpts(null, false, false, true);
        if (this.state.selected.font.escapement !== 0) {
            opts.transform = "rotate(" + [(-this.state.selected.font.escapement / 10), x, y] + ")";
            opts.style = "dominant-baseline: middle; text-anchor: start;";
        }
        if (this.state.bkmode === Helper.GDI.MixMode.OPAQUE) {
            if (this.state._svgtextbkfilter == null) {
                const filterId = Helper._makeUniqueId("f");
                const filter = this._svg.filter(this._getSvgDef(), filterId, 0, 0, 1, 1);
                this._svg.filters.flood(filter, null, "#" + this.state.bkcolor.toHex(), 1.0);
                this._svg.filters.composite(filter, null, null, "SourceGraphic");
                this.state._svgtextbkfilter = filter;
            }

            opts.filter = "url(#" + this.state._svgtextbkfilter.id + ")";
        }
        this._svg.text(this.state._svggroup, x, y, text, opts);
    }

    public lineTo(x: number, y: number): void {
        Helper.log("[gdi] lineTo: x=" + x + " y=" + y + " with pen " + this.state.selected.pen.toString());
        const toX = this._todevX(x);
        const toY = this._todevY(y);
        const fromX = this._todevX(this.state.x);
        const fromY = this._todevY(this.state.y);

        // Update position
        this.state.x = x;
        this.state.y = y;

        Helper.log("[gdi] lineTo: TRANSLATED: toX=" + toX + " toY=" + toY + " fromX=" + fromX + " fromY=" + fromY);
        this._pushGroup();

        const opts = this._applyOpts(null, true, false, false);
        this._svg.line(this.state._svggroup, fromX, fromY, toX, toY, opts);
    }

    public moveTo(x: number, y: number): void {
        Helper.log("[gdi] moveTo: x=" + x + " y=" + y);
        this.state.x = x;
        this.state.y = y;
    }

    public polygon(points: PointS[], first: boolean): void {
        Helper.log("[gdi] polygon: points=" + points + " with pen " + this.state.selected.pen.toString()
            + " and brush " + this.state.selected.brush.toString());
        const pts = [];
        for (let i = 0; i < points.length; i++) {
            const point = points[i];
            pts.push([this._todevX(point.x), this._todevY(point.y)]);
        }
        Helper.log("[gdi] polygon: TRANSLATED: pts=" + pts);
        if (first) {
            this._pushGroup();
        }
        const opts = {
            "fill-rule": this.state.polyfillmode === Helper.GDI.PolyFillMode.ALTERNATE ? "evenodd" : "nonzero",
        };
        this._applyOpts(opts, true, true, false);
        this._svg.polygon(this.state._svggroup, pts, opts);
    }

    public polyPolygon(polygons: PointS[][]): void {
        Helper.log("[gdi] polyPolygon: polygons.length=" + polygons.length
            + " with pen " + this.state.selected.pen.toString()
            + " and brush " + this.state.selected.brush.toString());

        const cnt = polygons.length;
        for (let i = 0; i < cnt; i++) {
            this.polygon(polygons[i], i === 0);
        }
    }

    public polyline(points: PointS[]): void {
        Helper.log("[gdi] polyline: points=" + points + " with pen " + this.state.selected.pen.toString());
        const pts = [];
        for (let i = 0; i < points.length; i++) {
            const point = points[i];
            pts.push([this._todevX(point.x), this._todevY(point.y)]);
        }
        Helper.log("[gdi] polyline: TRANSLATED: pts=" + pts);
        this._pushGroup();
        const opts = this._applyOpts({fill: "none"}, true, false, false);
        this._svg.polyline(this.state._svggroup, pts, opts);
    }

    public ellipse(rect: Rect): void {
        Helper.log("[gdi] ellipse: rect=" + rect.toString() + " with pen " + this.state.selected.pen.toString()
            + " and brush " + this.state.selected.brush.toString());
        const bottom = this._todevY(rect.bottom);
        const right = this._todevX(rect.right);
        const top = this._todevY(rect.top);
        const left = this._todevX(rect.left);
        Helper.log("[gdi] ellipse: TRANSLATED: bottom=" + bottom + " right=" + right + " top=" + top + " left=" + left);
        this._pushGroup();
        const width2 = (right - left) / 2;
        const height2 = (bottom - top) / 2;
        const opts = this._applyOpts(null, true, true, false);
        this._svg.ellipse(this.state._svggroup, left + width2, top + height2, width2, height2, opts);
    }

    public excludeClipRect(rect: Rect): void {
        Helper.log("[gdi] excludeClipRect: rect=" + rect.toString());
        this._getClipRgn().subtract(rect);
    }

    public intersectClipRect(rect: Rect): void {
        Helper.log("[gdi] intersectClipRect: rect=" + rect.toString());
        this._getClipRgn().intersect(rect);
    }

    public offsetClipRgn(offX: number, offY: number): void {
        Helper.log("[gdi] offsetClipRgn: offX=" + offX + " offY=" + offY);
        this._getClipRgn().offset(offX, offY);
    }

    public setTextAlign(textAlignmentMode: number): void {
        Helper.log("[gdi] setTextAlign: textAlignmentMode=0x" + textAlignmentMode.toString(16));
        this.state.textalign = textAlignmentMode;
    }

    public setBkMode(bkMode: number): void {
        Helper.log("[gdi] setBkMode: bkMode=0x" + bkMode.toString(16));
        this.state.bkmode = bkMode;
    }

    public setTextColor(textColor: ColorRef): void {
        Helper.log("[gdi] setTextColor: textColor=" + textColor.toString());
        this.state.textcolor = textColor;
    }

    public setBkColor(bkColor: ColorRef): void {
        Helper.log("[gdi] setBkColor: bkColor=" + bkColor.toString());
        this.state.bkcolor = bkColor;
        this.state._svgtextbkfilter = null;
    }

    public setPolyFillMode(polyFillMode: number): void {
        Helper.log("[gdi] setPolyFillMode: polyFillMode=" + polyFillMode);
        this.state.polyfillmode = polyFillMode;
    }

    public createBrush(brush: Brush): void {
        const idx = this._storeObject(brush);
        Helper.log("[gdi] createBrush: brush=" + brush.toString() + " with handle " + idx);
    }

    public createFont(font: Font): void {
        const idx = this._storeObject(font);
        Helper.log("[gdi] createFont: font=" + font.toString() + " with handle " + idx);
    }

    public createPen(pen: Pen): void {
        const idx = this._storeObject(pen);
        Helper.log("[gdi] createPen: pen=" + pen.toString() + " width handle " + idx);
    }

    public createPalette(palette: Palette): void {
        const idx = this._storeObject(palette);
        Helper.log("[gdi] createPalette: palette=" + palette.toString() + " width handle " + idx);
    }

    public createRegion(region: Region): void {
        const idx = this._storeObject(region);
        Helper.log("[gdi] createRegion: region=" + region.toString() + " width handle " + idx);
    }

    public createPatternBrush(patternBrush: Brush): void {
        const idx = this._storeObject(patternBrush);
        Helper.log("[gdi] createRegion: region=" + patternBrush.toString() + " width handle " + idx);
    }

    public selectObject(objIdx: number, checkType: string): void {
        const obj = this._getObject(objIdx);
        if (obj != null && (checkType == null || obj.type === checkType)) {
            this._selectObject(obj);
            Helper.log("[gdi] selectObject: objIdx=" + objIdx
                + (obj ? " selected " + obj.type + ": " + obj.toString() : "[invalid index]"));
        } else {
            Helper.log("[gdi] selectObject: objIdx=" + objIdx
                + (obj ? " invalid object type: " + obj.type : "[invalid index]"));
        }
    }

    public deleteObject(objIdx: number): void {
        const ret = this._deleteObject(objIdx);
        Helper.log("[gdi] deleteObject: objIdx=" + objIdx + (ret ? " deleted object" : "[invalid index]"));
    }

    private _pushGroup() {
        if (this.state._svggroup == null || this.state._svgclipChanged) {
            this.state._svgclipChanged = false;
            this.state._svgtextbkfilter = null;

            const settings: any = {
                viewBox: [this.state.vx, this.state.vy, this.state.vw, this.state.vh].join(" "),
                preserveAspectRatio: "none",
            };
            if (this.state.clip != null) {
                Helper.log("[gdi] new svg x=" + this.state.vx + " y=" + this.state.vy
                    + " width=" + this.state.vw + " height=" + this.state.vh + " with clipping");
                settings["clip-path"] = "url(#" + this._getSvgClipPathForRegion(this.state.clip) + ")";
            } else {
                Helper.log("[gdi] new svg x=" + this.state.vx + " y=" + this.state.vy
                    + " width=" + this.state.vw + " height=" + this.state.vh + " without clipping");
            }
            this.state._svggroup = this._svg.svg(this.state._svggroup,
                this.state.vx, this.state.vy, this.state.vw, this.state.vh, settings);
        }
    }

    private _storeObject(obj: Obj) {
        let i = 0;
        while (this.objects[i.toString()] != null && i <= 65535) {
            i++;
        }
        if (i > 65535) {
            Helper.log("[gdi] Too many objects!");
            return -1;
        }

        this.objects[i.toString()] = obj;
        return i;
    }

    private _getObject(objIdx: number) {
        const obj = this.objects[objIdx.toString()];
        if (obj == null) {
            Helper.log("[gdi] No object with handle " + objIdx);
        }
        return obj;
    }

    private _getSvgDef() {
        if (this._svgdefs == null) {
            this._svgdefs = this._svg.defs();
        }
        return this._svgdefs;
    }

    private _getSvgClipPathForRegion(region: Region) {
        for (const existingId in this._svgClipPaths) {
            const rgn = this._svgClipPaths[existingId];
            if (rgn === region) {
                return existingId;
            }
        }

        const id = Helper._makeUniqueId("c");
        const sclip = this._svg.clipPath(this._getSvgDef(), id, "userSpaceOnUse");
        switch (region.complexity) {
            case 1:
                this._svg.rect(sclip, this._todevX(region.bounds.left), this._todevY(region.bounds.top),
                    this._todevW(region.bounds.right - region.bounds.left),
                    this._todevH(region.bounds.bottom - region.bounds.top),
                    {"fill": "black", "stroke-width": 0});
                break;
            case 2:
                for (let i = 0; i < region.scans.length; i++) {
                    const scan = region.scans[i];
                    for (let j = 0; j < scan.scanlines.length; j++) {
                        const scanline = scan.scanlines[j];
                        this._svg.rect(sclip, this._todevX(scanline.left), this._todevY(scan.top),
                            this._todevW(scanline.right - scanline.left), this._todevH(scan.bottom - scan.top),
                            {"fill": "black", "stroke-width": 0});
                    }
                }
                break;
        }
        this._svgClipPaths[id] = region;
        return id;
    }

    private _getSvgPatternForBrush(brush: Brush) {
        for (const existingId in this._svgPatterns) {
            const pat = this._svgPatterns[existingId];
            if (pat === brush) {
                return existingId;
            }
        }

        let width;
        let height;
        let img;
        switch (brush.style) {
            case Helper.GDI.BrushStyle.BS_PATTERN:
                width = brush.pattern.getWidth();
                height = brush.pattern.getHeight();
                break;
            case Helper.GDI.BrushStyle.BS_DIBPATTERNPT:
                width = brush.dibpatternpt.getWidth();
                height = brush.dibpatternpt.getHeight();
                img = brush.dibpatternpt.base64ref();
                break;
            default:
                throw new WMFJSError("Invalid brush style");
        }

        const id = Helper._makeUniqueId("p");
        const spat = this._svg.pattern(this._getSvgDef(), id, 0, 0, width, height, {patternUnits: "userSpaceOnUse"});
        this._svg.image(spat, 0, 0, width, height, img);
        this._svgPatterns[id] = brush;
        return id;
    }

    private _selectObject(obj: Obj) {
        this.state.selected[obj.type] = obj;
        if (obj.type === "region") {
            this.state._svgclipChanged = true;
        }
    }

    private _deleteObject(objIdx: number) {
        const obj = this.objects[objIdx.toString()];
        if (obj != null) {
            for (let i = 0; i < this.statestack.length; i++) {
                const state = this.statestack[i];
                if (state.selected[obj.type] === obj) {
                    state.selected[obj.type] = this.defObjects[obj.type].clone();
                }
            }
            delete this.objects[objIdx.toString()];
            return true;
        }

        Helper.log("[gdi] Cannot delete object with invalid handle " + objIdx);
        return false;
    }

    private _getClipRgn() {
        if (this.state.clip != null) {
            if (!this.state.ownclip) {
                this.state.clip = this.state.clip.clone();
            }
        } else {
            if (this.state.selected.region != null) {
                this.state.clip = this.state.selected.region.clone();
            } else {
                this.state.clip = CreateSimpleRegion(this.state.wx, this.state.wy, this.state.wx + this.state.ww,
                    this.state.wy + this.state.wh);
            }
        }
        this.state.ownclip = true;
        return this.state.clip;
    }

    private _todevX(val: number) {
        // http://wvware.sourceforge.net/caolan/mapmode.html
        // logical -> device
        return Math.floor((val - this.state.wx) * (this.state.vw / this.state.ww)) + this.state.vx;
    }

    private _todevY(val: number) {
        // http://wvware.sourceforge.net/caolan/mapmode.html
        // logical -> device
        return Math.floor((val - this.state.wy) * (this.state.vh / this.state.wh)) + this.state.vy;
    }

    private _todevW(val: number) {
        // http://wvware.sourceforge.net/caolan/mapmode.html
        // logical -> device
        return Math.floor(val * (this.state.vw / this.state.ww)) + this.state.vx;
    }

    private _todevH(val: number) {
        // http://wvware.sourceforge.net/caolan/mapmode.html
        // logical -> device
        return Math.floor(val * (this.state.vh / this.state.wh)) + this.state.vy;
    }

    private _tologicalX(val: number) {
        // http://wvware.sourceforge.net/caolan/mapmode.html
        // logical -> device
        return Math.floor((val - this.state.vx) / (this.state.vw / this.state.ww)) + this.state.wx;
    }

    private _tologicalY(val: number) {
        // http://wvware.sourceforge.net/caolan/mapmode.html
        // logical -> device
        return Math.floor((val - this.state.vy) / (this.state.vh / this.state.wh)) + this.state.wy;
    }

    private _tologicalW(val: number) {
        // http://wvware.sourceforge.net/caolan/mapmode.html
        // logical -> device
        return Math.floor(val / (this.state.vw / this.state.ww)) + this.state.wx;
    }

    private _tologicalH(val: number) {
        // http://wvware.sourceforge.net/caolan/mapmode.html
        // logical -> device
        return Math.floor(val / (this.state.vh / this.state.wh)) + this.state.wy;
    }

    private _applyOpts(opts: any, usePen: boolean, useBrush: boolean, useFont: boolean) {
        if (opts == null) {
            opts = {};
        }
        if (usePen) {
            const pen = this.state.selected.pen;
            if (pen.style !== Helper.GDI.PenStyle.PS_NULL) {
                opts.stroke = "#" + pen.color.toHex(), // TODO: pen style
                    opts["stroke-width"] = this._todevW(pen.width.x); // TODO: is .y ever used?

                let dotWidth;
                if ((pen.linecap & Helper.GDI.PenStyle.PS_ENDCAP_SQUARE) !== 0) {
                    opts["stroke-linecap"] = "square";
                    dotWidth = 1;
                } else if ((pen.linecap & Helper.GDI.PenStyle.PS_ENDCAP_FLAT) !== 0) {
                    opts["stroke-linecap"] = "butt";
                    dotWidth = opts["stroke-width"];
                } else {
                    opts["stroke-linecap"] = "round";
                    dotWidth = 1;
                }

                if ((pen.join & Helper.GDI.PenStyle.PS_JOIN_BEVEL) !== 0) {
                    opts["stroke-linejoin"] = "bevel";
                } else if ((pen.join & Helper.GDI.PenStyle.PS_JOIN_MITER) !== 0) {
                    opts["stroke-linejoin"] = "miter";
                } else {
                    opts["stroke-linejoin"] = "round";
                }

                const dashWidth = opts["stroke-width"] * 4;
                const dotSpacing = opts["stroke-width"] * 2;
                switch (pen.style) {
                    case Helper.GDI.PenStyle.PS_DASH:
                        opts["stroke-dasharray"] = [dashWidth, dotSpacing].toString();
                        break;
                    case Helper.GDI.PenStyle.PS_DOT:
                        opts["stroke-dasharray"] = [dotWidth, dotSpacing].toString();
                        break;
                    case Helper.GDI.PenStyle.PS_DASHDOT:
                        opts["stroke-dasharray"] = [dashWidth, dotSpacing, dotWidth, dotSpacing].toString();
                        break;
                    case Helper.GDI.PenStyle.PS_DASHDOTDOT:
                        opts["stroke-dasharray"]
                            = [dashWidth, dotSpacing, dotWidth, dotSpacing, dotWidth, dotSpacing].toString();
                        break;
                }
            }
        }
        if (useBrush) {
            const brush = this.state.selected.brush;
            switch (brush.style) {
                case Helper.GDI.BrushStyle.BS_SOLID:
                    opts.fill = "#" + brush.color.toHex();
                    break;
                case Helper.GDI.BrushStyle.BS_PATTERN:
                case Helper.GDI.BrushStyle.BS_DIBPATTERNPT:
                    opts.fill = "url(#" + this._getSvgPatternForBrush(brush) + ")";
                    break;
                case Helper.GDI.BrushStyle.BS_NULL:
                    opts.fill = "none";
                    break;
                default:
                    Helper.log("[gdi] unsupported brush style: " + brush.style);
                    opts.fill = "none";
                    break;
            }
        }
        if (useFont) {
            const font = this.state.selected.font;
            opts["font-family"] = font.facename;
            opts["font-size"] = this._todevH(Math.abs(font.height));
            opts.fill = "#" + this.state.textcolor.toHex();
        }
        return opts;
    }
}

// ===== wmfjs/WMFRecords.ts =====
class WMFRecords {
    private _records: ((gdi: GDIContext) => void)[];

    constructor(reader: Blob, first: number) {
        this._records = [];

        let all = false;
        let curpos = first;
        main_loop: while (!all) {
            reader.seek(curpos);
            const size = reader.readUint32();
            if (size < 3) {
                throw new WMFJSError("Invalid record size");
            }
            const type = reader.readUint16();
            switch (type) {
                case Helper.GDI.RecordType.META_EOF:
                    all = true;
                    break main_loop;
                case Helper.GDI.RecordType.META_SETMAPMODE: {
                    const mapMode = reader.readUint16();
                    this._records.push((gdi) => {
                        gdi.setMapMode(mapMode);
                    });
                    break;
                }
                case Helper.GDI.RecordType.META_SETWINDOWORG: {
                    const y = reader.readInt16();
                    const x = reader.readInt16();
                    this._records.push((gdi) => {
                        gdi.setWindowOrg(x, y);
                    });
                    break;
                }
                case Helper.GDI.RecordType.META_SETWINDOWEXT: {
                    const y = reader.readInt16();
                    const x = reader.readInt16();
                    this._records.push((gdi) => {
                        gdi.setWindowExt(x, y);
                    });
                    break;
                }
                case Helper.GDI.RecordType.META_OFFSETWINDOWORG: {
                    const offY = reader.readInt16();
                    const offX = reader.readInt16();
                    this._records.push((gdi) => {
                        gdi.offsetWindowOrg(offX, offY);
                    });
                    break;
                }
                case Helper.GDI.RecordType.META_SETVIEWPORTORG: {
                    const y = reader.readInt16();
                    const x = reader.readInt16();
                    this._records.push((gdi) => {
                        gdi.setViewportOrg(x, y);
                    });
                    break;
                }
                case Helper.GDI.RecordType.META_SETVIEWPORTEXT: {
                    const y = reader.readInt16();
                    const x = reader.readInt16();
                    this._records.push((gdi) => {
                        gdi.setViewportExt(x, y);
                    });
                    break;
                }
                case Helper.GDI.RecordType.META_OFFSETVIEWPORTORG: {
                    const offY = reader.readInt16();
                    const offX = reader.readInt16();
                    this._records.push((gdi) => {
                        gdi.offsetViewportOrg(offX, offY);
                    });
                    break;
                }
                case Helper.GDI.RecordType.META_SAVEDC: {
                    this._records.push((gdi) => {
                        gdi.saveDC();
                    });
                    break;
                }
                case Helper.GDI.RecordType.META_RESTOREDC: {
                    const saved = reader.readInt16();
                    this._records.push((gdi) => {
                        gdi.restoreDC(saved);
                    });
                    break;
                }
                case Helper.GDI.RecordType.META_SETSTRETCHBLTMODE: {
                    const stretchMode = reader.readUint16();
                    this._records.push((gdi) => {
                        gdi.setStretchBltMode(stretchMode);
                    });
                    break;
                }
                case Helper.GDI.RecordType.META_DIBBITBLT: {
                    const haveSrcDib = ((type >> 8) + 3 !== size);
                    const rasterOp = reader.readUint16() | (reader.readUint16() << 16);
                    const srcY = reader.readInt16();
                    const srcX = reader.readInt16();
                    if (!haveSrcDib) {
                        // ignore reserved field
                        reader.skip(2);
                    }
                    const height = reader.readInt16();
                    const width = reader.readInt16();
                    const destY = reader.readInt16();
                    const destX = reader.readInt16();
                    if (haveSrcDib) {
                        const datalength = size * 2 - (reader.pos - curpos);
                        const dib = new DIBitmap(reader, datalength);
                        this._records.push((gdi) => {
                            gdi.dibBits(srcX, srcY, destX, destY, width, height, rasterOp, dib);
                        });
                    }
                    break;
                }
                case Helper.GDI.RecordType.META_DIBSTRETCHBLT: {
                    const haveSrcDib = ((type >> 8) + 3 !== size);
                    const rasterOp = reader.readUint16() | (reader.readUint16() << 16);
                    const srcH = reader.readInt16();
                    const srcW = reader.readInt16();
                    const srcY = reader.readInt16();
                    const srcX = reader.readInt16();
                    const destH = reader.readInt16();
                    const destW = reader.readInt16();
                    const destY = reader.readInt16();
                    const destX = reader.readInt16();
                    const datalength = size * 2 - (reader.pos - curpos);
                    const dib = new DIBitmap(reader, datalength);
                    this._records.push((gdi) => {
                        gdi.stretchDibBits(srcX, srcY, srcW, srcH, destX, destY, destW, destH, rasterOp, dib);
                    });
                    break;
                }
                case Helper.GDI.RecordType.META_STRETCHDIB: {
                    const rasterOp = reader.readUint16() | (reader.readUint16() << 16);
                    const colorUsage = reader.readInt16();
                    const srcH = reader.readInt16();
                    const srcW = reader.readInt16();
                    const srcY = reader.readInt16();
                    const srcX = reader.readInt16();
                    const destH = reader.readInt16();
                    const destW = reader.readInt16();
                    const destY = reader.readInt16();
                    const destX = reader.readInt16();
                    const datalength = size * 2 - (reader.pos - curpos);
                    const dib = new DIBitmap(reader, datalength);
                    this._records.push((gdi) => {
                        gdi.stretchDib(srcX, srcY, srcW, srcH, destX, destY, destW, destH, rasterOp, colorUsage, dib);
                    });
                    break;
                }
                case Helper.GDI.RecordType.META_ESCAPE: {
                    const func = reader.readUint16();
                    const count = reader.readUint16();
                    const offset = reader.pos;
                    const blob = new Blob(reader, offset);
                    this._records.push((gdi) => {
                        gdi.escape(func, blob, offset, count);
                    });
                    break;
                }
                case Helper.GDI.RecordType.META_SETTEXTALIGN: {
                    const textAlign = reader.readUint16();
                    this._records.push((gdi) => {
                        gdi.setTextAlign(textAlign);
                    });
                    break;
                }
                case Helper.GDI.RecordType.META_SETBKMODE: {
                    const bkMode = reader.readUint16();
                    this._records.push((gdi) => {
                        gdi.setBkMode(bkMode);
                    });
                    break;
                }
                case Helper.GDI.RecordType.META_SETTEXTCOLOR: {
                    const textColor = new ColorRef(reader);
                    this._records.push((gdi) => {
                        gdi.setTextColor(textColor);
                    });
                    break;
                }
                case Helper.GDI.RecordType.META_SETBKCOLOR: {
                    const bkColor = new ColorRef(reader);
                    this._records.push((gdi) => {
                        gdi.setBkColor(bkColor);
                    });
                    break;
                }
                case Helper.GDI.RecordType.META_CREATEBRUSHINDIRECT: {
                    const datalength = size * 2 - (reader.pos - curpos);
                    const brush = new Brush(reader, datalength, false);
                    this._records.push((gdi) => {
                        gdi.createBrush(brush);
                    });
                    break;
                }
                case Helper.GDI.RecordType.META_DIBCREATEPATTERNBRUSH: {
                    const datalength = size * 2 - (reader.pos - curpos);
                    const brush = new Brush(reader, datalength, true);
                    this._records.push((gdi) => {
                        gdi.createBrush(brush);
                    });
                    break;
                }
                case Helper.GDI.RecordType.META_CREATEPENINDIRECT: {
                    const pen = new Pen(reader);
                    this._records.push((gdi) => {
                        gdi.createPen(pen);
                    });
                    break;
                }
                case Helper.GDI.RecordType.META_CREATEFONTINDIRECT: {
                    const datalength = size * 2 - (reader.pos - curpos);
                    const font = new Font(reader, datalength);
                    this._records.push((gdi) => {
                        gdi.createFont(font);
                    });
                    break;
                }
                case Helper.GDI.RecordType.META_SELECTOBJECT: {
                    const idx = reader.readUint16();
                    this._records.push((gdi) => {
                        gdi.selectObject(idx, null);
                    });
                    break;
                }
                case Helper.GDI.RecordType.META_SELECTPALETTE: {
                    const idx = reader.readUint16();
                    this._records.push((gdi) => {
                        gdi.selectObject(idx, "palette");
                    });
                    break;
                }
                case Helper.GDI.RecordType.META_SELECTCLIPREGION: {
                    const idx = reader.readUint16();
                    this._records.push((gdi) => {
                        gdi.selectObject(idx, "region");
                    });
                    break;
                }
                case Helper.GDI.RecordType.META_DELETEOBJECT: {
                    const idx = reader.readUint16();
                    this._records.push((gdi) => {
                        gdi.deleteObject(idx);
                    });
                    break;
                }
                case Helper.GDI.RecordType.META_RECTANGLE: {
                    const rect = new Rect(reader);
                    this._records.push((gdi) => {
                        gdi.rectangle(rect, 0, 0);
                    });
                    break;
                }
                case Helper.GDI.RecordType.META_ROUNDRECT: {
                    const rh = reader.readInt16();
                    const rw = reader.readInt16();
                    const rect = new Rect(reader);
                    this._records.push((gdi) => {
                        gdi.rectangle(rect, rw, rh);
                    });
                    break;
                }
                case Helper.GDI.RecordType.META_LINETO: {
                    const y = reader.readInt16();
                    const x = reader.readInt16();
                    this._records.push((gdi) => {
                        gdi.lineTo(x, y);
                    });
                    break;
                }
                case Helper.GDI.RecordType.META_MOVETO: {
                    const y = reader.readInt16();
                    const x = reader.readInt16();
                    this._records.push((gdi) => {
                        gdi.moveTo(x, y);
                    });
                    break;
                }
                case Helper.GDI.RecordType.META_TEXTOUT: {
                    const len = reader.readInt16();
                    if (len > 0) {
                        const text = reader.readString(len);
                        reader.skip(len % 2);
                        const y = reader.readInt16();
                        const x = reader.readInt16();
                        this._records.push((gdi) => {
                            gdi.textOut(x, y, text);
                        });
                    }
                    break;
                }
                case Helper.GDI.RecordType.META_EXTTEXTOUT: {
                    const y = reader.readInt16();
                    const x = reader.readInt16();
                    const len = reader.readInt16();
                    const fwOpts = reader.readUint16();

                    let hasRect = null;
                    let hasDx = null;
                    if (size * 2 === 14 + len + len % 2) {
                        hasRect = false;
                        hasDx = false;
                    }
                    if (size * 2 === 14 + 8 + len + len % 2) {
                        hasRect = true;
                        hasDx = false;
                    }
                    if (size * 2 === 14 + len + len % 2 + len * 2) {
                        hasRect = false;
                        hasDx = true;
                    }
                    if (size * 2 === 14 + 8 + len + len % 2 + len * 2) {
                        hasRect = true;
                        hasDx = true;
                    }

                    const rect = hasRect ? new Rect(reader) : null;
                    if (len > 0) {
                        const text = reader.readString(len);
                        reader.skip(len % 2);

                        const dx: number[] = [];
                        if (hasDx) {
                            for (let i = 0; i < text.length; i++) {
                                dx.push(reader.readInt16());
                            }
                        }

                        this._records.push((gdi) => {
                            gdi.extTextOut(x, y, text, fwOpts, rect, dx);
                        });
                    }
                    break;
                }
                case Helper.GDI.RecordType.META_EXCLUDECLIPRECT: {
                    const rect = new Rect(reader);
                    this._records.push((gdi) => {
                        gdi.excludeClipRect(rect);
                    });
                    break;
                }
                case Helper.GDI.RecordType.META_INTERSECTCLIPRECT: {
                    const rect = new Rect(reader);
                    this._records.push((gdi) => {
                        gdi.intersectClipRect(rect);
                    });
                    break;
                }
                case Helper.GDI.RecordType.META_POLYGON: {
                    let cnt = reader.readInt16();
                    const points: PointS[] = [];
                    while (cnt > 0) {
                        points.push(new PointS(reader));
                        cnt--;
                    }
                    this._records.push((gdi) => {
                        gdi.polygon(points, true);
                    });
                    break;
                }
                case Helper.GDI.RecordType.META_SETPOLYFILLMODE: {
                    const polyfillmode = reader.readUint16();
                    this._records.push((gdi) => {
                        gdi.setPolyFillMode(polyfillmode);
                    });
                    break;
                }
                case Helper.GDI.RecordType.META_POLYPOLYGON: {
                    const cnt = reader.readUint16();
                    const polygonsPtCnts = [];
                    for (let i = 0; i < cnt; i++) {
                        polygonsPtCnts.push(reader.readUint16());
                    }

                    const polygons: PointS[][] = [];
                    for (let i = 0; i < cnt; i++) {
                        const ptCnt = polygonsPtCnts[i];

                        const p = [];
                        for (let ip = 0; ip < ptCnt; ip++) {
                            p.push(new PointS(reader));
                        }
                        polygons.push(p);
                    }
                    this._records.push((gdi) => {
                        gdi.polyPolygon(polygons);
                    });
                    break;
                }
                case Helper.GDI.RecordType.META_POLYLINE: {
                    let cnt = reader.readInt16();
                    const points: PointS[] = [];
                    while (cnt > 0) {
                        points.push(new PointS(reader));
                        cnt--;
                    }
                    this._records.push((gdi) => {
                        gdi.polyline(points);
                    });
                    break;
                }
                case Helper.GDI.RecordType.META_ELLIPSE: {
                    const rect = new Rect(reader);
                    this._records.push((gdi) => {
                        gdi.ellipse(rect);
                    });
                    break;
                }
                case Helper.GDI.RecordType.META_CREATEPALETTE: {
                    const palette = new Palette(reader);
                    this._records.push((gdi) => {
                        gdi.createPalette(palette);
                    });
                    break;
                }
                case Helper.GDI.RecordType.META_CREATEREGION: {
                    const region = new Region(reader);
                    this._records.push((gdi) => {
                        gdi.createRegion(region);
                    });
                    break;
                }
                case Helper.GDI.RecordType.META_CREATEPATTERNBRUSH: {
                    const datalength = size * 2 - (reader.pos - curpos);
                    const patternBitmap = new PatternBitmap16(reader, datalength);
                    const brush = new Brush(reader, datalength, patternBitmap);
                    this._records.push((gdi) => {
                        gdi.createPatternBrush(brush);
                    });
                    break;
                }
                case Helper.GDI.RecordType.META_OFFSETCLIPRGN: {
                    const offY = reader.readInt16();
                    const offX = reader.readInt16();
                    this._records.push((gdi) => {
                        gdi.offsetClipRgn(offX, offY);
                    });
                    break;
                }
                case Helper.GDI.RecordType.META_REALIZEPALETTE:
                case Helper.GDI.RecordType.META_SETPALENTRIES:
                case Helper.GDI.RecordType.META_SETROP2:
                case Helper.GDI.RecordType.META_SETRELABS:
                case Helper.GDI.RecordType.META_SETTEXTCHAREXTRA:
                case Helper.GDI.RecordType.META_RESIZEPALETTE:
                case Helper.GDI.RecordType.META_SETLAYOUT:
                case Helper.GDI.RecordType.META_FILLREGION:
                case Helper.GDI.RecordType.META_SETMAPPERFLAGS:
                case Helper.GDI.RecordType.META_SETTEXTJUSTIFICATION:
                case Helper.GDI.RecordType.META_SCALEWINDOWEXT:
                case Helper.GDI.RecordType.META_SCALEVIEWPORTEXT:
                case Helper.GDI.RecordType.META_FLOODFILL:
                case Helper.GDI.RecordType.META_FRAMEREGION:
                case Helper.GDI.RecordType.META_ANIMATEPALETTE:
                case Helper.GDI.RecordType.META_EXTFLOODFILL:
                case Helper.GDI.RecordType.META_SETPIXEL:
                case Helper.GDI.RecordType.META_PATBLT:
                case Helper.GDI.RecordType.META_PIE:
                case Helper.GDI.RecordType.META_STRETCHBLT:
                case Helper.GDI.RecordType.META_INVERTREGION:
                case Helper.GDI.RecordType.META_PAINTREGION:
                case Helper.GDI.RecordType.META_ARC:
                case Helper.GDI.RecordType.META_CHORD:
                case Helper.GDI.RecordType.META_BITBLT:
                case Helper.GDI.RecordType.META_SETDIBTODEV:
                default: {
                    let recordName = "UNKNOWN";
                    for (const name in Helper.GDI.RecordType) {
                        const recordTypes: any = Helper.GDI.RecordType;
                        if (recordTypes[name] === type) {
                            recordName = name;
                            break;
                        }
                    }
                    Helper.log("[WMF] " + recordName + " record (0x" + type.toString(16) + ") at offset 0x"
                        + curpos.toString(16) + " with " + (size * 2) + " bytes");
                    break;
                }
            }

            curpos += size * 2;
        }

        if (!all) {
            throw new WMFJSError("Could not read all records");
        }
    }

    public play(gdi: GDIContext): void {
        const len = this._records.length;
        for (let i = 0; i < len; i++) {
            this._records[i](gdi);
        }
    }
}

// ===== wmfjs/Renderer.ts =====
interface IRendererSettings {
    width: string;
    height: string;
    xExt: number;
    yExt: number;
    mapMode: number;
}

class Renderer {
    private _img: WMF;

    constructor(blob: ArrayBuffer) {
        this.parse(blob);
        Helper.log("WMFJS.Renderer instantiated");
    }

    public render(info: IRendererSettings): SVGElement {
        const svgElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");

        this._render(new SVG(svgElement), info.mapMode, info.xExt, info.yExt);
        svgElement.setAttribute("viewBox", [0, 0, info.xExt, info.yExt].join(" "));
        svgElement.setAttribute("preserveAspectRatio", "none"); // TODO: MM_ISOTROPIC vs MM_ANISOTROPIC
        svgElement.setAttribute("width", info.width);
        svgElement.setAttribute("height", info.height);
        return svgElement;
    }

    private parse(blob: ArrayBuffer) {
        this._img = null;

        const reader = new Blob(blob);

        let type;
        let size;
        let placable;
        let headerstart;
        const key = reader.readUint32();
        if (key === 0x9ac6cdd7) {
            placable = new WMFPlacable(reader);
            headerstart = reader.pos;
            type = reader.readUint16();
            size = reader.readUint16();
        } else {
            headerstart = 0;
            type = key & 0xffff;
            size = (key >>> 16) & 0xffff;
        }
        switch (type) {
            case Helper.GDI.MetafileType.MEMORYMETAFILE:
            case Helper.GDI.MetafileType.DISKMETAFILE:
                if (size === Helper.GDI.METAHEADER_SIZE / 2) {
                    const version = reader.readUint16();
                    switch (version) {
                        case Helper.GDI.MetafileVersion.METAVERSION100:
                        case Helper.GDI.MetafileVersion.METAVERSION300:
                            this._img = new WMF(reader, placable, version, headerstart + (size * 2));
                            break;
                    }
                }
                break;
        }

        if (this._img == null) {
            throw new WMFJSError("Format not recognized");
        }
    }

    private _render(svg: SVG, mapMode: number, xExt: number, yExt: number) {
        // See https://www-user.tu-chemnitz.de/~ygu/petzold/ch18b.htm
        const gdi = new GDIContext(svg);
        gdi.setViewportExt(xExt, yExt);
        gdi.setMapMode(mapMode);
        Helper.log("[WMF] BEGIN RENDERING --->");
        this._img.render(gdi);
        Helper.log("[WMF] <--- DONE RENDERING");
    }
}

class WMFRect16 {
    private left: number;
    private top: number;
    private right: number;
    private bottom: number;

    constructor(reader: Blob) {
        this.left = reader.readInt16();
        this.top = reader.readInt16();
        this.right = reader.readInt16();
        this.bottom = reader.readInt16();
    }

    public toString(): string {
        return "{left: " + this.left + ", top: " + this.top + ", right: " + this.right
            + ", bottom: " + this.bottom + "}";
    }
}

class WMFPlacable {
    private boundingBox: WMFRect16;
    private unitsPerInch: number;

    constructor(reader: Blob) {
        reader.skip(2);
        this.boundingBox = new WMFRect16(reader);
        this.unitsPerInch = reader.readInt16();
        reader.skip(4);
        reader.skip(2); // TODO: checksum
        Helper.log("Got bounding box " + this.boundingBox + " and " + this.unitsPerInch + " units/inch");
    }
}

class WMF {
    private _version: number;
    private _hdrsize: number;
    private _placable: WMFPlacable;
    private _records: WMFRecords;

    constructor(reader: Blob, placable: WMFPlacable, version: number, hdrsize: number) {
        this._version = version;
        this._hdrsize = hdrsize;
        this._placable = placable;
        this._records = new WMFRecords(reader, this._hdrsize);
    }

    public render(gdi: GDIContext): void {
        this._records.play(gdi);
    }
}

export { Renderer, WMFJSError as Error, loggingEnabled };
