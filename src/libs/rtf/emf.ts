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

// ===== emfjs/Helper.ts =====
class EMFJSError extends Error {
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
        FormatSignature: {
            ENHMETA_SIGNATURE: 0x464D4520,
            EPS_SIGNATURE: 0x46535045,
        },
        BITMAPINFOHEADER_SIZE: 40,
        BITMAPCOREHEADER_SIZE: 12,
        RecordType: {
            EMR_POLYBEZIER: 0x00000002,
            EMR_POLYGON: 0x00000003,
            EMR_POLYLINE: 0x00000004,
            EMR_POLYBEZIERTO: 0x00000005,
            EMR_POLYLINETO: 0x00000006,
            EMR_POLYPOLYLINE: 0x00000007,
            EMR_POLYPOLYGON: 0x00000008,
            EMR_SETWINDOWEXTEX: 0x00000009,
            EMR_SETWINDOWORGEX: 0x0000000A,
            EMR_SETVIEWPORTEXTEX: 0x0000000B,
            EMR_SETVIEWPORTORGEX: 0x0000000C,
            EMR_SETBRUSHORGEX: 0x0000000D,
            EMR_EOF: 0x0000000E,
            EMR_SETPIXELV: 0x0000000F,
            EMR_SETMAPPERFLAGS: 0x00000010,
            EMR_SETMAPMODE: 0x00000011,
            EMR_SETBKMODE: 0x00000012,
            EMR_SETPOLYFILLMODE: 0x00000013,
            EMR_SETROP2: 0x00000014,
            EMR_SETSTRETCHBLTMODE: 0x00000015,
            EMR_SETTEXTALIGN: 0x00000016,
            EMR_SETCOLORADJUSTMENT: 0x00000017,
            EMR_SETTEXTCOLOR: 0x00000018,
            EMR_SETBKCOLOR: 0x00000019,
            EMR_OFFSETCLIPRGN: 0x0000001A,
            EMR_MOVETOEX: 0x0000001B,
            EMR_SETMETARGN: 0x0000001C,
            EMR_EXCLUDECLIPRECT: 0x0000001D,
            EMR_INTERSECTCLIPRECT: 0x0000001E,
            EMR_SCALEVIEWPORTEXTEX: 0x0000001F,
            EMR_SCALEWINDOWEXTEX: 0x00000020,
            EMR_SAVEDC: 0x00000021,
            EMR_RESTOREDC: 0x00000022,
            EMR_SETWORLDTRANSFORM: 0x00000023,
            EMR_MODIFYWORLDTRANSFORM: 0x00000024,
            EMR_SELECTOBJECT: 0x00000025,
            EMR_CREATEPEN: 0x00000026,
            EMR_CREATEBRUSHINDIRECT: 0x00000027,
            EMR_DELETEOBJECT: 0x00000028,
            EMR_ANGLEARC: 0x00000029,
            EMR_ELLIPSE: 0x0000002A,
            EMR_RECTANGLE: 0x0000002B,
            EMR_ROUNDRECT: 0x0000002C,
            EMR_ARC: 0x0000002D,
            EMR_CHORD: 0x0000002E,
            EMR_PIE: 0x0000002F,
            EMR_SELECTPALETTE: 0x00000030,
            EMR_CREATEPALETTE: 0x00000031,
            EMR_SETPALETTEENTRIES: 0x00000032,
            EMR_RESIZEPALETTE: 0x00000033,
            EMR_REALIZEPALETTE: 0x00000034,
            EMR_EXTFLOODFILL: 0x00000035,
            EMR_LINETO: 0x00000036,
            EMR_ARCTO: 0x00000037,
            EMR_POLYDRAW: 0x00000038,
            EMR_SETARCDIRECTION: 0x00000039,
            EMR_SETMITERLIMIT: 0x0000003A,
            EMR_BEGINPATH: 0x0000003B,
            EMR_ENDPATH: 0x0000003C,
            EMR_CLOSEFIGURE: 0x0000003D,
            EMR_FILLPATH: 0x0000003E,
            EMR_STROKEANDFILLPATH: 0x0000003F,
            EMR_STROKEPATH: 0x00000040,
            EMR_FLATTENPATH: 0x00000041,
            EMR_WIDENPATH: 0x00000042,
            EMR_SELECTCLIPPATH: 0x00000043,
            EMR_ABORTPATH: 0x00000044,
            EMR_COMMENT: 0x00000046,
            EMR_FILLRGN: 0x00000047,
            EMR_FRAMERGN: 0x00000048,
            EMR_INVERTRGN: 0x00000049,
            EMR_PAINTRGN: 0x0000004A,
            EMR_EXTSELECTCLIPRGN: 0x0000004B,
            EMR_BITBLT: 0x0000004C,
            EMR_STRETCHBLT: 0x0000004D,
            EMR_MASKBLT: 0x0000004E,
            EMR_PLGBLT: 0x0000004F,
            EMR_SETDIBITSTODEVICE: 0x00000050,
            EMR_STRETCHDIBITS: 0x00000051,
            EMR_EXTCREATEFONTINDIRECTW: 0x00000052,
            EMR_EXTTEXTOUTA: 0x00000053,
            EMR_EXTTEXTOUTW: 0x00000054,
            EMR_POLYBEZIER16: 0x00000055,
            EMR_POLYGON16: 0x00000056,
            EMR_POLYLINE16: 0x00000057,
            EMR_POLYBEZIERTO16: 0x00000058,
            EMR_POLYLINETO16: 0x00000059,
            EMR_POLYPOLYLINE16: 0x0000005A,
            EMR_POLYPOLYGON16: 0x0000005B,
            EMR_POLYDRAW16: 0x0000005C,
            EMR_CREATEMONOBRUSH: 0x0000005D,
            EMR_CREATEDIBPATTERNBRUSHPT: 0x0000005E,
            EMR_EXTCREATEPEN: 0x0000005F,
            EMR_POLYTEXTOUTA: 0x00000060,
            EMR_POLYTEXTOUTW: 0x00000061,
            EMR_SETICMMODE: 0x00000062,
            EMR_CREATECOLORSPACE: 0x00000063,
            EMR_SETCOLORSPACE: 0x00000064,
            EMR_DELETECOLORSPACE: 0x00000065,
            EMR_GLSRECORD: 0x00000066,
            EMR_GLSBOUNDEDRECORD: 0x00000067,
            EMR_PIXELFORMAT: 0x00000068,
            EMR_DRAWESCAPE: 0x00000069,
            EMR_EXTESCAPE: 0x0000006A,
            EMR_SMALLTEXTOUT: 0x0000006C,
            EMR_FORCEUFIMAPPING: 0x0000006D,
            EMR_NAMEDESCAPE: 0x0000006E,
            EMR_COLORCORRECTPALETTE: 0x0000006F,
            EMR_SETICMPROFILEA: 0x00000070,
            EMR_SETICMPROFILEW: 0x00000071,
            EMR_ALPHABLEND: 0x00000072,
            EMR_SETLAYOUT: 0x00000073,
            EMR_TRANSPARENTBLT: 0x00000074,
            EMR_GRADIENTFILL: 0x00000076,
            EMR_SETLINKEDUFIS: 0x00000077,
            EMR_SETTEXTJUSTIFICATION: 0x00000078,
            EMR_COLORMATCHTOTARGETW: 0x00000079,
            EMR_CREATECOLORSPACEW: 0x0000007A,
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
        MixMode: {
            TRANSPARENT: 1,
            OPAQUE: 2,
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
            PS_COSMETIC: 0x00000000,
            PS_ENDCAP_ROUND: 0x00000000,
            PS_JOIN_ROUND: 0x00000000,
            PS_SOLID: 0x00000000,
            PS_DASH: 0x00000001,
            PS_DOT: 0x00000002,
            PS_DASHDOT: 0x00000003,
            PS_DASHDOTDOT: 0x00000004,
            PS_NULL: 0x00000005,
            PS_INSIDEFRAME: 0x00000006,
            PS_USERSTYLE: 0x00000007,
            PS_ALTERNATE: 0x00000008,
            PS_ENDCAP_SQUARE: 0x00000100,
            PS_ENDCAP_FLAT: 0x00000200,
            PS_JOIN_BEVEL: 0x00001000,
            PS_JOIN_MITER: 0x00002000,
            PS_GEOMETRIC: 0x00010000,
        },
        PolygonFillMode: {
            ALTERNATE: 1,
            WINDING: 2,
        },
        BitmapCompression: {
            BI_RGB: 0,
            BI_RLE8: 1,
            BI_RLE4: 2,
            BI_BITFIELDS: 3,
            BI_JPEG: 4,
            BI_PNG: 5,
        },
        RegionMode: {
            RGN_AND: 1,
            RGN_OR: 2,
            RGN_XOR: 3,
            RGN_DIFF: 4,
            RGN_COPY: 5,
        },
        StockObject: {
            WHITE_BRUSH: 0x80000000,
            LTGRAY_BRUSH: 0x80000001,
            GRAY_BRUSH: 0x80000002,
            DKGRAY_BRUSH: 0x80000003,
            BLACK_BRUSH: 0x80000004,
            NULL_BRUSH: 0x80000005,
            WHITE_PEN: 0x80000006,
            BLACK_PEN: 0x80000007,
            NULL_PEN: 0x80000008,
            OEM_FIXED_FONT: 0x8000000A,
            ANSI_FIXED_FONT: 0x8000000B,
            ANSI_VAR_FONT: 0x8000000C,
            SYSTEM_FONT: 0x8000000D,
            DEVICE_DEFAULT_FONT: 0x8000000E,
            DEFAULT_PALETTE: 0x8000000F,
            SYSTEM_FIXED_FONT: 0x80000010,
            DEFAULT_GUI_FONT: 0x80000011,
            DC_BRUSH: 0x80000012,
            DC_PEN: 0x80000013,
        },
    };

    public static _uniqueId = 0;

    public static log(message: string): void {
        if (isLoggingEnabled) {
            console.log(message);
        }
    }

    public static _makeUniqueId(prefix: string): string {
        return "EMFJS_" + prefix + (this._uniqueId++);
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

// ===== emfjs/Blob.ts =====
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
            throw new EMFJSError("Invalid seek position");
        }
        this.pos = newpos;
    }

    public skip(cnt: number): void {
        const newPos = this.pos + cnt;
        if (newPos > this.data.length) {
            throw new EMFJSError("Unexpected end of file");
        }
        this.pos = newPos;
    }

    public readBinary(cnt: number): string {
        const end = this.pos + cnt;
        if (end > this.data.length) {
            throw new EMFJSError("Unexpected end of file");
        }
        let ret = "";
        while (cnt-- > 0) {
            ret += String.fromCharCode(this.data[this.pos++]);
        }
        return ret;
    }

    public readInt8(): number {
        if (this.pos + 1 > this.data.length) {
            throw new EMFJSError("Unexpected end of file");
        }
        return this.data[this.pos++];
    }

    public readUint8(): number {
        return this.readInt8() >>> 0;
    }

    public readInt32(): number {
        if (this.pos + 4 > this.data.length) {
            throw new EMFJSError("Unexpected end of file");
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
            throw new EMFJSError("Unexpected end of file");
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
            throw new EMFJSError("Unexpected end of file");
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
                    throw new EMFJSError("Unexpected end of file");
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

    public readFixedSizeUnicodeString(fixedSizeChars: number): string {
        let ret = "";
        for (let i = 0; i < fixedSizeChars; i++) {
            const charCode = this.readUint16();
            if (charCode === 0) {
                if (++i < fixedSizeChars) {
                    this.skip((fixedSizeChars - i) * 2);
                }
                break;
            }
            ret += String.fromCharCode(charCode);
        }
        return ret;
    }
}

// ===== emfjs/Primitives.ts =====
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

class PointL {
    public x: number;
    public y: number;

    constructor(reader: Blob, x?: number, y?: number) {
        if (reader != null) {
            this.x = reader.readInt32();
            this.y = reader.readInt32();
        } else {
            this.x = x;
            this.y = y;
        }
    }

    public clone(): PointL {
        return new PointL(null, this.x, this.y);
    }

    public toString(): string {
        return "{x: " + this.x + ", y: " + this.y + "}";
    }
}

class RectL {
    public left: number;
    public top: number;
    public right: number;
    public bottom: number;

    constructor(reader: Blob, left?: number, top?: number, right?: number, bottom?: number) {
        if (reader != null) {
            this.left = reader.readInt32();
            this.top = reader.readInt32();
            this.right = reader.readInt32();
            this.bottom = reader.readInt32();
        } else {
            this.bottom = bottom;
            this.right = right;
            this.top = top;
            this.left = left;
        }
    }

    public clone(): RectL {
        return new RectL(null, this.left, this.top, this.right, this.bottom);
    }

    public toString(): string {
        return "{left: " + this.left + ", top: " + this.top + ", right: " + this.right
            + ", bottom: " + this.bottom + "}";
    }

    public empty(): boolean {
        return this.left >= this.right || this.top >= this.bottom;
    }

    public intersect(rectL: RectL): null | RectL {
        if (this.empty() || rectL.empty()) {
            return null;
        }
        if (this.left >= rectL.right || this.top >= rectL.bottom ||
            this.right <= rectL.left || this.bottom <= rectL.top) {
            return null;
        }
        return new RectL(null, Math.max(this.left, rectL.left), Math.max(this.top, rectL.top),
            Math.min(this.right, rectL.right), Math.min(this.bottom, rectL.bottom));
    }
}

class SizeL {
    public cx: number;
    public cy: number;

    constructor(reader: Blob, cx?: number, cy?: number) {
        if (reader != null) {
            this.cx = reader.readUint32();
            this.cy = reader.readUint32();
        } else {
            this.cx = cx;
            this.cy = cy;
        }
    }

    public clone(): SizeL {
        return new SizeL(null, this.cx, this.cy);
    }

    public toString(): string {
        return "{cx: " + this.cx + ", cy: " + this.cy + "}";
    }
}

class Obj {
    public type: string;

    constructor(type: string) {
        this.type = type;
    }

    public clone(): Obj {
        throw new EMFJSError("clone not implemented");
    }

    public toString(): string {
        throw new EMFJSError("toString not implemented");
    }
}

// ===== emfjs/Bitmap.ts =====
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
    private _usergb: boolean;
    private _infosize: number;
    private _header: BitmapCoreHeader | BitmapInfoHeader;

    constructor(reader: Blob, usergb: boolean) {
        this._usergb = usergb;
        const hdrsize = reader.readUint32();
        this._infosize = hdrsize;
        if (hdrsize === Helper.GDI.BITMAPCOREHEADER_SIZE) {
            this._header = new BitmapCoreHeader(reader, false);
            this._infosize += this._header.colors() * (usergb ? 3 : 2);
        } else {
            this._header = new BitmapInfoHeader(reader, false);
            const masks = (this._header as BitmapInfoHeader).compression
            === Helper.GDI.BitmapCompression.BI_BITFIELDS ? 3 : 0;
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
    private _location: any;
    private _info: BitmapInfo;

    constructor(reader: Blob, bitmapInfo?: any) {
        this._reader = reader;
        this._offset = reader.pos;
        this._location = bitmapInfo;
        this._info = new BitmapInfo(reader, true);
    }

    public getWidth(): number {
        return this._info.getWidth();
    }

    public getHeight(): number {
        return this._info.getHeight();
    }

    public totalSize(): number {
        return this._location.header.size + this._location.data.size;
    }

    public makeBitmapFileHeader(): string {
        const buf = new ArrayBuffer(14);
        const view = new Uint8Array(buf);
        view[0] = 0x42;
        view[1] = 0x4d;
        Helper._writeUint32Val(view, 2, this.totalSize() + 14);
        Helper._writeUint32Val(view, 10, this._info.infosize() + 14);
        return Helper._blobToBinary(view);
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

        this._reader.seek(this._location.header.offset);
        if (data != null) {
            data += this._reader.readBinary(this._location.header.size);
        } else {
            data = this._reader.readBinary(this._location.header.size);
        }

        this._reader.seek(this._location.data.offset);
        data += this._reader.readBinary(this._location.data.size);

        const ref = "data:" + mime + ";base64," + btoa(data);
        this._reader.seek(prevpos);
        return ref;
    }
}

// ===== emfjs/Style.ts =====
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
            this.height = reader.readInt32();
            this.width = reader.readInt32();
            this.escapement = reader.readInt32();
            this.orientation = reader.readInt32();
            this.weight = reader.readInt32();
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
            this.facename = reader.readFixedSizeUnicodeString(Math.min(dataLength - (reader.pos - start), 32));
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
    public pattern: DIBitmap;
    public dibpatternpt: DIBitmap;
    public hatchstyle: number;

    constructor(reader: Blob, copy?: {
        style?: number, color?: ColorRef, pattern?: DIBitmap,
        dibpatternpt?: DIBitmap, hatchstyle?: number
    }) {
        super("brush");
        if (reader != null) {
            const start = reader.pos;

            this.style = reader.readUint32();
            switch (this.style) {
                case Helper.GDI.BrushStyle.BS_SOLID:
                    this.color = new ColorRef(reader);
                    break;
                case Helper.GDI.BrushStyle.BS_PATTERN:
                    this.pattern = new DIBitmap(reader);
                    break;
                case Helper.GDI.BrushStyle.BS_DIBPATTERNPT:
                    this.dibpatternpt = new DIBitmap(reader);
                    break;
                case Helper.GDI.BrushStyle.BS_HATCHED:
                    this.color = new ColorRef(reader);
                    this.hatchstyle = reader.readUint32();
                    break;
            }

            reader.seek(start + 12);
        } else {
            this.style = copy.style;
            switch (this.style) {
                case Helper.GDI.BrushStyle.BS_SOLID:
                    this.color = copy.color.clone();
                    break;
                case Helper.GDI.BrushStyle.BS_PATTERN:
                    this.pattern = copy.pattern;
                    break;
                case Helper.GDI.BrushStyle.BS_DIBPATTERNPT:
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
            case Helper.GDI.BrushStyle.BS_HATCHED:
                ret += ", color: " + this.color.toString() + ", hatchstyle: " + this.hatchstyle;
                break;
        }
        return ret + "}";
    }
}

class Pen extends Obj {
    public style: number | { header: { off: number, size: number }, data: { off: number, size: number } };
    public width: number;
    public brush: Brush;
    public color: ColorRef;

    constructor(reader: Blob, style?: number | { header: { off: number, size: number }, data: { off: number, size: number } },
                width?: number, color?: ColorRef, brush?: Brush) {
        super("pen");
        if (reader != null) {
            if (style != null) {
                // LogPenEx
                this.style = reader.readUint32() & 0xFF;
                this.width = reader.readUint32();
                this.brush = new Brush(reader);
                this.color = this.brush.color != null ? this.brush.color.clone() : new ColorRef(null, 0, 0, 0);
                // TODO: NumStyleEntries, StyleEntry
            } else {
                // LogPen
                this.style = reader.readUint32() & 0xFF;
                this.width = (new PointL(reader)).x;
                this.color = new ColorRef(reader);
            }
        } else {
            this.style = style;
            this.width = width;
            if (color != null) {
                this.color = color;
            }
            if (brush != null) {
                this.brush = brush;
            }
        }
    }

    public clone(): Pen {
        return new Pen(null, this.style, this.width, this.color != null ? this.color.clone() : null,
            this.brush != null ? this.brush.clone() : null);
    }

    public toString(): string {
        return "{style: " + this.style + ", width: " + this.width
            + ", color: " + (this.color != null ? this.color.toString() : "none") + "}";
    }
}

// ===== emfjs/Region.ts =====
class Region extends Obj {
    public bounds: RectL;
    public scans: Scan[];
    public complexity: number;

    constructor(reader: Blob, copy?: Region) {
        super("region");
        if (reader != null) {
            const hdrSize = reader.readUint32();
            if (hdrSize !== 32) {
                throw new EMFJSError("Invalid region header");
            }
            reader.skip(4);
            const rectCnt = reader.readUint32();
            const rgnSize = reader.readUint32();
            if (rectCnt * 16 !== rgnSize) {
                throw new EMFJSError("Invalid region data");
            }

            this.bounds = new RectL(reader);
            this.scans = [];
            let scanLine;
            for (let i = 0; i < rectCnt; i++) {
                const r = new RectL(reader);
                if (!!scanLine || scanLine.top !== r.top || scanLine.bottom !== r.bottom) {
                    scanLine = new Scan(r);
                    this.scans.push(scanLine);
                } else {
                    scanLine.append(r);
                }
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

    public subtract(rect: RectL): void {
        Helper.log("[emf] Region " + this.toString() + " subtract " + rect.toString());

        if (this.bounds != null) {
            const isect = this.bounds.intersect(rect);
            if (isect != null) { // Only need to do anything if there is any chance of an overlap
                if (this.scans == null) {
                    // We currently have a simple region and there is some kind of an overlap.
                    // We need to create scanlines now.  Simplest method is to fake one scan line
                    // that equals the simple region and re-use the same logic as for complex regions
                    this.scans = [];
                    this.scans.push(new Scan(new RectL(null, this.bounds.left, this.bounds.top,
                        this.bounds.right, this.bounds.bottom)));
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
                            Helper.log("[emf] Region split top scan " + si + " for substraction");
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
                            Helper.log("[emf] Region split bottom scan " + si + " for substraction");
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
                            Helper.log("[emf] Region remove now empty scan " + si + " due to subtraction");
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
                        this.bounds = new RectL(null, left, top, right, bottom);
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

        Helper.log("[emf] Region subtraction -> " + this.toString());
    }

    public intersect(rect: RectL): void {
        Helper.log("[emf] Region " + this.toString() + " intersect with " + rect.toString());
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
                        Helper.log("[emf] Region remove " + si + " scans from top");
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
                            Helper.log("[emf] Region remove " + (this.scans.length - si) + " scans from bottom");
                            this.scans.splice(si, this.scans.length - si);
                            break;
                        }
                        if (!scan.intersect(this.bounds.left, this.bounds.right)) {
                            // Remove now empty scan
                            Helper.log("[emf] Region remove now empty scan " + si + " due to intersection");
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
        Helper.log("[emf] Region intersection -> " + this.toString());
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
    rgn.bounds = new RectL(null, left, top, right, bottom);
    rgn._updateComplexity();
    return rgn;
}

class Scan {
    public top: number;
    public bottom: number;
    public scanlines: { left: number, right: number }[];

    constructor(r: RectL, copy?: Scan) {
        if (r != null) {
            this.top = r.top;
            this.bottom = r.bottom;
            this.scanlines = [{left: r.left, right: r.right}];
        } else if (copy != null) {
            this.top = copy.top;
            this.bottom = copy.bottom;
            this.scanlines = [];
            for (let i = 0; i < copy.scanlines.length; i++) {
                const scanline = copy.scanlines[i];
                this.scanlines.push({left: scanline.left, right: scanline.right});
            }
        }
    }

    public clone(): Scan {
        return new Scan(null, this);
    }

    public append(r: RectL): void {
        this.scanlines.push({left: r.left, right: r.right});
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
}

// ===== emfjs/GDIContext.ts =====
interface ISelectedStyle {
    brush?: Brush;
    pen?: Pen;
    font?: Font;
    region?: Region;
    path?: Path;

    [key: string]: Obj | undefined;
}

class Path extends Obj {
    public svgPath: SVGPathBuilder;

    constructor(svgPath: SVGPathBuilder, copy?: Path) {
        super("path");
        if (svgPath != null) {
            this.svgPath = svgPath;
        } else {
            this.svgPath = copy.svgPath;
        }
    }

    public clone(): Path {
        return new Path(null, this);
    }

    public toString(): string {
        return "{[path]}";
    }
}

function createStockObjects(): { [key: string]: Obj } {
    // Create global stock objects
    const createSolidBrush = (r: number, g: number, b: number) => {
        return new Brush(null, {
            style: Helper.GDI.BrushStyle.BS_SOLID,
            color: new ColorRef(null, r, g, b),
        });
    };
    const createSolidPen = (r: number, g: number, b: number) => {
        return new Pen(null, Helper.GDI.PenStyle.PS_SOLID, 1, new ColorRef(null, r, g, b), null);
    };
    const stockObjs: { [key: string]: Obj } = {
        WHITE_BRUSH: createSolidBrush(255, 255, 255),
        LTGRAY_BRUSH: createSolidBrush(212, 208, 200),
        GRAY_BRUSH: createSolidBrush(128, 128, 128),
        DKGRAY_BRUSH: createSolidBrush(64, 64, 64),
        BLACK_BRUSH: createSolidBrush(0, 0, 0),
        NULL_BRUSH: new Brush(null, {
            style: Helper.GDI.BrushStyle.BS_NULL,
        }),
        WHITE_PEN: createSolidPen(255, 255, 255),
        BLACK_PEN: createSolidPen(0, 0, 0),
        NULL_PEN: new Pen(null, Helper.GDI.PenStyle.PS_NULL, 0, null, null),
        OEM_FIXED_FONT: null, // TODO
        ANSI_FIXED_FONT: null, // TODO
        ANSI_VAR_FONT: null, // TODO
        SYSTEM_FONT: null, // TODO
        DEVICE_DEFAULT_FONT: null, // TODO
        DEFAULT_PALETTE: null, // TODO
        SYSTEM_FIXED_FONT: null, // TODO
        DEFAULT_GUI_FONT: null, // TODO
    };

    const objs: { [key: string]: Obj } = {};
    for (const t in stockObjs) {
        const stockObjects: { [key: string]: number } = Helper.GDI.StockObject as { [key: string]: number };
        const idx = stockObjects[t] - 0x80000000;
        objs[idx.toString()] = stockObjs[t];
    }
    return objs;
}

const _StockObjects = createStockObjects();

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
    public miterlimit: number;
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
    public nextbrx: number;
    public nextbry: number;
    public brx: number;
    public bry: number;
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
            this.miterlimit = copy.miterlimit;
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
            this.nextbrx = copy.nextbrx;
            this.nextbry = copy.nextbry;
            this.brx = copy.brx;
            this.bry = copy.bry;

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
            this.polyfillmode = Helper.GDI.PolygonFillMode.ALTERNATE;
            this.miterlimit = 10;
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
            this.nextbrx = 0;
            this.nextbry = 0;
            this.brx = 0;
            this.bry = 0;

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
    private _svgPath: SVGPathBuilder;
    private defObjects: ISelectedStyle;
    private state: GDIContextState;
    private statestack: GDIContextState[];
    private objects: { [key: string]: Obj };

    constructor(svg: SVG) {
        this._svg = svg;
        this._svgdefs = null;
        this._svgPatterns = {};
        this._svgClipPaths = {};
        this._svgPath = null;

        this.defObjects = {
            brush: new Brush(null, {
                style: Helper.GDI.BrushStyle.BS_SOLID,
                color: new ColorRef(null, 0, 0, 0),
            }),
            pen: new Pen(null, Helper.GDI.PenStyle.PS_SOLID, 1, new ColorRef(null, 0, 0, 0), null),
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

    public setWindowOrgEx(x: number, y: number): void {
        Helper.log("[gdi] setWindowOrgEx: x=" + x + " y=" + y);
        this.state.wx = x;
        this.state.wy = y;
        this.state._svggroup = null;
    }

    public setWindowExtEx(x: number, y: number): void {
        Helper.log("[gdi] setWindowExtEx: x=" + x + " y=" + y);
        this.state.ww = x;
        this.state.wh = y;
        this.state._svggroup = null;
    }

    public setViewportOrgEx(x: number, y: number): void {
        Helper.log("[gdi] setViewportOrgEx: x=" + x + " y=" + y);
        this.state.vx = x;
        this.state.vy = y;
        this.state._svggroup = null;
    }

    public setViewportExtEx(x: number, y: number): void {
        Helper.log("[gdi] setViewportExtEx: x=" + x + " y=" + y);
        this.state.vw = x;
        this.state.vh = y;
        this.state._svggroup = null;
    }

    public setBrushOrgEx(origin: PointL): void {
        Helper.log("[gdi] setBrushOrgEx: x=" + origin.x + " y=" + origin.y);
        this.state.nextbrx = origin.x;
        this.state.nextbry = origin.y;
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
                throw new EMFJSError("restoreDC: relative restore not implemented");
            } else if (saved > 1) {
                throw new EMFJSError("restoreDC: absolute restore not implemented");
            }
        } else {
            throw new EMFJSError("No saved contexts");
        }

        this.state._svggroup = null;
    }

    public setStretchBltMode(stretchMode: number): void {
        Helper.log("[gdi] setStretchBltMode: stretchMode=" + stretchMode);
    }

    public rectangle(rect: RectL, rw: number, rh: number): void {
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

    public moveToEx(x: number, y: number): void {
        Helper.log("[gdi] moveToEx: x=" + x + " y=" + y);
        this.state.x = x;
        this.state.y = y;
        if (this._svgPath != null) {
            this._svgPath.move(this.state.x, this.state.y);
            Helper.log("[gdi] new path: " + this._svgPath.path());
        }
    }

    public polygon(points: PointS[] | PointL[], bounds: RectL, first: boolean): void {
        Helper.log("[gdi] polygon: points=" + points + " with pen " + this.state.selected.pen.toString()
            + " and brush " + this.state.selected.brush.toString());
        const pts = [];
        for (let i = 0; i < points.length; i++) {
            const point = points[i];
            pts.push([this._todevX(point.x), this._todevY(point.y)]);
        }
        if (first) {
            this._pushGroup();
        }
        const opts = {
            "fill-rule": this.state.polyfillmode === Helper.GDI.PolygonFillMode.ALTERNATE ? "evenodd" : "nonzero",
        };
        this._applyOpts(opts, true, true, false);
        this._svg.polygon(this.state._svggroup, pts, opts);
    }

    public polyPolygon(polygons: PointS[][] | PointL[][], bounds: RectL): void {
        Helper.log("[gdi] polyPolygon: polygons.length=" + polygons.length
            + " with pen " + this.state.selected.pen.toString() + " and brush " + this.state.selected.brush.toString());

        const cnt = polygons.length;
        for (let i = 0; i < cnt; i++) {
            this.polygon(polygons[i], bounds, i === 0);
        }
    }

    public polyline(isLineTo: boolean, points: PointS[], bounds: RectL): void {
        Helper.log("[gdi] polyline: isLineTo=" + isLineTo.toString() + ", points=" + points
            + ", bounds=" + bounds.toString() + " with pen " + this.state.selected.pen.toString());
        const pts: number[][] = [];
        for (let i = 0; i < points.length; i++) {
            const point = points[i];
            pts.push([this._todevX(point.x), this._todevY(point.y)]);
        }

        if (this._svgPath != null) {
            if (!isLineTo || pts.length === 0) {
                this._svgPath.move(this._todevX(this.state.x), this._todevY(this.state.y));
            } else {
                const firstPts = pts[0];
                this._svgPath.move(firstPts[0], firstPts[1]);
            }
            this._svgPath.line(pts);
            Helper.log("[gdi] new path: " + this._svgPath.path());
        } else {
            this._pushGroup();
            const opts = this._applyOpts(null, true, false, false);
            if (isLineTo && points.length > 0) {
                const firstPt = points[0];
                if (firstPt.x !== this.state.x || firstPt.y !== this.state.y) {
                    pts.unshift([this._todevX(this.state.x), this._todevY(this.state.y)]);
                }
            }
            this._svg.polyline(this.state._svggroup, pts, opts);
        }

        if (points.length > 0) {
            const lastPt = points[points.length - 1];
            this.state.x = lastPt.x;
            this.state.y = lastPt.y;
        }
    }

    public polybezier(isPolyBezierTo: boolean, points: PointS[], bounds: RectL): void {
        Helper.log("[gdi] polybezier: isPolyBezierTo=" + isPolyBezierTo.toString() + ", points=" + points
            + ", bounds=" + bounds.toString() + " with pen " + this.state.selected.pen.toString());
        const pts = [];
        for (let i = 0; i < points.length; i++) {
            const point = points[i];
            pts.push({x: this._todevX(point.x), y: this._todevY(point.y)});
        }

        if (this._svgPath != null) {
            if (isPolyBezierTo && pts.length > 0) {
                const firstPts = pts[0];
                this._svgPath.move(firstPts.x, firstPts.y);
            } else {
                this._svgPath.move(this._todevX(this.state.x), this._todevY(this.state.y));
            }

            if (pts.length < (isPolyBezierTo ? 3 : 4)) {
                throw new EMFJSError("Not enough points to draw bezier");
            }

            for (let i = isPolyBezierTo ? 1 : 0; i + 3 <= pts.length; i += 3) {
                const cp1 = pts[i];
                const cp2 = pts[i + 1];
                const ep = pts[i + 2];
                this._svgPath.curveC(cp1.x, cp1.y, cp2.x, cp2.y, ep.x, ep.y);
            }

            Helper.log("[gdi] new path: " + this._svgPath.path());
        } else {
            throw new EMFJSError("polybezier not implemented (not a path)");
        }

        if (points.length > 0) {
            const lastPt = points[points.length - 1];
            this.state.x = lastPt.x;
            this.state.y = lastPt.y;
        }
    }

    public selectClipPath(rgnMode: number): void {
        Helper.log("[gdi] selectClipPath: rgnMode=0x" + rgnMode.toString(16));
    }

    public selectClipRgn(rgnMode: number, region: Region): void {
        Helper.log("[gdi] selectClipRgn: rgnMode=0x" + rgnMode.toString(16));
        if (rgnMode === Helper.GDI.RegionMode.RGN_COPY) {
            this.state.selected.region = region;
            this.state.clip = null;
            this.state.ownclip = false;
        } else {
            if (region == null) {
                throw new EMFJSError("No clip region to select");
            }

            throw new EMFJSError("Not implemented: rgnMode=0x" + rgnMode.toString(16));
        }
        this.state._svgclipChanged = true;
    }

    public offsetClipRgn(offset: PointL): void {
        Helper.log("[gdi] offsetClipRgn: offset=" + offset.toString());
        this._getClipRgn().offset(offset.x, offset.y);
    }

    public setTextAlign(textAlignmentMode: number): void {
        Helper.log("[gdi] setTextAlign: textAlignmentMode=0x" + textAlignmentMode.toString(16));
        this.state.textalign = textAlignmentMode;
    }

    public setMiterLimit(miterLimit: number): void {
        Helper.log("[gdi] setMiterLimit: miterLimit=" + miterLimit);
        this.state.miterlimit = miterLimit;
    }

    public setBkMode(bkMode: number): void {
        Helper.log("[gdi] setBkMode: bkMode=0x" + bkMode.toString(16));
        this.state.bkmode = bkMode;
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

    public createBrush(index: number, brush: Brush): void {
        const idx = this._storeObject(brush, index);
        Helper.log("[gdi] createBrush: brush=" + brush.toString() + " with handle " + idx);
    }

    public createPen(index: number, pen: Pen): void {
        const idx = this._storeObject(pen, index);
        Helper.log("[gdi] createPen: pen=" + pen.toString() + " width handle " + idx);
    }

    public createPenEx(index: number, pen: Pen): void {
        const idx = this._storeObject(pen, index);
        Helper.log("[gdi] createPenEx: pen=" + pen.toString() + " width handle " + idx);
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

    public abortPath(): void {
        Helper.log("[gdi] abortPath");
        if (this._svgPath != null) {
            this._svgPath = null;
        }
    }

    public beginPath(): void {
        Helper.log("[gdi] beginPath");

        if (this._svgPath != null) {
            this._svgPath = null;
        }

        this._svgPath = this._svg.createPath();
    }

    public closeFigure(): void {
        Helper.log("[gdi] closeFigure");
        if (this._svgPath == null) {
            throw new EMFJSError("No path bracket: cannot close figure");
        }

        this._svgPath.close();
    }

    public fillPath(bounds: RectL): void {
        Helper.log("[gdi] fillPath");
        if (this.state.selected.path == null) {
            throw new EMFJSError("No path selected");
        }

        const selPath = this.state.selected.path;
        const opts = this._applyOpts(null, true, true, false);
        this._svg.path(this.state._svggroup, selPath.svgPath, opts);

        this._pushGroup();
        this.state.selected.path = null;
    }

    public strokePath(bounds: RectL): void {
        Helper.log("[gdi] strokePath");
        if (this.state.selected.path == null) {
            throw new EMFJSError("No path selected");
        }

        const selPath = this.state.selected.path;
        const opts = this._applyOpts({fill: "none"}, true, false, false);
        this._svg.path(this.state._svggroup, selPath.svgPath, opts);

        this._pushGroup();
        this.state.selected.path = null;
    }

    public endPath(): void {
        Helper.log("[gdi] endPath");
        if (this._svgPath == null) {
            throw new EMFJSError("No path bracket: cannot end path");
        }

        this._pushGroup();
        this._selectObject(new Path(this._svgPath));
        this._svgPath = null;
    }

    public deleteObject(objIdx: number): void {
        const ret = this._deleteObject(objIdx);
        Helper.log("[gdi] deleteObject: objIdx=" + objIdx + (ret ? " deleted object" : "[invalid index]"));
    }

    private _pushGroup(): void {
        if (this.state._svggroup == null || this.state._svgclipChanged) {
            this.state._svgclipChanged = false;
            this.state._svgtextbkfilter = null;

            const settings: any = {
                viewBox: [this.state.vx, this.state.vy, this.state.vw, this.state.vh].join(" "),
                preserveAspectRatio: "none",
            };
            if (this.state.clip != null) {
                Helper.log("[gdi] new svg x=" + this.state.vx + " y=" + this.state.vy + " width=" + this.state.vw
                    + " height=" + this.state.vh + " with clipping");
                settings["clip-path"] = "url(#" + this._getSvgClipPathForRegion(this.state.clip) + ")";
            } else {
                Helper.log("[gdi] new svg x=" + this.state.vx + " y=" + this.state.vy + " width=" + this.state.vw
                    + " height=" + this.state.vh + " without clipping");
            }
            this.state._svggroup = this._svg.svg(this.state._svggroup,
                this.state.vx, this.state.vy, this.state.vw, this.state.vh, settings);
        }
    }

    private _getStockObject(idx: number) {
        if (idx >= 0x80000000 && idx <= 0x80000011) {
            return _StockObjects[(idx - 0x80000000).toString()];
        } else if (idx === Helper.GDI.StockObject.DC_BRUSH) {
            return this.state.selected.brush;
        } else if (idx === Helper.GDI.StockObject.DC_PEN) {
            return this.state.selected.pen;
        }
        return null;
    }

    private _storeObject(obj: Obj, idx: number) {
        if (!idx) {
            idx = 0;
            while (this.objects[idx.toString()] != null && idx <= 65535) {
                idx++;
            }
            if (idx > 65535) {
                Helper.log("[gdi] Too many objects!");
                return -1;
            }
        }

        this.objects[idx.toString()] = obj;
        return idx;
    }

    private _getObject(objIdx: number) {
        let obj = this.objects[objIdx.toString()];
        if (obj == null) {
            obj = this._getStockObject(objIdx);
            if (obj == null) {
                Helper.log("[gdi] No object with handle " + objIdx);
            }
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
                this._svg.rect(sclip,
                    this._todevX(region.bounds.left),
                    this._todevY(region.bounds.top),
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
                throw new EMFJSError("Invalid brush style");
        }

        const id = Helper._makeUniqueId("p");
        const spat = this._svg.pattern(this._getSvgDef(), id, this.state.brx, this.state.bry, width, height,
            {patternUnits: "userSpaceOnUse"});
        this._svg.image(spat, 0, 0, width, height, img);
        this._svgPatterns[id] = brush;
        return id;
    }

    private _selectObject(obj: Obj) {
        this.state.selected[obj.type] = obj;
        switch (obj.type) {
            case "region":
                this.state._svgclipChanged = true;
                break;
            case "brush":
                this.state.brx = this.state.nextbrx;
                this.state.bry = this.state.nextbry;
                break;
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
                opts.stroke = "#" + pen.color.toHex(); // TODO: pen style
                opts["stroke-width"] = pen.width;

                opts["stroke-miterlimit"] = this.state.miterlimit;

                opts["stroke-linecap"] = "round";
                const dotWidth = 1;

                opts["stroke-linejoin"] = "round";

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
                        opts["stroke-dasharray"] =
                            [dashWidth, dotSpacing, dotWidth, dotSpacing, dotWidth, dotSpacing].toString();
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
            opts["font-size"] = Math.abs(font.height);
            opts.fill = "#" + this.state.textcolor.toHex();
        }
        return opts;
    }
}

// ===== emfjs/EMFRecords.ts =====
class EmfHeader {
    private size: number;
    private bounds: RectL;
    private frame: RectL;
    private nPalEntries: number;
    private refDevCx: number;
    private refDevCy: number;
    private refDevCxMm: number;
    private refDevCyMm: number;
    private description: string;
    private displayDevCxUm: number;
    private displayDevCyUm: number;

    constructor(reader: Blob, headerSize: number) {
        const recordStart = reader.pos - 8;

        this.size = headerSize;
        this.bounds = new RectL(reader);
        this.frame = new RectL(reader);
        if (reader.readUint32() !== Helper.GDI.FormatSignature.ENHMETA_SIGNATURE) {
            throw new EMFJSError("Invalid header signature");
        }
        reader.skip(4); // version
        reader.skip(4); // bytes (size of metafile)
        reader.skip(4); // number of records
        reader.skip(2); // number of handles
        reader.skip(2); // reserved
        const descriptionLen = reader.readUint32();
        const descriptionOff = reader.readUint32();
        this.nPalEntries = reader.readUint32();
        this.refDevCx = reader.readUint32();
        this.refDevCy = reader.readUint32();
        this.refDevCxMm = reader.readUint32();
        this.refDevCyMm = reader.readUint32();

        let hdrSize = headerSize;
        if (descriptionLen > 0) {
            if (descriptionOff < 88) {
                throw new EMFJSError("Invalid header description offset");
            }

            hdrSize = descriptionOff + (descriptionLen * 2);
            if (hdrSize > headerSize) {
                throw new EMFJSError("Invalid header description length");
            }

            const prevPos = reader.pos;
            reader.seek(recordStart + descriptionOff);
            this.description = reader.readFixedSizeUnicodeString(descriptionLen);
            reader.seek(prevPos);
        } else {
            this.description = "";
        }

        if (hdrSize >= 100) {
            // We have a EmfMetafileHeaderExtension1 record
            const pixelFormatSize = reader.readUint32();
            const pixelFormatOff = reader.readUint32();
            const haveOpenGl = reader.readUint32();
            if (haveOpenGl !== 0) {
                throw new EMFJSError("OpenGL records are not yet supported");
            }

            if (pixelFormatOff !== 0) {
                if (pixelFormatOff < 100 || pixelFormatOff < hdrSize) {
                    throw new EMFJSError("Invalid pixel format offset");
                }

                hdrSize = pixelFormatOff + pixelFormatSize;
                if (hdrSize > headerSize) {
                    throw new EMFJSError("Invalid pixel format size");
                }

                // TODO: read pixel format blob
            }

            if (hdrSize >= 108) {
                // We have a EmfMetafileHeaderExtension2 record
                this.displayDevCxUm = reader.readUint32(); // in micrometers
                this.displayDevCyUm = reader.readUint32(); // in micrometers
            }
        }
    }

    public toString(): string {
        return "{bounds: " + this.bounds.toString() + ", frame: " + this.frame.toString()
            + ", description: " + this.description + "}";
    }
}

class EMFRecords {
    private _records: ((gdi: GDIContext) => void)[];
    private _header: EmfHeader;

    constructor(reader: Blob, first: number) {
        this._records = [];

        this._header = new EmfHeader(reader, first);

        let all = false;
        let curpos = first;
        main_loop: while (!all) {
            reader.seek(curpos);
            const type = reader.readUint32();
            const size = reader.readUint32();
            if (size < 8) {
                throw new EMFJSError("Invalid record size");
            }
            switch (type) {
                case Helper.GDI.RecordType.EMR_EOF:
                    all = true;
                    break main_loop;
                case Helper.GDI.RecordType.EMR_SETMAPMODE: {
                    const mapMode = reader.readInt32();
                    this._records.push((gdi) => {
                        gdi.setMapMode(mapMode);
                    });
                    break;
                }
                case Helper.GDI.RecordType.EMR_SETWINDOWORGEX: {
                    const x = reader.readInt32();
                    const y = reader.readInt32();
                    this._records.push((gdi) => {
                        gdi.setWindowOrgEx(x, y);
                    });
                    break;
                }
                case Helper.GDI.RecordType.EMR_SETWINDOWEXTEX: {
                    const x = reader.readUint32();
                    const y = reader.readUint32();
                    this._records.push((gdi) => {
                        gdi.setWindowExtEx(x, y);
                    });
                    break;
                }
                case Helper.GDI.RecordType.EMR_SETVIEWPORTORGEX: {
                    const x = reader.readInt32();
                    const y = reader.readInt32();
                    this._records.push((gdi) => {
                        gdi.setViewportOrgEx(x, y);
                    });
                    break;
                }
                case Helper.GDI.RecordType.EMR_SETVIEWPORTEXTEX: {
                    const x = reader.readUint32();
                    const y = reader.readUint32();
                    this._records.push((gdi) => {
                        gdi.setViewportExtEx(x, y);
                    });
                    break;
                }
                case Helper.GDI.RecordType.EMR_SAVEDC: {
                    this._records.push((gdi) => {
                        gdi.saveDC();
                    });
                    break;
                }
                case Helper.GDI.RecordType.EMR_RESTOREDC: {
                    const saved = reader.readInt32();
                    this._records.push((gdi) => {
                        gdi.restoreDC(saved);
                    });
                    break;
                }
                case Helper.GDI.RecordType.EMR_SETBKMODE: {
                    const bkMode = reader.readUint32();
                    this._records.push((gdi) => {
                        gdi.setBkMode(bkMode);
                    });
                    break;
                }
                case Helper.GDI.RecordType.EMR_SETBKCOLOR: {
                    const bkColor = new ColorRef(reader);
                    this._records.push((gdi) => {
                        gdi.setBkColor(bkColor);
                    });
                    break;
                }
                case Helper.GDI.RecordType.EMR_CREATEBRUSHINDIRECT: {
                    const index = reader.readUint32();
                    const brush = new Brush(reader);
                    this._records.push((gdi) => {
                        gdi.createBrush(index, brush);
                    });
                    break;
                }
                case Helper.GDI.RecordType.EMR_CREATEPEN: {
                    const index = reader.readUint32();
                    const pen = new Pen(reader, null);
                    this._records.push((gdi) => {
                        gdi.createPen(index, pen);
                    });
                    break;
                }
                case Helper.GDI.RecordType.EMR_EXTCREATEPEN: {
                    const index = reader.readUint32();
                    const offBmi = reader.readUint32();
                    const cbBmi = reader.readUint32();
                    const offBits = reader.readUint32();
                    const cbBits = reader.readUint32();
                    const pen = new Pen(reader, {
                        header: {
                            off: offBmi,
                            size: cbBmi,
                        },
                        data: {
                            off: offBits,
                            size: cbBits,
                        },
                    });
                    this._records.push((gdi) => {
                        gdi.createPen(index, pen);
                    });
                    break;
                }
                case Helper.GDI.RecordType.EMR_SELECTOBJECT: {
                    const idx = reader.readUint32();
                    this._records.push((gdi) => {
                        gdi.selectObject(idx, null);
                    });
                    break;
                }
                case Helper.GDI.RecordType.EMR_DELETEOBJECT: {
                    const idx = reader.readUint32();
                    this._records.push((gdi) => {
                        gdi.deleteObject(idx);
                    });
                    break;
                }
                case Helper.GDI.RecordType.EMR_RECTANGLE: {
                    const rect = new RectL(reader);
                    this._records.push((gdi) => {
                        gdi.rectangle(rect, 0, 0);
                    });
                    break;
                }
                case Helper.GDI.RecordType.EMR_ROUNDRECT: {
                    const rect = new RectL(reader);
                    const corner = new SizeL(reader);
                    this._records.push((gdi) => {
                        gdi.rectangle(rect, corner.cx, corner.cy);
                    });
                    break;
                }
                case Helper.GDI.RecordType.EMR_LINETO: {
                    const x = reader.readInt32();
                    const y = reader.readInt32();
                    this._records.push((gdi) => {
                        gdi.lineTo(x, y);
                    });
                    break;
                }
                case Helper.GDI.RecordType.EMR_MOVETOEX: {
                    const x = reader.readInt32();
                    const y = reader.readInt32();
                    this._records.push((gdi) => {
                        gdi.moveToEx(x, y);
                    });
                    break;
                }
                case Helper.GDI.RecordType.EMR_POLYGON:
                case Helper.GDI.RecordType.EMR_POLYGON16: {
                    const isSmall = (type === Helper.GDI.RecordType.EMR_POLYGON16);
                    const bounds = new RectL(reader);
                    let cnt = reader.readUint32();
                    const points: PointS[] | PointL[] = [];
                    while (cnt > 0) {
                        points.push(isSmall ? new PointS(reader) : new PointL(reader));
                        cnt--;
                    }
                    this._records.push((gdi) => {
                        gdi.polygon(points, bounds, true);
                    });
                    break;
                }
                case Helper.GDI.RecordType.EMR_POLYPOLYGON:
                case Helper.GDI.RecordType.EMR_POLYPOLYGON16: {
                    const isSmall = (type === Helper.GDI.RecordType.EMR_POLYPOLYGON16);
                    const bounds = new RectL(reader);
                    const polyCnt = reader.readUint32();
                    reader.skip(4); // count
                    const polygonsPtCnts = [];
                    for (let i = 0; i < polyCnt; i++) {
                        polygonsPtCnts.push(reader.readUint32());
                    }

                    const polygons: PointS[][] | PointL[][] = [];
                    for (let i = 0; i < polyCnt; i++) {
                        const ptCnt = polygonsPtCnts[i];

                        const p = [];
                        for (let ip = 0; ip < ptCnt; ip++) {
                            p.push(isSmall ? new PointS(reader) : new PointL(reader));
                        }
                        polygons.push(p);
                    }
                    this._records.push((gdi) => {
                        gdi.polyPolygon(polygons, bounds);
                    });
                    break;
                }
                case Helper.GDI.RecordType.EMR_SETPOLYFILLMODE: {
                    const polyfillmode = reader.readUint32();
                    this._records.push((gdi) => {
                        gdi.setPolyFillMode(polyfillmode);
                    });
                    break;
                }
                case Helper.GDI.RecordType.EMR_POLYLINE16:
                case Helper.GDI.RecordType.EMR_POLYLINETO16: {
                    const isLineTo = (type === Helper.GDI.RecordType.EMR_POLYLINETO16);
                    const bounds = new RectL(reader);
                    let cnt = reader.readUint32();
                    const points: PointS[] = [];
                    while (cnt > 0) {
                        points.push(new PointS(reader));
                        cnt--;
                    }
                    this._records.push((gdi) => {
                        gdi.polyline(isLineTo, points, bounds);
                    });
                    break;
                }
                case Helper.GDI.RecordType.EMR_POLYBEZIER:
                case Helper.GDI.RecordType.EMR_POLYBEZIERTO: {
                    const isPolyBezierTo = (type === Helper.GDI.RecordType.EMR_POLYBEZIERTO);
                    const bounds = new RectL(reader);
                    let cnt = reader.readUint32();
                    const points: PointL[] = [];
                    while (cnt > 0) {
                        points.push(new PointL(reader));
                        cnt--;
                    }
                    this._records.push((gdi) => {
                        gdi.polybezier(isPolyBezierTo, points, bounds);
                    });
                    break;
                }
                case Helper.GDI.RecordType.EMR_POLYBEZIER16: {
                    const bounds = new RectL(reader);
                    const start = new PointL(reader);
                    let cnt = reader.readUint32();
                    const points = [start];
                    while (cnt > 0) {
                        points.push(new PointS(reader));
                        cnt--;
                    }
                    this._records.push((gdi) => {
                        gdi.polybezier(false, points, bounds);
                    });
                    break;
                }
                case Helper.GDI.RecordType.EMR_POLYBEZIERTO16: {
                    const bounds = new RectL(reader);
                    let cnt = reader.readUint32();
                    const points: PointS[] = [];
                    while (cnt > 0) {
                        points.push(new PointS(reader));
                        cnt--;
                    }
                    this._records.push((gdi) => {
                        gdi.polybezier(true, points, bounds);
                    });
                    break;
                }
                case Helper.GDI.RecordType.EMR_SETTEXTALIGN: {
                    const textAlign = reader.readUint32();
                    this._records.push((gdi) => {
                        gdi.setTextAlign(textAlign);
                    });
                    break;
                }
                case Helper.GDI.RecordType.EMR_SETSTRETCHBLTMODE: {
                    const stretchMode = reader.readUint32();
                    this._records.push((gdi) => {
                        gdi.setStretchBltMode(stretchMode);
                    });
                    break;
                }
                case Helper.GDI.RecordType.EMR_SETBRUSHORGEX: {
                    const origin = new PointL(reader);
                    this._records.push((gdi) => {
                        gdi.setBrushOrgEx(origin);
                    });
                    break;
                }
                case Helper.GDI.RecordType.EMR_BEGINPATH: {
                    this._records.push((gdi) => {
                        gdi.beginPath();
                    });
                    break;
                }
                case Helper.GDI.RecordType.EMR_ENDPATH: {
                    this._records.push((gdi) => {
                        gdi.endPath();
                    });
                    break;
                }
                case Helper.GDI.RecordType.EMR_ABORTPATH: {
                    this._records.push((gdi) => {
                        gdi.abortPath();
                    });
                    break;
                }
                case Helper.GDI.RecordType.EMR_CLOSEFIGURE: {
                    this._records.push((gdi) => {
                        gdi.closeFigure();
                    });
                    break;
                }
                case Helper.GDI.RecordType.EMR_FILLPATH: {
                    const bounds = new RectL(reader);
                    this._records.push((gdi) => {
                        gdi.fillPath(bounds);
                    });
                    break;
                }
                case Helper.GDI.RecordType.EMR_STROKEPATH: {
                    const bounds = new RectL(reader);
                    this._records.push((gdi) => {
                        gdi.strokePath(bounds);
                    });
                    break;
                }
                case Helper.GDI.RecordType.EMR_SELECTCLIPPATH: {
                    const rgnMode = reader.readUint32();
                    this._records.push((gdi) => {
                        gdi.selectClipPath(rgnMode);
                    });
                    break;
                }
                case Helper.GDI.RecordType.EMR_EXTSELECTCLIPRGN: {
                    reader.skip(4);
                    const rgnMode = reader.readUint32();
                    const region = rgnMode !== Helper.GDI.RegionMode.RGN_COPY ? new Region(reader) : null;
                    this._records.push((gdi) => {
                        gdi.selectClipRgn(rgnMode, region);
                    });
                    break;
                }
                case Helper.GDI.RecordType.EMR_OFFSETCLIPRGN: {
                    const offset = new PointL(reader);
                    this._records.push((gdi) => {
                        gdi.offsetClipRgn(offset);
                    });
                    break;
                }
                case Helper.GDI.RecordType.EMR_SETMITERLIMIT: {
                    const miterLimit = reader.readUint32();
                    this._records.push((gdi) => {
                        gdi.setMiterLimit(miterLimit);
                    });
                    break;
                }
                case Helper.GDI.RecordType.EMR_POLYLINE:
                case Helper.GDI.RecordType.EMR_POLYLINETO:
                case Helper.GDI.RecordType.EMR_POLYPOLYLINE:
                case Helper.GDI.RecordType.EMR_SETPIXELV:
                case Helper.GDI.RecordType.EMR_SETMAPPERFLAGS:
                case Helper.GDI.RecordType.EMR_SETROP2:
                case Helper.GDI.RecordType.EMR_SETCOLORADJUSTMENT:
                case Helper.GDI.RecordType.EMR_SETTEXTCOLOR:
                case Helper.GDI.RecordType.EMR_SETMETARGN:
                case Helper.GDI.RecordType.EMR_EXCLUDECLIPRECT:
                case Helper.GDI.RecordType.EMR_INTERSECTCLIPRECT:
                case Helper.GDI.RecordType.EMR_SCALEVIEWPORTEXTEX:
                case Helper.GDI.RecordType.EMR_SCALEWINDOWEXTEX:
                case Helper.GDI.RecordType.EMR_SETWORLDTRANSFORM:
                case Helper.GDI.RecordType.EMR_MODIFYWORLDTRANSFORM:
                case Helper.GDI.RecordType.EMR_ANGLEARC:
                case Helper.GDI.RecordType.EMR_ELLIPSE:
                case Helper.GDI.RecordType.EMR_ARC:
                case Helper.GDI.RecordType.EMR_CHORD:
                case Helper.GDI.RecordType.EMR_PIE:
                case Helper.GDI.RecordType.EMR_SELECTPALETTE:
                case Helper.GDI.RecordType.EMR_CREATEPALETTE:
                case Helper.GDI.RecordType.EMR_SETPALETTEENTRIES:
                case Helper.GDI.RecordType.EMR_RESIZEPALETTE:
                case Helper.GDI.RecordType.EMR_REALIZEPALETTE:
                case Helper.GDI.RecordType.EMR_EXTFLOODFILL:
                case Helper.GDI.RecordType.EMR_ARCTO:
                case Helper.GDI.RecordType.EMR_POLYDRAW:
                case Helper.GDI.RecordType.EMR_SETARCDIRECTION:
                case Helper.GDI.RecordType.EMR_STROKEANDFILLPATH:
                case Helper.GDI.RecordType.EMR_FLATTENPATH:
                case Helper.GDI.RecordType.EMR_WIDENPATH:
                case Helper.GDI.RecordType.EMR_COMMENT:
                case Helper.GDI.RecordType.EMR_FILLRGN:
                case Helper.GDI.RecordType.EMR_FRAMERGN:
                case Helper.GDI.RecordType.EMR_INVERTRGN:
                case Helper.GDI.RecordType.EMR_PAINTRGN:
                case Helper.GDI.RecordType.EMR_BITBLT:
                case Helper.GDI.RecordType.EMR_STRETCHBLT:
                case Helper.GDI.RecordType.EMR_MASKBLT:
                case Helper.GDI.RecordType.EMR_PLGBLT:
                case Helper.GDI.RecordType.EMR_SETDIBITSTODEVICE:
                case Helper.GDI.RecordType.EMR_STRETCHDIBITS:
                case Helper.GDI.RecordType.EMR_EXTCREATEFONTINDIRECTW:
                case Helper.GDI.RecordType.EMR_EXTTEXTOUTA:
                case Helper.GDI.RecordType.EMR_EXTTEXTOUTW:
                case Helper.GDI.RecordType.EMR_POLYPOLYLINE16:
                case Helper.GDI.RecordType.EMR_POLYDRAW16:
                case Helper.GDI.RecordType.EMR_CREATEMONOBRUSH:
                case Helper.GDI.RecordType.EMR_CREATEDIBPATTERNBRUSHPT:
                case Helper.GDI.RecordType.EMR_POLYTEXTOUTA:
                case Helper.GDI.RecordType.EMR_POLYTEXTOUTW:
                case Helper.GDI.RecordType.EMR_SETICMMODE:
                case Helper.GDI.RecordType.EMR_CREATECOLORSPACE:
                case Helper.GDI.RecordType.EMR_SETCOLORSPACE:
                case Helper.GDI.RecordType.EMR_DELETECOLORSPACE:
                case Helper.GDI.RecordType.EMR_GLSRECORD:
                case Helper.GDI.RecordType.EMR_GLSBOUNDEDRECORD:
                case Helper.GDI.RecordType.EMR_PIXELFORMAT:
                case Helper.GDI.RecordType.EMR_DRAWESCAPE:
                case Helper.GDI.RecordType.EMR_EXTESCAPE:
                case Helper.GDI.RecordType.EMR_SMALLTEXTOUT:
                case Helper.GDI.RecordType.EMR_FORCEUFIMAPPING:
                case Helper.GDI.RecordType.EMR_NAMEDESCAPE:
                case Helper.GDI.RecordType.EMR_COLORCORRECTPALETTE:
                case Helper.GDI.RecordType.EMR_SETICMPROFILEA:
                case Helper.GDI.RecordType.EMR_SETICMPROFILEW:
                case Helper.GDI.RecordType.EMR_ALPHABLEND:
                case Helper.GDI.RecordType.EMR_SETLAYOUT:
                case Helper.GDI.RecordType.EMR_TRANSPARENTBLT:
                case Helper.GDI.RecordType.EMR_GRADIENTFILL:
                case Helper.GDI.RecordType.EMR_SETLINKEDUFIS:
                case Helper.GDI.RecordType.EMR_SETTEXTJUSTIFICATION:
                case Helper.GDI.RecordType.EMR_COLORMATCHTOTARGETW:
                case Helper.GDI.RecordType.EMR_CREATECOLORSPACEW:
                default: {
                    let recordName = "UNKNOWN";
                    for (const name in Helper.GDI.RecordType) {
                        const recordTypes: any = Helper.GDI.RecordType;
                        if (recordTypes[name] === type) {
                            recordName = name;
                            break;
                        }
                    }
                    Helper.log("[EMF] " + recordName + " record (0x" + type.toString(16) + ") at offset 0x"
                        + curpos.toString(16) + " with " + size + " bytes");
                    break;
                }
            }

            curpos += size;
        }

        if (!all) {
            throw new EMFJSError("Could not read all records");
        }
    }

    public play(gdi: GDIContext): void {
        const len = this._records.length;
        for (let i = 0; i < len; i++) {
            this._records[i](gdi);
        }
    }
}

// ===== emfjs/Renderer.ts =====
interface IRendererSettings {
    width: string;
    height: string;
    wExt: number;
    hExt: number;
    xExt: number;
    yExt: number;
    mapMode: number;
}

class Renderer {
    private _img: EMF;

    constructor(blob: ArrayBuffer) {
        this.parse(blob);
        Helper.log("EMFJS.Renderer instantiated");
    }

    public render(info: IRendererSettings): SVGElement {
        const svgElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");

        this._render(
            new SVG(svgElement),
            info.mapMode,
            info.wExt,
            info.hExt,
            info.xExt,
            info.yExt);
        svgElement.setAttribute("viewBox", [0, 0, info.xExt, info.yExt].join(" "));
        svgElement.setAttribute("preserveAspectRatio", "none"); // TODO: MM_ISOTROPIC vs MM_ANISOTROPIC
        svgElement.setAttribute("width", info.width);
        svgElement.setAttribute("height", info.height);
        return svgElement;
    }

    private parse(blob: ArrayBuffer) {
        this._img = null;

        const reader = new Blob(blob);

        const type = reader.readUint32();
        if (type !== 0x00000001) {
            throw new EMFJSError("Not an EMF file");
        }
        const size = reader.readUint32();
        if (size % 4 !== 0) {
            throw new EMFJSError("Not an EMF file");
        }

        this._img = new EMF(reader, size);

        if (this._img == null) {
            throw new EMFJSError("Format not recognized");
        }
    }

    private _render(svg: SVG, mapMode: number, w: number, h: number, xExt: number, yExt: number) {
        const gdi = new GDIContext(svg);
        gdi.setWindowExtEx(w, h);
        gdi.setViewportExtEx(xExt, yExt);
        gdi.setMapMode(mapMode);
        Helper.log("[EMF] BEGIN RENDERING --->");
        this._img.render(gdi);
        Helper.log("[EMF] <--- DONE RENDERING");
    }
}

class EMF {
    private _hdrsize: number;
    private _records: EMFRecords;

    constructor(reader: Blob, hdrsize: number) {
        this._hdrsize = hdrsize;
        this._records = new EMFRecords(reader, this._hdrsize);
    }

    public render(gdi: GDIContext): void {
        this._records.play(gdi);
    }
}

export { Renderer, EMFJSError as Error, loggingEnabled };
