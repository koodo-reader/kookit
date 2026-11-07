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
import * as EMFJS from "./emf";
import * as WMFJS from "./wmf";

// codepage 码表（js-codepage 全集约 2MB）在此替换为基于浏览器内置
// TextDecoder 的惰性实现：按 WHATWG 编码标签解码 gbk/big5/shift_jis/
// iso-8859 等常用编码，未知或不支持的编码回退到 windows-1252，
// TextDecoder 不可用时回退到 latin1，避免 rtf.js 解码 \'xx 转义时崩溃
const RTF_CODEPAGE_LABELS: { [key: number]: string } = {
  866: "ibm866",
  874: "windows-874",
  932: "shift_jis",
  936: "gbk",
  949: "euc-kr",
  950: "big5",
  1250: "windows-1250",
  1251: "windows-1251",
  1252: "windows-1252",
  1253: "windows-1253",
  1254: "windows-1254",
  1255: "windows-1255",
  1256: "windows-1256",
  1257: "windows-1257",
  1258: "windows-1258",
  10000: "macintosh",
  10007: "x-mac-cyrillic",
  28591: "iso-8859-1",
  28592: "iso-8859-2",
  28593: "iso-8859-3",
  28594: "iso-8859-4",
  28595: "iso-8859-5",
  28596: "iso-8859-6",
  28597: "iso-8859-7",
  28598: "iso-8859-8",
  28599: "iso-8859-9",
  28600: "iso-8859-10",
  28603: "iso-8859-13",
  28604: "iso-8859-14",
  28605: "iso-8859-15",
  28606: "iso-8859-16",
  50220: "iso-2022-jp",
  50221: "iso-2022-jp",
  50222: "iso-2022-jp",
  50225: "iso-2022-kr",
  51932: "euc-jp",
  51936: "gbk",
  51949: "euc-kr",
  54936: "gb18030",
  65001: "utf-8",
};
const makeCodepageTable = (codepage: number) => {
  let decoder: TextDecoder | null = null;
  if (typeof TextDecoder !== "undefined") {
    try {
      decoder = new TextDecoder(RTF_CODEPAGE_LABELS[codepage] || "windows-1252");
    } catch (error) {
      decoder = null;
    }
  }
  const cache: { [key: string]: string | undefined } = {};
  const decode = (code: number): string | undefined => {
    if (decoder) {
      const bytes = code < 256 ? [code] : [(code >> 8) & 255, code & 255];
      let text = "";
      try {
        text = decoder.decode(new Uint8Array(bytes));
      } catch (error) {}
      return text === "" || text === "\uFFFD" ? undefined : text;
    }
    return code < 256 ? String.fromCharCode(code) : undefined;
  };
  return {
    dec: new Proxy({} as { [key: string]: string | undefined }, {
      get(target, prop) {
        if (typeof prop !== "string" || !/^[0-9]+$/.test(prop)) {
          return (target as any)[prop];
        }
        if (Object.prototype.hasOwnProperty.call(cache, prop)) {
          return cache[prop];
        }
        const value = decode(parseInt(prop, 10));
        cache[prop] = value;
        return value;
      },
    }),
  };
};
const cptable: any = new Proxy(
  { version: "1.15.0" },
  {
    get(target, prop) {
      if (
        typeof prop === "string" &&
        /^[0-9]+$/.test(prop) &&
        target[prop] === undefined
      ) {
        target[prop] = makeCodepageTable(parseInt(prop, 10));
      }
      return (target as any)[prop];
    },
  }
);
cptable[1252] = makeCodepageTable(1252);

// ===== rtfjs/Helper.ts =====
class RTFJSError extends Error {
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
    public static JUSTIFICATION = {
        LEFT: "left",
        CENTER: "center",
        RIGHT: "right",
        JUSTIFY: "justify",
    };
    public static BREAKTYPE = {
        NONE: "none",
        COL: "col", // TODO: ???
        EVEN: "even",
        ODD: "odd",
        PAGE: "page",
    };
    public static PAGENUMBER = {
        DECIMAL: "decimal",
        UROM: "urom", // TODO: ???
        LROM: "lrom", // TODO: ???
        ULTR: "ultr", // TODO: ???
        LLTR: "lltr", // TODO: ???
    };
    public static UNDERLINE = {
        NONE: "none",
        CONTINUOUS: "continuous",
        DOTTED: "dotted",
        DASHED: "dashed",
        DASHDOTTED: "dashdotted",
        DASHDOTDOTTED: " dashdotdotted",
        DOUBLE: "double",
        HEAVYWAVE: "heavywave",
        LONGDASHED: "longdashed",
        THICK: "thick",
        THICKDOTTED: "thickdotted",
        THICKDASHED: "thickdashed",
        THICKDASHDOTTED: "thickdashdotted",
        THICKDASHDOTDOTTED: "thickdashdotdotted",
        THICKLONGDASH: "thicklongdash",
        DOUBLEWAVE: "doublewave",
        WORD: "word",
        WAVE: "wave",
    };
    public static FONTPITCH = {
        DEFAULT: 0,
        FIXED: 1,
        VARIABLE: 2,
    };
    public static CHARACTER_TYPE = {
        LOWANSI: "loch",
        HIGHANSI: "hich",
        DOUBLE: "dbch",
    };
    public static SUPERSUBSCRIPT = {
        SUPERSCRIPT: 1,
        NONE: 0,
        SUBSCRIPT: -1,
    };

    public static log(message: string): void {
        if (isLoggingEnabled) {
            console.log(message);
        }
    }

    public static _isalpha(str: string): boolean {
        const len = str.length;
        for (let i = 0; i < len; i++) {
            const ch = str.charCodeAt(i);
            if (!((ch >= this._A && ch <= this._Z) ||
                (ch >= this._a && ch <= this._z))) {
                return false;
            }
        }
        return len > 0;
    }

    public static _isdigit(str: string): boolean {
        const len = str.length;
        for (let i = 0; i < len; i++) {
            const ch = str.charCodeAt(i);
            if (ch < this._0 || ch > this._9) {
                return false;
            }
        }
        return len > 0;
    }

    public static _parseHex(str: string): number {
        const len = str.length;
        for (let i = 0; i < len; i++) {
            const ch = str.charCodeAt(i);
            if (!((ch >= this._0 && ch <= this._9) ||
                (ch >= this._a && ch <= this._f) ||
                (ch >= this._A && ch <= this._F))) {
                return NaN;
            }
        }
        if (len > 0) {
            return parseInt(str, 16);
        }
        return NaN;
    }

    public static _blobToBinary(blob: ArrayBuffer): string {
        const view = new Uint8Array(blob);
        let ret = "";
        const len = view.length;
        for (let i = 0; i < len; i++) {
            ret += String.fromCharCode(view[i]);
        }
        return ret;
    }

    public static _hexToBlob(str: string): ArrayBuffer {
        let len = str.length;
        const buf = new ArrayBuffer(Math.floor(len-- / 2));
        const view = new Uint8Array(buf);
        let d = 0;
        for (let i = 0; i < len; i += 2) {
            const val = this._parseHex(str.substr(i, 2));
            if (isNaN(val)) {
                return null;
            }
            view[d++] = val;
        }
        return buf;
    }

    public static _hexToBinary(str: string): string {
        let bin = "";
        const len = str.length - 1;
        for (let i = 0; i < len; i += 2) {
            const val = this._parseHex(str.substr(i, 2));
            if (isNaN(val)) {
                return null;
            }
            bin += String.fromCharCode(val);
        }
        return bin;
    }

    public static _mapCharset(idx: number): number {
        return this._charsetMap[idx.toString()];
    }

    public static _mapColorTheme(name: string): null {
        return this._colorThemeMap[name];
    }

    public static _colorToStr(color: IColor): string {
        return "rgb(" + color.r + "," + color.g + "," + color.b + ")";
    }

    public static _twipsToPt(twips: number): number {
        return Math.floor(twips / 20);
    }

    public static _twipsToPx(twips: number): number {
        return Math.floor(twips / 20 * 96 / 72);
    }

    public static _pxToTwips(px: number): number {
        return Math.floor(px * 20 * 72 / 96);
    }

    private static _A = "A".charCodeAt(0);
    private static _a = "a".charCodeAt(0);
    private static _F = "F".charCodeAt(0);
    private static _f = "f".charCodeAt(0);
    private static _Z = "Z".charCodeAt(0);
    private static _z = "z".charCodeAt(0);
    private static _0 = "0".charCodeAt(0);
    private static _9 = "9".charCodeAt(0);

    private static _charsetMap: { [key: string]: number } = {
        0: 1252,  // ANSI_CHARSET
        2: 42,    // Symbol (this is not a real charset, CP_SYMBOL maps unicode characters into a different range)
        77: 10000, // Mac Roman
        78: 10001, // Mac Shift Jis
        79: 10003, // Mac Hangul
        80: 10008, // Mac GB2312
        81: 10002, // Mac Big5
        83: 10005, // Mac Hebrew
        84: 10004, // Mac Arabic
        85: 10006, // Mac Greek
        86: 10081, // Mac Turkish
        87: 10021, // Mac Thai
        88: 10029, // Mac East Europe
        89: 10007, // Mac Russian
        128: 932,   // SHIFTJIS_CHARSET
        129: 949,   // HANGEUL_CHARSET
        130: 1361,  // JOHAB_CHARSET
        134: 936,   // GB2313_CHARSET
        136: 950,   // CHINESEBIG5_CHARSET
        161: 1253,  // GREEK_CHARSET
        162: 1254,  // TURKISH_CHARSET
        163: 1258,  // VIETNAMESE_CHARSET
        177: 1255,  // HEBREW_CHARSET
        178: 1256,  // ARABIC_CHARSET
        186: 1257,  // BALTIC_CHARSET
        204: 1251,  // RUSSIAN_CHARSET
        222: 874,   // THAI_CHARSET
        238: 1250,  // EE_CHARSET (Eastern European)
        254: 437,   // PC 437
        255: 850,   // OEM
    };

    private static _colorThemeMap: { [key: string]: null } = {
        // TODO
        maindarkone: null,
        mainlightone: null,
        maindarktwo: null,
        mainlighttwo: null,
        accentone: null,
        accenttwo: null,
        accentthree: null,
        accentfour: null,
        accentfive: null,
        accentsix: null,
        hyperlink: null,
        followedhyperlink: null,
        backgroundone: null,
        textone: null,
        backgroundtwo: null,
        texttwo: null,
    };
}

// ===== rtfjs/Document.ts =====
class Document {
    public _settings: ISettings;
    public _meta: { [key: string]: any };
    public _fonts: FonttblDestinationSub[];
    public _colors: IColor[];
    public _autoColor: number;
    public _stylesheets: { index: number, name: string }[];
    public _ins: (string | ((renderer: Renderer) => void))[];

    constructor(settings: ISettings) {
        this._settings = settings || {};
        this._meta = {};
        this._fonts = [];
        this._colors = [];
        this._autoColor = null;
        this._stylesheets = [];
        this._ins = [];
    }

    public _lookupColor(idx: number): null | IColor {
        if (idx === 0) {
            if (this._autoColor == null) {
                return null;
            }
            return this._colors[this._autoColor];
        }
        if (idx < 0 || idx >= this._colors.length) {
            throw new RTFJSError("Invalid color index");
        }
        return this._colors[idx];
    }

    public addIns(ins: string | ((renderer: Renderer) => void)): void {
        this._ins.push(ins);
    }

}

// ===== rtfjs/renderer/RenderChp.ts =====
class RenderChp {
    public _chp: Chp;

    constructor(chp: Chp) {
        this._chp = chp;
    }

    public apply(doc: Document, el: HTMLElement): void {
        Helper.log("[rtf] RenderChp: " + el.textContent);
        Helper.log("[rtf] RenderChp apply: " + JSON.stringify(this._chp));
        if (this._chp.bold) {
            el.style.fontWeight = "bold";
        }
        if (this._chp.italic) {
            el.style.fontStyle = "italic";
        }
        if (Object.prototype.hasOwnProperty.call(this._chp, "fontfamily") && doc._fonts[this._chp.fontfamily]) {
            const fontFamily = doc._fonts[this._chp.fontfamily].fontname.replace(";", "");
            if (fontFamily !== "Symbol") {
                el.style.fontFamily = fontFamily;
            }
        }

        const deco = [];
        if (this._chp.underline !== Helper.UNDERLINE.NONE) {
            deco.push("underline");
        }
        if (this._chp.strikethrough || this._chp.dblstrikethrough) {
            deco.push("line-through");
        }

        if (deco.length > 0) {
            el.style.textDecoration = deco.join(" ");
        }
        if (this._chp.colorindex !== 0) {
            const color = doc._lookupColor(this._chp.colorindex);
            if (color != null) {
                el.style.color = Helper._colorToStr(color);
            }
        }
        if (this._chp.highlightindex !== 0) {
            const color = doc._lookupColor(this._chp.highlightindex);
            if (color != null) {
                el.style.backgroundColor = Helper._colorToStr(color);
            }
        }
        el.style.fontSize = Math.floor(this._chp.fontsize / 2) + "pt";

        if (this._chp.supersubscript === Helper.SUPERSUBSCRIPT.SUPERSCRIPT) {
            el.style.verticalAlign = "super"
        } else if (this._chp.supersubscript === Helper.SUPERSUBSCRIPT.SUBSCRIPT) {
            el.style.verticalAlign = "sub"
        }

        if (this._chp.supersubscript === Helper.SUPERSUBSCRIPT.SUPERSCRIPT || this._chp.supersubscript === Helper.SUPERSUBSCRIPT.SUBSCRIPT) {
            el.style.fontSize = Math.floor((this._chp.fontsize / 2) - 2) + "pt"
        }
    }
}

// ===== rtfjs/renderer/RenderPap.ts =====
class RenderPap {
    private _pap: Pap;

    constructor(pap: Pap) {
        this._pap = pap;
    }

    public apply(doc: Document, el: HTMLElement, rchp: RenderChp, ismaindiv: boolean): void {
        Helper.log("[rtf] RenderPap apply:" + (rchp != null ? " chp=" + JSON.stringify(rchp._chp) : "")
            + " pap=" + JSON.stringify(this._pap) + " ismaindiv=" + ismaindiv);
        if (ismaindiv) {
            if (this._pap.spacebefore !== 0) {
                el.style.marginTop = Helper._twipsToPt(this._pap.spacebefore) + "pt";
            } else {
                el.style.marginTop = "";
            }
            if (this._pap.spaceafter !== 0) {
                el.style.marginBottom = Helper._twipsToPt(this._pap.spaceafter) + "pt";
            } else {
                el.style.marginBottom = "";
            }
            if (rchp != null) {
                el.style.minHeight = Math.floor(rchp._chp.fontsize / 2) + "pt";
            }
        } else {
            switch (this._pap.justification) {
                case Helper.JUSTIFICATION.LEFT:
                    el.style.textAlign = "left";
                    break;
                case Helper.JUSTIFICATION.RIGHT:
                    el.style.textAlign = "right";
                    break;
                case Helper.JUSTIFICATION.CENTER:
                    el.style.textAlign = "center";
                    break;
                case Helper.JUSTIFICATION.JUSTIFY:
                    el.style.textAlign = "justify";
                    break;
            }
        }
    }
}

// ===== rtfjs/renderer/Renderer.ts =====
interface IContainerElement {
    element: HTMLElement;
    content: HTMLElement;
}

class Renderer {
    public _doc: Document;
    private _dom: HTMLElement[];

    private _curRChp: RenderChp;
    private _curRPap: RenderPap;
    private _curpar: HTMLElement;
    private _cursubpar: HTMLElement;
    private _curcont: IContainerElement[];

    constructor(doc: Document) {
        this._doc = doc;
        this._dom = null;

        this._curRChp = null;
        this._curRPap = null;
        this._curpar = null;
        this._cursubpar = null;
        this._curcont = [];
    }

    public pushContainer(contel: IContainerElement): void {
        if (this._curpar == null) {
            this.startPar();
        }

        const len = this._curcont.push(contel);
        if (len > 1) {
            const prevcontel = this._curcont[len - 1];
            prevcontel.content.append(contel.element);
        } else {
            if (this._cursubpar != null) {
                this._cursubpar.append(contel.element);
            } else {
                this._curpar.append(contel.element);
            }
        }
    }

    public popContainer(): void {
        const contel = this._curcont.pop();
        if (contel == null) {
            throw new RTFJSError("No container on rendering stack");
        }
    }

    public buildHyperlinkElement(url: string): HTMLElement {
        const link: HTMLAnchorElement = document.createElement("a");
        link.href = url;
        return link;
    }

    public _appendToPar(el: HTMLElement, newsubpar?: boolean): void {
        if (this._curpar == null) {
            this.startPar();
        }
        if (newsubpar === true) {
            let subpar: HTMLDivElement = document.createElement("div");
            if (this._cursubpar == null) {
                subpar.append(...Array.from(this._curpar.childNodes));
                this._curpar.append(subpar);
                subpar = document.createElement("div");
            }
            if (el) {
                subpar.append(el);
            }
            if (this._curRPap != null) {
                this._curRPap.apply(this._doc, subpar, this._curRChp, false);
            }

            this._cursubpar = subpar;
            this._curpar.append(subpar);
        } else if (el) {
            const contelCnt = this._curcont.length;
            if (contelCnt > 0) {
                this._curcont[contelCnt - 1].content.append(el);
            } else if (this._cursubpar != null) {
                this._cursubpar.append(el);
            } else {
                this._curpar.append(el);
            }
        }
    }

    public startPar(): void {
        this._curpar = document.createElement("div");
        if (this._curRPap != null) {
            this._curRPap.apply(this._doc, this._curpar, this._curRChp, true);
            this._curRPap.apply(this._doc, this._curpar, this._curRChp, false);
        }
        this._cursubpar = null;
        this._curcont = [];
        this._dom.push(this._curpar);
    }

    public lineBreak(): void {
        this._appendToPar(null, true);
    }

    public setChp(rchp: RenderChp): void {
        this._curRChp = rchp;
    }

    public setPap(rpap: RenderPap): void {
        this._curRPap = rpap;
        if (this._cursubpar != null) {
            this._curRPap.apply(this._doc, this._cursubpar, null, false);
        } else if (this._curpar != null) {
            // Don't have a sub-paragraph at all, apply everything
            this._curRPap.apply(this._doc, this._curpar, null, true);
            this._curRPap.apply(this._doc, this._curpar, null, false);
        }
    }

    public appendElement(element: HTMLElement): void {
        this._appendToPar(element);
    }

    public buildRenderedPicture(element: HTMLElement): HTMLElement {
        if (element == null) {
            element = document.createElement("span");
            element.textContent = "[failed to render image]";
        }
        return element;
    }

    public renderedPicture(element: HTMLElement): void {
        this._appendToPar(this.buildRenderedPicture(element));
    }

    public buildPicture(mime: string, data: string): HTMLElement {
        if (data != null) {
            const image: HTMLImageElement = document.createElement("img");
            image.src = "data:" + mime + ";base64," + btoa(data);
            return image;
        } else {
            let err = "image type not supported";
            if (typeof mime === "string" && mime !== "") {
                err = mime;
            }
            const span: HTMLSpanElement = document.createElement("span");
            span.textContent = "[" + err + "]";
            return span;
        }
    }

    public picture(mime: string, data: string): void {
        this._appendToPar(this.buildPicture(mime, data));
    }

    public buildDom(): HTMLElement[] {
        if (this._dom != null) {
            return this._dom;
        }

        this._dom = [];

        this._curRChp = null;
        this._curRPap = null;
        this._curpar = null;

        const len = this._doc._ins.length;
        for (let i = 0; i < len; i++) {
            const ins = this._doc._ins[i];
            if (typeof ins === "string") {
                const span: HTMLSpanElement = document.createElement("span");
                span.textContent = ins;
                if (this._curRChp != null) {
                    this._curRChp.apply(this._doc, span);
                }
                this._appendToPar(span);
            } else {
                ins(this);
            }
        }
        return this._dom;
    }
}

// ===== rtfjs/parser/Containers.ts =====
class Chp {
    public bold: boolean;
    public underline: string;
    public italic: boolean;
    public strikethrough: boolean;
    public dblstrikethrough: boolean;
    public colorindex: number;
    public highlightindex: number;
    public fontsize: number;
    public fontfamily: number;
    public supersubscript: number;

    constructor(parent: Chp) {
        if (parent != null) {
            this.bold = parent.bold;
            this.underline = parent.underline;
            this.italic = parent.italic;
            this.strikethrough = parent.strikethrough;
            this.dblstrikethrough = parent.dblstrikethrough;
            this.colorindex = parent.colorindex;
            this.highlightindex = parent.highlightindex;
            this.fontsize = parent.fontsize;
            this.fontfamily = parent.fontfamily;
            this.supersubscript = parent.supersubscript;
        } else {
            this.bold = false;
            this.underline = Helper.UNDERLINE.NONE;
            this.italic = false;
            this.strikethrough = false;
            this.dblstrikethrough = false;
            this.colorindex = 0;
            this.highlightindex = 0;
            this.fontsize = 24;
            this.supersubscript = Helper.SUPERSUBSCRIPT.NONE;
        }
    }
}

class Pap {
    public indent: { left: number, right: number, firstline: number };
    public justification: string;
    public spacebefore: number;
    public spaceafter: number;
    public charactertype: string | null;

    constructor(parent: Pap) {
        if (parent != null) {
            this.indent = {
                left: parent.indent.left,
                right: parent.indent.right,
                firstline: parent.indent.firstline,
            };
            this.justification = parent.justification;
            this.spacebefore = parent.spacebefore;
            this.spaceafter = parent.spaceafter;
            this.charactertype = parent.charactertype;
        } else {
            this.indent = {
                left: 0,
                right: 0,
                firstline: 0,
            };
            this.justification = Helper.JUSTIFICATION.LEFT;
            this.spacebefore = 0;
            this.spaceafter = 0;
            this.charactertype = null;
        }
    }
}

class Sep {
    public columns: number;
    public breaktype: string;
    public pagenumber: { x: number, y: number };
    public pagenumberformat: string;

    constructor(parent: Sep) {
        if (parent != null) {
            this.columns = parent.columns;
            this.breaktype = parent.breaktype;
            this.pagenumber = {
                x: parent.pagenumber.x,
                y: parent.pagenumber.y,
            };
            this.pagenumberformat = parent.pagenumberformat;
        } else {
            this.columns = 0;
            this.breaktype = Helper.BREAKTYPE.NONE;
            this.pagenumber = {
                x: 0,
                y: 0,
            };
            this.pagenumberformat = Helper.PAGENUMBER.DECIMAL;
        }
    }
}

class Dop {
    public width: number;
    public height: number;
    public margin: { left: number, top: number, right: number, bottom: number };
    public pagenumberstart: number;
    public facingpages: boolean;
    public landscape: boolean;

    constructor(parent: Dop) {
        if (parent != null) {
            this.width = parent.width;
            this.height = parent.height;
            this.margin = {
                left: parent.margin.left,
                top: parent.margin.top,
                right: parent.margin.right,
                bottom: parent.margin.bottom,
            };
            this.pagenumberstart = parent.pagenumberstart;
            this.facingpages = parent.facingpages;
            this.landscape = parent.landscape;
        } else {
            this.width = 0;
            this.height = 0;
            this.margin = {
                left: 0,
                top: 0,
                right: 0,
                bottom: 0,
            };
            this.pagenumberstart = 0;
            this.facingpages = false;
            this.landscape = false;
        }
    }
}

class State {
    public parent: State;
    public first: boolean;
    public skipchars: number;
    public bindata: number;
    public chp: Chp;
    public pap: Pap;
    public sep: Sep;
    public dop: Dop;
    public destination: IDestination;
    public skipunknowndestination: boolean;
    public skipdestination: boolean;
    public ucn: number;

    [key: string]: any;

    constructor(parent: State) {
        this.parent = parent;
        this.first = true;
        this.skipchars = 0;
        this.bindata = 0;
        if (parent != null) {
            this.chp = new Chp(parent.chp);
            this.pap = new Pap(parent.pap);
            this.sep = new Sep(parent.sep);
            this.dop = new Dop(parent.dop);
            this.destination = parent.destination;
            this.skipunknowndestination = parent.skipunknowndestination;
            this.skipdestination = parent.skipdestination;
            this.ucn = parent.ucn;
        } else {
            this.chp = new Chp(null);
            this.pap = new Pap(null);
            this.sep = new Sep(null);
            this.dop = new Dop(null);
            this.destination = null;
            this.skipunknowndestination = false;
            this.skipdestination = false;
            this.ucn = 1;
        }
    }
}

class GlobalState {
    public data: Uint8Array;
    public pos: number;
    public line: number;
    public column: number;
    public state: State;
    public version: number;
    public text: (PlainText | HexText)[];
    public codepage: number;
    public _asyncTasks: Promise<any>[];
    public renderer: Renderer;

    constructor(blob: ArrayBuffer, renderer: Renderer) {
        this.data = new Uint8Array(blob);
        this.pos = 0;
        this.line = 1;
        this.column = 0;
        this.state = null;
        this.version = null;
        this.text = [];
        this.codepage = 1252;
        this._asyncTasks = [];
        this.renderer = renderer;
    }
}

class PlainText {
    constructor(public text: string) {
    }
}

class HexText {
    constructor(public hex: number, public chp: Chp) {
    }
}

// ===== rtfjs/parser/destinations/DestinationBase.ts =====
abstract class DestinationFactory<T extends IDestination> {
    public class: new (parser: GlobalState, inst: Document, name: string, param: number) => T;

    public newDestination(parser: GlobalState, inst: Document, name: string, param: number): T {
        return new this.class(parser, inst, name, param);
    }
}

interface IDestination {
    _name: string;

    setMetadata?(metaprop: string, metavalue: any): void;

    apply?(): void;

    appendText?(text: string): void;

    sub?(): IDestination;

    handleKeyword?(keyword: string, param: number): void | boolean;

    handleBlob?(blob: ArrayBuffer): void;

    [key: string]: any;
}

const findParentDestination = (parser: GlobalState, dest: string) => {
    let state = parser.state;
    while (state != null) {
        if (state.destination == null) {
            break;
        }
        if (state.destination._name === dest) {
            return state.destination;
        }
        state = state.parent;
    }
    Helper.log("findParentDestination() did not find destination " + dest);
};

class DestinationBase implements IDestination {
    public _name: string;

    constructor(name: string) {
        this._name = name;
    }
}

class DestinationTextBase implements IDestination {
    public _name: string;
    public text: string;

    constructor(name: string) {
        this._name = name;
        this.text = "";
    }

    public appendText(text: string): void {
        this.text += text;
    }
}

abstract class DestinationFormattedTextBase implements IDestination {
    public _name: string;
    protected parser: GlobalState;
    private _records: ((rtf: RtfDestination) => void)[];

    constructor(parser: GlobalState, name: string) {
        this.parser = parser;
        this._name = name;
        this._records = [];
    }

    public appendText(text: string): void {
        this._records.push((rtf: RtfDestination) => {
            rtf.appendText(text);
        });
    }

    public handleKeyword(keyword: string, param: number): void {
        this._records.push((rtf: RtfDestination) => {
            return rtf.handleKeyword(keyword, param);
        });
    }

    public apply(): void {
        const rtf = findParentDestination(this.parser, "rtf") as any as RtfDestination;
        if (rtf == null) {
            throw new RTFJSError("IDestination " + this._name + " is not child of rtf destination");
        }

        const len = this._records.length;
        let doRender = true;
        if (this.renderBegin != null) {
            doRender = this.renderBegin(rtf, len);
        }

        if (doRender) {
            for (let i = 0; i < len; i++) {
                this._records[i](rtf);
            }
            if (this.renderEnd != null) {
                this.renderEnd(rtf, len);
            }
        }
        delete this._records;
    }

    public abstract renderBegin(rtf: RtfDestination, records: number): boolean;

    public abstract renderEnd(rtf: RtfDestination, records: number): void;
}

interface IGenericPropertyDestination extends IDestination {
    apply(): void;
}

class GenericPropertyDestinationFactory extends DestinationFactory<IGenericPropertyDestination> {
    constructor(parentdest: string, metaprop: string) {
        super();
        this.class = class extends DestinationTextBase implements IGenericPropertyDestination {
            private parser: GlobalState;

            constructor(parser: GlobalState, inst: Document, name: string) {
                super(name);
                this.parser = parser;
            }

            public apply() {
                const dest = findParentDestination(this.parser, parentdest);
                if (dest == null) {
                    throw new RTFJSError("IDestination " + this._name + " must be within "
                        + parentdest + " destination");
                }
                if (dest.setMetadata == null) {
                    throw new RTFJSError("IDestination " + parentdest + " does not accept meta data");
                }
                dest.setMetadata(metaprop, this.text);
            }
        };
    }
}

interface IGenericSubTextPropertyDestination extends IDestination {
    apply(): void;
}

class GenericSubTextPropertyDestinationFactory extends DestinationFactory<IGenericSubTextPropertyDestination> {
    constructor(name: string, parentDest: string, propOrFunc: string) {
        super();
        this.class = class extends DestinationTextBase implements IGenericSubTextPropertyDestination {
            private parser: GlobalState;

            constructor(parser: GlobalState) {
                super(name);
                this.parser = parser;
            }

            public apply() {
                const dest = findParentDestination(this.parser, parentDest);
                if (dest == null) {
                    throw new RTFJSError(this._name + " destination must be child of " + parentDest + " destination");
                }
                if (dest[propOrFunc] == null) {
                    throw new RTFJSError(this._name + " destination cannot find member + " + propOrFunc
                        + " in " + parentDest + " destination");
                }
                if (dest[propOrFunc] instanceof Function) {
                    dest[propOrFunc](this.text);
                } else {
                    dest[propOrFunc] = this.text;
                }
            }
        };
    }
}

class RequiredDestinationFactory extends DestinationFactory<IDestination> {
    constructor(name: string) {
        super();
        this.class = class extends DestinationBase implements IDestination {
            constructor() {
                super(name);
            }
        };
    }
}

// ===== rtfjs/parser/destinations/RtfDestination.ts =====
class RtfDestination extends DestinationBase {
    private _metadata: { [key: string]: any };
    private parser: GlobalState;
    private inst: Document;
    private _charFormatHandlers: { [key: string]: (param: number) => void } = {
        ansicpg: (param: number) => {
            // if the value is 0, use the default charset as 0 is not valid
            if (param > 0) {
                Helper.log("[rtf] using charset: " + param);
                this.parser.codepage = param;
            }
        },
        sectd: () => {
            Helper.log("[rtf] reset to section defaults");
            this.parser.state.sep = new Sep(null);
        },
        plain: () => {
            Helper.log("[rtf] reset to character defaults");
            this.parser.state.chp = new Chp(null);
        },
        pard: () => {
            Helper.log("[rtf] reset to paragraph defaults");
            this.parser.state.pap = new Pap(null);
        },
        b: this._genericFormatOnOff("chp", "bold"),
        i: this._genericFormatOnOff("chp", "italic"),
        sub: this._genericFormatSetVal("chp", "supersubscript", Helper.SUPERSUBSCRIPT.SUBSCRIPT),
        super: this._genericFormatSetVal("chp", "supersubscript", Helper.SUPERSUBSCRIPT.SUPERSCRIPT),
        nosupersub: this._genericFormatSetVal("chp", "supersubscript", Helper.SUPERSUBSCRIPT.NONE),
        cf: this._genericFormatSetValRequired("chp", "colorindex"),
        highlight: this._genericFormatSetValRequired("chp", "highlightindex"),
        fs: this._genericFormatSetValRequired("chp", "fontsize"),
        f: this._genericFormatSetValRequired("chp", "fontfamily"),
        loch: this._genericFormatSetNoParam("pap", "charactertype", Helper.CHARACTER_TYPE.LOWANSI),
        hich: this._genericFormatSetNoParam("pap", "charactertype", Helper.CHARACTER_TYPE.HIGHANSI),
        dbch: this._genericFormatSetNoParam("pap", "charactertype", Helper.CHARACTER_TYPE.DOUBLE),
        strike: this._genericFormatOnOff("chp", "strikethrough"),
        striked: this._genericFormatOnOff("chp", "dblstrikethrough"),
        ul: this._genericFormatOnOff("chp", "underline", Helper.UNDERLINE.CONTINUOUS, Helper.UNDERLINE.NONE),
        uld: this._genericFormatOnOff("chp", "underline", Helper.UNDERLINE.DOTTED, Helper.UNDERLINE.NONE),
        uldash: this._genericFormatOnOff("chp", "underline", Helper.UNDERLINE.DASHED, Helper.UNDERLINE.NONE),
        uldashd: this._genericFormatOnOff("chp", "underline", Helper.UNDERLINE.DASHDOTTED, Helper.UNDERLINE.NONE),
        uldashdd: this._genericFormatOnOff("chp", "underline", Helper.UNDERLINE.DASHDOTDOTTED, Helper.UNDERLINE.NONE),
        uldb: this._genericFormatOnOff("chp", "underline", Helper.UNDERLINE.DOUBLE, Helper.UNDERLINE.NONE),
        ulhwave: this._genericFormatOnOff("chp", "underline", Helper.UNDERLINE.HEAVYWAVE, Helper.UNDERLINE.NONE),
        ulldash: this._genericFormatOnOff("chp", "underline", Helper.UNDERLINE.LONGDASHED, Helper.UNDERLINE.NONE),
        ulnone: this._genericFormatSetNoParam("chp", "underline", Helper.UNDERLINE.NONE),
        ulth: this._genericFormatOnOff("chp", "underline", Helper.UNDERLINE.THICK, Helper.UNDERLINE.NONE),
        ulthd: this._genericFormatOnOff("chp", "underline", Helper.UNDERLINE.THICKDOTTED, Helper.UNDERLINE.NONE),
        ulthdash: this._genericFormatOnOff("chp", "underline", Helper.UNDERLINE.THICKDASHED, Helper.UNDERLINE.NONE),
        ulthdashd: this._genericFormatOnOff("chp", "underline", Helper.UNDERLINE.THICKDASHDOTTED,
            Helper.UNDERLINE.NONE),
        ulthdashdd: this._genericFormatOnOff("chp", "underline", Helper.UNDERLINE.THICKDASHDOTDOTTED,
            Helper.UNDERLINE.NONE),
        ululdbwave: this._genericFormatOnOff("chp", "underline", Helper.UNDERLINE.DOUBLEWAVE, Helper.UNDERLINE.NONE),
        ulw: this._genericFormatOnOff("chp", "underline", Helper.UNDERLINE.WORD, Helper.UNDERLINE.NONE),
        ulwave: this._genericFormatOnOff("chp", "underline", Helper.UNDERLINE.WAVE, Helper.UNDERLINE.NONE),
        li: this._genericFormatSetMemberVal("pap", "indent", "left", 0),
        ri: this._genericFormatSetMemberVal("pap", "indent", "right", 0),
        fi: this._genericFormatSetMemberVal("pap", "indent", "firstline", 0),
        sa: this._genericFormatSetValRequired("pap", "spaceafter"),
        sb: this._genericFormatSetValRequired("pap", "spacebefore"),
        cols: this._genericFormatSetVal("sep", "columns", 0),
        sbknone: this._genericFormatSetNoParam("sep", "breaktype", Helper.BREAKTYPE.NONE),
        sbkcol: this._genericFormatSetNoParam("sep", "breaktype", Helper.BREAKTYPE.COL),
        sbkeven: this._genericFormatSetNoParam("sep", "breaktype", Helper.BREAKTYPE.EVEN),
        sbkodd: this._genericFormatSetNoParam("sep", "breaktype", Helper.BREAKTYPE.ODD),
        sbkpage: this._genericFormatSetNoParam("sep", "breaktype", Helper.BREAKTYPE.PAGE),
        pgnx: this._genericFormatSetMemberVal("sep", "pagenumber", "x", 0),
        pgny: this._genericFormatSetMemberVal("sep", "pagenumber", "y", 0),
        pgndec: this._genericFormatSetNoParam("sep", "pagenumberformat", Helper.PAGENUMBER.DECIMAL),
        pgnucrm: this._genericFormatSetNoParam("sep", "pagenumberformat", Helper.PAGENUMBER.UROM),
        pgnlcrm: this._genericFormatSetNoParam("sep", "pagenumberformat", Helper.PAGENUMBER.LROM),
        pgnucltr: this._genericFormatSetNoParam("sep", "pagenumberformat", Helper.PAGENUMBER.ULTR),
        pgnlcltr: this._genericFormatSetNoParam("sep", "pagenumberformat", Helper.PAGENUMBER.LLTR),
        qc: this._genericFormatSetNoParam("pap", "justification", Helper.JUSTIFICATION.CENTER),
        ql: this._genericFormatSetNoParam("pap", "justification", Helper.JUSTIFICATION.LEFT),
        qr: this._genericFormatSetNoParam("pap", "justification", Helper.JUSTIFICATION.RIGHT),
        qj: this._genericFormatSetNoParam("pap", "justification", Helper.JUSTIFICATION.JUSTIFY),
        paperw: this._genericFormatSetVal("dop", "width", 12240),
        paperh: this._genericFormatSetVal("dop", "height", 15480),
        margl: this._genericFormatSetMemberVal("dop", "margin", "left", 1800),
        margr: this._genericFormatSetMemberVal("dop", "margin", "right", 1800),
        margt: this._genericFormatSetMemberVal("dop", "margin", "top", 1440),
        margb: this._genericFormatSetMemberVal("dop", "margin", "bottom", 1440),
        pgnstart: this._genericFormatSetVal("dop", "pagenumberstart", 1),
        facingp: this._genericFormatSetNoParam("dop", "facingpages", true),
        landscape: this._genericFormatSetNoParam("dop", "landscape", true),
        par: this._addInsHandler((renderer) => {
            renderer.startPar();
        }),
        line: this._addInsHandler((renderer) => {
            renderer.lineBreak();
        }),
    };

    constructor(parser: GlobalState, inst: Document, name: string, param: number) {
        super(name);
        if (parser.version != null) {
            throw new RTFJSError("Unexpected rtf destination");
        }

        // This parameter should be one, but older versions of the spec allow for omission of the version number
        if (param && param !== 1) {
            throw new RTFJSError("Unsupported rtf version");
        }
        parser.version = 1;

        this._metadata = {};
        this.parser = parser;
        this.inst = inst;
    }

    public addIns(func: (renderer: Renderer) => void): void {
        this.inst.addIns(func);
    }

    public appendText(text: string): void {
        Helper.log("[rtf] output: " + text);
        this.inst.addIns(text);
    }

    public sub(): void {
        Helper.log("[rtf].sub()");
    }

    public handleKeyword(keyword: string, param: number): boolean {
        const handler = this._charFormatHandlers[keyword];
        if (handler != null) {
            handler(param);
            return true;
        }
        return false;
    }

    public apply(): void {
        Helper.log("[rtf] apply()");
        for (const prop in this._metadata) {
            this.inst._meta[prop] = this._metadata[prop];
        }
        delete this._metadata;
    }

    public setMetadata(prop: string, val: any): void {
        this._metadata[prop] = val;
    }

    private _addInsHandler(func: (renderer: Renderer) => void) {
        return (param: number) => {
            this.inst.addIns(func);
        };
    }

    private _addFormatIns(ptype: string, props: Chp | Pap) {
        Helper.log("[rtf] update " + ptype);
        switch (ptype) {
            case "chp": {
                const rchp = new RenderChp(new Chp(props as Chp));
                this.inst.addIns((renderer) => {
                    renderer.setChp(rchp);
                });
                break;
            }
            case "pap": {
                const rpap = new RenderPap(new Pap(props as Pap));
                this.inst.addIns((renderer) => {
                    renderer.setPap(rpap);
                });
                break;
            }
        }
    }

    private _genericFormatSetNoParam(ptype: string, prop: string, val: any) {
        return (param: number) => {
            const props = this.parser.state[ptype];
            props[prop] = val;
            Helper.log("[rtf] state." + ptype + "." + prop + " = " + props[prop].toString());
            this._addFormatIns(ptype, props);
        };
    }

    private _genericFormatOnOff(ptype: string, prop: string, onval?: string, offval?: string) {
        return (param: number) => {
            const props = this.parser.state[ptype];
            props[prop] = (param == null || param !== 0)
                ? (onval != null ? onval : true) : (offval != null ? offval : false);
            Helper.log("[rtf] state." + ptype + "." + prop + " = " + props[prop].toString());
            this._addFormatIns(ptype, props);
        };
    }

    private _genericFormatSetVal(ptype: string, prop: string, defaultval: number) {
        return (param: number) => {
            const props = this.parser.state[ptype];
            props[prop] = (param == null) ? defaultval : param;
            Helper.log("[rtf] state." + ptype + "." + prop + " = " + props[prop].toString());
            this._addFormatIns(ptype, props);
        };
    }

    private _genericFormatSetValRequired(ptype: string, prop: string) {
        return (param: number) => {
            if (param == null) {
                throw new RTFJSError("Keyword without required param");
            }
            const props = this.parser.state[ptype];
            props[prop] = param;
            Helper.log("[rtf] state." + ptype + "." + prop + " = " + props[prop].toString());
            this._addFormatIns(ptype, props);
        };
    }

    private _genericFormatSetMemberVal(ptype: string, prop: string, member: string, defaultval: number) {
        return (param: number) => {
            const props = this.parser.state[ptype];
            const members = props[prop];
            members[member] = (param == null) ? defaultval : param;
            Helper.log("[rtf] state." + ptype + "." + prop + "." + member + " = " + members[member].toString());
            this._addFormatIns(ptype, props);
        };
    }
}

// ===== rtfjs/parser/destinations/ColortblDestinations.ts =====
interface IColor {
    r: number;
    g: number;
    b: number;
    tint: number;
    shade: number;
    theme: null;
}

class ColortblDestination extends DestinationBase {
    private _colors: IColor[];
    private _current: IColor;
    private _autoIndex: number;
    private inst: Document;

    constructor(parser: GlobalState, inst: Document) {
        super("colortbl");
        this._colors = [];
        this._current = null;
        this._autoIndex = null;
        this.inst = inst;
    }

    public appendText(text: string): void {
        // We expect this method to be called after the color was fully defined.
        if (text.trim() !== ";") {
            throw new RTFJSError("Error parsing colortbl destination");
        }
        if (this._current == null) {
            if (this._autoIndex != null) {
                throw new RTFJSError("colortbl cannot define more than one auto color");
            }
            this._autoIndex = this._colors.length;
            this._startNewColor();
        } else {
            if (this._current.tint < 255 && this._current.shade < 255) {
                throw new RTFJSError("colortbl cannot define shade and tint at the same time");
            }
        }
        this._colors.push(this._current);
        this._current = null;
    }

    public handleKeyword(keyword: string, param: number): boolean {
        if (this._current == null) {
            this._startNewColor();
        }

        switch (keyword) {
            case "red":
                this._current.r = this._validateColorValueRange(keyword, param);
                return true;
            case "green":
                this._current.g = this._validateColorValueRange(keyword, param);
                return true;
            case "blue":
                this._current.b = this._validateColorValueRange(keyword, param);
                return true;
            case "ctint":
                this._current.tint = this._validateColorValueRange(keyword, param);
                return true;
            case "cshade":
                this._current.shade = this._validateColorValueRange(keyword, param);
                return true;
            default:
                if (keyword[0] === "c") {
                    this._current.theme = Helper._mapColorTheme(keyword.slice(1));
                    return true;
                }
                break;
        }

        Helper.log("[colortbl] handleKeyword(): unhandled keyword: " + keyword);
        return false;
    }

    public apply(): void {
        Helper.log("[colortbl] apply()");
        if (this._autoIndex == null) {
            this._autoIndex = 0;
        }
        if (this._autoIndex >= this._colors.length) {
            throw new RTFJSError("colortbl doesn't define auto color");
        }
        for (const idx in this._colors) {
            Helper.log("[colortbl] [" + idx + "] = "
                + this._colors[idx].r + "," + this._colors[idx].g + "," + this._colors[idx].b
                + " theme: " + this._colors[idx].theme);
        }
        this.inst._colors = this._colors;
        this.inst._autoColor = this._autoIndex;
        delete this._colors;
    }

    private _startNewColor() {
        this._current = {
            r: 0,
            g: 0,
            b: 0,
            tint: 255,
            shade: 255,
            theme: null,
        };
        return this._current;
    }

    private _validateColorValueRange(keyword: string, param: number): number {
        if (param == null) {
            throw new RTFJSError(keyword + " has no param");
        }
        if (param < 0 || param > 255) {
            throw new RTFJSError(keyword + " has invalid param value");
        }
        return param;
    }
}

// ===== rtfjs/parser/destinations/FonttblDestinations.ts =====
class FonttblDestinationSub extends DestinationBase {
    public index: number;
    public fontname: string;
    public altfontname: string;
    public family: string;
    public pitch: number;
    public bias: number;
    public charset: number;
    private _fonttbl: FonttblDestination;

    constructor(fonttbl: FonttblDestination) {
        super("fonttbl:sub");
        this._fonttbl = fonttbl;
        this.index = null;
        this.fontname = null;
        this.altfontname = null;
        this.family = null;
        this.pitch = Helper.FONTPITCH.DEFAULT;
        this.bias = 0;
        this.charset = null;
    }

    public handleKeyword(keyword: string, param: number): boolean {
        switch (keyword) {
            case "f":
                this.index = param;
                return true;
            case "fnil":
                return true;
            case "froman":
            case "fswiss":
            case "fmodern":
            case "fscript":
            case "fdecor":
            case "ftech":
            case "fbidi":
            case "flomajor":
            case "fhimajor":
            case "fdbmajor":
            case "fbimajor":
            case "flominor":
            case "fhiminor":
            case "fdbminor":
            case "fbiminor":
                this.family = keyword.slice(1);
                return true;
            case "fprq":
                switch (param) {
                    case 0:
                        this.pitch = Helper.FONTPITCH.DEFAULT;
                        break;
                    case 1:
                        this.pitch = Helper.FONTPITCH.FIXED;
                        break;
                    case 2:
                        this.pitch = Helper.FONTPITCH.VARIABLE;
                        break;
                }
                return true;
            case "fbias":
                if (param != null) {
                    this.bias = param;
                }
                return true;
            case "fcharset":
                if (param != null) {
                    this.charset = Helper._mapCharset(param);
                    if (this.charset == null) {
                        Helper.log("Unknown font charset: " + param);
                    }
                }
                return true;
            case "cpg":
                if (param != null) {
                    this.charset = param;
                }
                return true;
        }
        return false;
    }

    public appendText(text: string): void {
        if (this.fontname == null) {
            this.fontname = text;
        } else {
            this.fontname += text;
        }
    }

    public apply(): void {
        if (this.index == null) {
            throw new RTFJSError("No font index provided");
        }
        if (this.fontname == null) {
            throw new RTFJSError("No font name provided");
        }
        this._fonttbl.addSub(this);
        delete this._fonttbl;
    }

    public setAltFontName(name: string): void {
        this.altfontname = name;
    }
}

class FonttblDestination extends DestinationBase {
    private _fonts: FonttblDestinationSub[];
    private _sub: FonttblDestinationSub;
    private inst: Document;

    constructor(parser: GlobalState, inst: Document) {
        super("fonttbl");
        this._fonts = [];
        this._sub = null;
        this.inst = inst;
    }

    public sub(): FonttblDestinationSub {
        return new FonttblDestinationSub(this);
    }

    public apply(): void {
        Helper.log("[fonttbl] apply()");
        for (const idx in this._fonts) {
            Helper.log("[fonttbl][" + idx + "] index = " + this._fonts[idx].fontname
                + " alternative: " + this._fonts[idx].altfontname);
        }
        this.inst._fonts = this._fonts;
        delete this._fonts;
    }

    public appendText(text: string): void {
        this._sub.appendText(text);
        this._sub.apply();
    }

    public handleKeyword(keyword: string, param: number): void {
        if (keyword === "f") {
            this._sub = this.sub();
        }
        this._sub.handleKeyword(keyword, param);
    }

    public addSub(sub: FonttblDestinationSub): void {
        this._fonts[sub.index] = sub;
    }
}

// ===== rtfjs/parser/destinations/MetaDestinations.ts =====
class InfoDestination extends DestinationBase {
    private _metadata: { [key: string]: any };
    private inst: Document;

    constructor(parser: GlobalState, inst: Document, name: string) {
        super(name);
        this._metadata = {};
        this.inst = inst;
    }

    public apply(): void {
        for (const prop in this._metadata) {
            this.inst._meta[prop] = this._metadata[prop];
        }
        delete this._metadata;
    }

    public setMetadata(prop: string, val: any): void {
        this._metadata[prop] = val;
    }
}

interface IMetaPropertyDestination extends IDestination {
    apply(): void;
}

class MetaPropertyDestinationFactory extends DestinationFactory<IMetaPropertyDestination> {
    constructor(metaprop: string) {
        super();
        this.class = class extends DestinationTextBase implements IMetaPropertyDestination {
            private parser: GlobalState;

            constructor(parser: GlobalState, inst: Document, name: string) {
                super(name);
                this.parser = parser;
            }

            public apply() {
                const info = findParentDestination(this.parser, "info");
                if (info == null) {
                    throw new RTFJSError("IDestination " + this._name + " must be within info destination");
                }
                info.setMetadata(metaprop, this.text);
            }
        };
    }
}

interface IMetaPropertyTimeDestination extends IDestination {
    handleKeyword(keyword: string, param: number): boolean;

    apply(): void;
}

class MetaPropertyTimeDestinationFactory extends DestinationFactory<IMetaPropertyTimeDestination> {
    constructor(metaprop: string) {
        super();
        this.class = class extends DestinationBase implements IMetaPropertyTimeDestination {
            private _yr: number;
            private _mo: number;
            private _dy: number;
            private _hr: number;
            private _min: number;
            private _sec: number;
            private parser: GlobalState;

            constructor(parser: GlobalState, inst: Document, name: string) {
                super(name);
                this._yr = null;
                this._mo = null;
                this._dy = null;
                this._hr = null;
                this._min = null;
                this._sec = null;
                this.parser = parser;
            }

            public handleKeyword(keyword: string, param: number) {
                switch (keyword) {
                    case "yr":
                        this._yr = param;
                        break;
                    case "mo":
                        this._mo = param;
                        break;
                    case "dy":
                        this._dy = param;
                        break;
                    case "hr":
                        this._hr = param;
                        break;
                    case "min":
                        this._min = param;
                        break;
                    case "sec":
                        this._sec = param;
                        break;
                    default:
                        return false;
                }

                if (param == null) {
                    throw new RTFJSError("No param found for keyword " + keyword);
                }
                return true;
            }

            public apply() {
                const info = findParentDestination(this.parser, "info");
                if (info == null) {
                    throw new RTFJSError("IDestination " + this._name + " must be within info destination");
                }
                const date = new Date(Date.UTC(
                    this._yr != null ? this._yr : 1970,
                    this._mo != null ? this._mo : 1,
                    this._dy != null ? this._dy : 1,
                    this._hr != null ? this._hr : 0,
                    this._min != null ? this._min : 0,
                    this._sec != null ? this._sec : 0,
                    0));
                info.setMetadata(metaprop, date);
            }
        };
    }
}

// ===== rtfjs/parser/destinations/PictDestinations.ts =====
interface IPictGroupDestination extends IDestination {
    isLegacy(): boolean;
}

class PictGroupDestinationFactory extends DestinationFactory<IPictGroupDestination> {
    constructor(legacy: boolean) {
        super();
        this.class = class extends DestinationTextBase implements IPictGroupDestination {
            private _legacy: boolean;

            constructor() {
                super("pict-group");
                this._legacy = legacy;
            }

            public isLegacy() {
                return this._legacy;
            }
        };
    }
}

class PictDestination extends DestinationTextBase {
    public _displaysize: { width: number, height: number };
    public _size: { width: number, height: number };
    private _type: string | (() => any);
    private _blob: ArrayBuffer;
    private parser: GlobalState;
    private inst: Document;

    [key: string]: any;

    private _pictHandlers: { [key: string]: (param: number) => void } = {
        picw: this._setPropValueRequired("_size", "width"),
        pich: this._setPropValueRequired("_size", "height"),
        picwgoal: this._setPropValueRequired("_displaysize", "width"),
        pichgoal: this._setPropValueRequired("_displaysize", "height"),
    };

    private _pictTypeHandler: {
        [key: string]
            : string | ((param?: number) => { load: () => any, render: (img: any) => Element })
    } = {
        emfblip: (() => {
            if (typeof EMFJS !== "undefined") {
                return () => {
                    return {
                        load: () => {
                            try {
                                return new EMFJS.Renderer(this._blob);
                            } catch (e) {
                                if (e instanceof EMFJS.Error) {
                                    return e.message;
                                } else {
                                    throw e;
                                }
                            }
                        },
                        render: (img: EMFJS.Renderer) => {
                            return img.render({
                                width: Helper._twipsToPt(this._displaysize.width) + "pt",
                                height: Helper._twipsToPt(this._displaysize.height) + "pt",
                                wExt: this._size.width,
                                hExt: this._size.height,
                                xExt: this._size.width,
                                yExt: this._size.height,
                                mapMode: 8,
                            });
                        },
                    };
                };
            } else {
                return "";
            }
        })(),
        pngblip: "image/png",
        jpegblip: "image/jpeg",
        macpict: "", // TODO
        pmmetafile: "", // TODO
        wmetafile: (() => {
            if (typeof WMFJS !== "undefined") {
                return (param: number) => {
                    if (param == null || param < 0 || param > 8) {
                        throw new RTFJSError("Insufficient metafile information");
                    }
                    return {
                        load: () => {
                            try {
                                return new WMFJS.Renderer(this._blob);
                            } catch (e) {
                                if (e instanceof WMFJS.Error) {
                                    return e.message;
                                } else {
                                    throw e;
                                }
                            }
                        },
                        render: (img: WMFJS.Renderer) => {
                            return img.render({
                                width: Helper._twipsToPt(this._displaysize.width) + "pt",
                                height: Helper._twipsToPt(this._displaysize.height) + "pt",
                                xExt: this._size.width,
                                yExt: this._size.height,
                                mapMode: param,
                            });
                        },
                    };
                };
            } else {
                return "";
            }
        })(),
        dibitmap: "", // TODO
        wbitmap: "", // TODO
    };

    constructor(parser: GlobalState, inst: Document) {
        super("pict");
        this._type = null;
        this._blob = null;
        this._displaysize = {
            width: null,
            height: null,
        };
        this._size = {
            width: null,
            height: null,
        };
        this.parser = parser;
        this.inst = inst;
    }

    public handleKeyword(keyword: string, param: number): boolean {
        const handler = this._pictHandlers[keyword];
        if (handler != null) {
            handler(param);
            return true;
        }
        const type = this._pictTypeHandler[keyword];
        if (type != null) {
            if (this._type == null) {
                if (typeof type === "function") {
                    const info = type(param);
                    if (info != null) {
                        this._type = () => {
                            const renderer = info.load();
                            if (renderer != null) {
                                if (typeof renderer === "string") {
                                    return renderer;
                                }
                                return () => {
                                    return info.render(renderer);
                                };
                            }
                        };
                    }
                } else {
                    this._type = type;
                }
            }
            return true;
        }
        return false;
    }

    public handleBlob(blob: ArrayBuffer): void {
        this._blob = blob;
    }

    public apply(rendering = false): { isLegacy: boolean, element: HTMLElement } {
        if (this._type == null) {
            throw new RTFJSError("Picture type unknown or not specified");
        }

        const pictGroup = findParentDestination(this.parser, "pict-group") as any as IPictGroupDestination;
        const isLegacy = (pictGroup != null ? pictGroup.isLegacy() : null);

        const type = this._type;
        if (typeof type === "function") {
            // type is the trampoline function that executes the .load function
            // and returns a renderer trampoline that ends up calling the .render function
            if (this._blob == null) {
                this._blob = Helper._hexToBlob(this.text);
                if (this._blob == null) {
                    throw new RTFJSError("Could not parse picture data");
                }
                delete this.text;
            }

            const doRender = (renderer: Renderer, render: boolean) => {
                const inst = renderer._doc;
                const pictrender = (type as (() => any))();
                if (pictrender != null) {
                    if (typeof pictrender === "string") {
                        Helper.log("[pict] Could not load image: " + pictrender);
                        if (render) {
                            return renderer.buildPicture(pictrender, null);
                        } else {
                            inst.addIns((rendererForPicture) => {
                                rendererForPicture.picture(pictrender, null);
                            });
                        }
                    } else {
                        if (typeof pictrender !== "function") {
                            throw new RTFJSError("Expected a picture render function");
                        }
                        if (render) {
                            return renderer.buildRenderedPicture(pictrender());
                        } else {
                            inst.addIns((rendererForPicture) => {
                                rendererForPicture.renderedPicture(pictrender());
                            });
                        }
                    }
                }
            };

            if (this.inst._settings.onPicture != null) {
                this.inst.addIns((renderer) => {
                    const elem = this.inst._settings.onPicture(isLegacy, () => {
                        return doRender(renderer, true);
                    });
                    if (elem != null) {
                        renderer.appendElement(elem);
                    }
                });
            } else {
                return {
                    isLegacy,
                    element: doRender(this.parser.renderer, rendering),
                };
            }
        } else if (typeof type === "string") {
            const text = this.text;
            const blob = this._blob;

            const doRender = (renderer: Renderer, render: boolean) => {
                const bin = blob != null ? Helper._blobToBinary(blob) : Helper._hexToBinary(text);
                if (type !== "") {
                    if (render) {
                        return renderer.buildPicture(type as string, bin);
                    } else {
                        renderer._doc.addIns((rendererForPicture) => {
                            rendererForPicture.picture(type as string, bin);
                        });
                    }
                } else {
                    if (render) {
                        return renderer.buildPicture("Unsupported image format", null);
                    } else {
                        renderer._doc.addIns((rendererForPicture) => {
                            rendererForPicture.picture("Unsupported image format", null);
                        });
                    }
                }
            };

            if (this.inst._settings.onPicture != null) {
                this.inst.addIns((renderer) => {
                    const elem = this.inst._settings.onPicture(isLegacy, () => {
                        return doRender(renderer, true);
                    });
                    if (elem != null) {
                        renderer.appendElement(elem);
                    }
                });
            } else {
                return {
                    isLegacy,
                    element: doRender(this.parser.renderer, rendering),
                };
            }
        }

        delete this.text;
    }

    private _setPropValueRequired(member: string, prop: string) {
        return (param: number) => {
            if (param == null) {
                throw new RTFJSError("Picture property has no value");
            }
            Helper.log("[pict] set " + member + "." + prop + " = " + param);
            const obj = (member != null ? this[member] : this);
            obj[prop] = param;
        };
    }
}

// ===== rtfjs/parser/destinations/StylesheetDestination.ts =====
class StylesheetDestinationSub extends DestinationBase {
    private _stylesheet: StylesheetDestination;
    private index: number;
    private name: string;
    private handler: (keyword: string, param: number) => boolean;
    private paragraph?: null;

    constructor(stylesheet: StylesheetDestination) {
        super("stylesheet:sub");
        this._stylesheet = stylesheet;
        this.index = 0;
        this.name = null;
        this.handler = this._handleKeywordCommon("paragraph");
    }

    public handleKeyword(keyword: string, param: number): boolean {
        switch (keyword) {
            case "s":
                this.index = param;
                return true;
            case "cs":
                delete this.paragraph;
                this.handler = this._handleKeywordCommon("character");
                this.index = param;
                return true;
            case "ds":
                delete this.paragraph;
                this.handler = this._handleKeywordCommon("section");
                this.index = param;
                return true;
            case "ts":
                delete this.paragraph;
                this.handler = this._handleKeywordCommon("table");
                this.index = param;
                return true;
        }

        return this.handler(keyword, param);
    }

    public appendText(text: string): void {
        if (this.name == null) {
            this.name = text;
        } else {
            this.name += text;
        }
    }

    public apply(): void {
        this._stylesheet.addSub({
            index: this.index,
            name: this.name,
        });
        delete this._stylesheet;
    }

    private _handleKeywordCommon(member: string) {
        return (keyword: string, param: number) => {
            Helper.log("[stylesheet:sub]." + member + ": unhandled keyword: " + keyword + " param: " + param);
            return false;
        };
    }
}

class StylesheetDestination extends DestinationBase {
    private _stylesheets: { index: number, name: string }[];
    private inst: Document;

    constructor(parser: GlobalState, inst: Document) {
        super("stylesheet");
        this._stylesheets = [];
        this.inst = inst;
    }

    public sub(): StylesheetDestinationSub {
        return new StylesheetDestinationSub(this);
    }

    public apply(): void {
        Helper.log("[stylesheet] apply()");
        for (const idx in this._stylesheets) {
            Helper.log("[stylesheet] [" + idx + "] name: " + this._stylesheets[idx].name);
        }
        this.inst._stylesheets = this._stylesheets;
        delete this._stylesheets;
    }

    public addSub(sub: { index: number, name: string }): void {
        // Some documents will redefine stylesheets
        // if (this._stylesheets[sub.index] != null)
        //     throw new RTFJSError("Cannot redefine stylesheet with index " + sub.index);
        this._stylesheets[sub.index] = sub;
    }
}

// ===== rtfjs/parser/destinations/FieldDestinations.ts =====
interface IField {
    renderFieldBegin(field: FieldDestination, rtf: RtfDestination, records: number): boolean;

    renderFieldEnd(field: FieldDestination, rtf: RtfDestination, records: number): void;
}

class FieldDestination extends DestinationBase {
    private _haveInst: boolean;
    private _parsedInst: IField;
    private _result: FldrsltDestination;

    constructor() {
        super("field");
        this._haveInst = false;
        this._parsedInst = null; // FieldBase
        this._result = null;
    }

    public apply(): void {
        if (!this._haveInst) {
            throw new RTFJSError("IField has no fldinst destination");
        }
        // A fldrslt destination should be included but is not required
        // if (this._result == null)
        //     throw new RTFJSError("IField has no fldrslt destination");
    }

    public setInst(inst: IField | Promise<IField | null>): void {
        this._haveInst = true;
        if (this._parsedInst != null) {
            throw new RTFJSError("IField cannot have multiple fldinst destinations");
        }
        if (inst instanceof Promise) {
            inst.then((parsedInst) => {
                this._parsedInst = parsedInst;
            }).catch((error) => {
                this._parsedInst = null;
                throw new RTFJSError(error.message);
            });
        } else {
            this._parsedInst = inst;
        }
    }

    public getInst(): IField {
        return this._parsedInst;
    }

    public setResult(inst: FldrsltDestination): void {
        if (this._result != null) {
            throw new RTFJSError("IField cannot have multiple fldrslt destinations");
        }
        this._result = inst;
    }
}

class FieldBase {
    private _fldinst: FldinstDestination;

    constructor(fldinst: FldinstDestination) {
        this._fldinst = fldinst;
    }

    public renderFieldEnd(field: FieldDestination, rtf: RtfDestination, records: number): void {
        if (records > 0) {
            rtf.addIns((renderer) => {
                renderer.popContainer();
            });
        }
    }
}

class FieldHyperlink extends FieldBase {
    private _url: string;

    constructor(fldinst: FldinstDestination, data: string) {
        super(fldinst);
        this._url = data;
    }

    public url(): string {
        return this._url;
    }

    public renderFieldBegin(field: FieldDestination, rtf: RtfDestination, records: number): boolean {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;
        if (records > 0) {
            rtf.addIns((renderer) => {
                const inst = renderer._doc;
                const create = () => {
                    return renderer.buildHyperlinkElement(self._url);
                };
                let container;
                if (inst._settings.onHyperlink != null) {
                    container = inst._settings.onHyperlink(create,
                        {
                            url() {
                                return self.url();
                            },
                        });
                } else {
                    const elem = create();
                    container = {
                        element: elem,
                        content: elem,
                    };
                }
                renderer.pushContainer(container);
            });
            return true;
        }
        return false;
    }
}

class FldinstDestination extends DestinationTextBase {
    private parser: GlobalState;
    private inst: Document;

    constructor(parser: GlobalState, inst: Document) {
        super("fldinst");
        this.parser = parser;
        this.inst = inst;
    }

    public apply(): void {
        const field = findParentDestination(this.parser, "field") as FieldDestination;
        if (field == null) {
            throw new RTFJSError("fldinst destination must be child of field destination");
        }
        field.setInst(this.parseType());
    }

    private parseType() {
        this.text = this.text.trim();
        const sep = this.text.indexOf(" ");
        if (sep > 0) {
            let data = this.text.substr(sep + 1);
            if (data.length >= 2 && data[0] === "\"") {
                const end = data.indexOf("\"", 1);
                if (end >= 1) {
                    data = data.substring(1, end);
                }
            }
            const fieldType = this.text.substr(0, sep).toUpperCase();
            switch (fieldType) {
                case "HYPERLINK":
                    return new FieldHyperlink(this, data);
                case "IMPORT":
                    if (typeof this.inst._settings.onImport === "function") {
                        let pict: PictDestination;

                        this.inst.addIns((renderer) => {
                            const inst = renderer._doc;
                            // backup
                            const hook = inst._settings.onPicture;
                            inst._settings.onPicture = null;

                            // eslint-disable-next-line prefer-const
                            let {isLegacy, element} = pict.apply(true);

                            // restore
                            inst._settings.onPicture = hook;

                            if (typeof hook === "function") {
                                element = hook(isLegacy, () => element);
                            }

                            if (element != null) {
                                renderer.appendElement(element);
                            }
                        });

                        const promise: Promise<IField | null> = new Promise((resolve, reject) => {
                            try {
                                const cb = ({error, keyword, blob, width, height}: {
                                    error?: Error, keyword?: string, blob?: ArrayBuffer,
                                    width?: number, height?: number,
                                }) => {
                                    if (!error && typeof keyword === "string" && keyword && blob) {
                                        const dims = {
                                            w: Helper._pxToTwips(width || window.document.body.clientWidth
                                                || window.innerWidth),
                                            h: Helper._pxToTwips(height || 300),
                                        };
                                        pict = new PictDestination(this.parser, this.inst);

                                        pict.handleBlob(blob);
                                        pict.handleKeyword(keyword, 8);  // mapMode: 8 => preserve aspect ratio
                                        pict._displaysize.width = dims.w;
                                        pict._displaysize.height = dims.h;
                                        pict._size.width = dims.w;
                                        pict._size.height = dims.h;

                                        const _parsedInst: IField = {
                                            renderFieldBegin: () => true,
                                            renderFieldEnd: () => null,
                                        };
                                        resolve(_parsedInst);
                                    } else {
                                        Helper.log("[fldinst]: failed to IMPORT image file: " + data);
                                        if (error) {
                                            error = (error instanceof Error) ? error : new Error(error);
                                            reject(error);
                                        } else {
                                            resolve(null);
                                        }
                                    }
                                };
                                this.inst._settings.onImport(data, cb);
                            } catch (error) {
                                reject(error);
                            }
                        });
                        this.parser._asyncTasks.push(promise);
                        return promise;
                    }
                    break;
                default:
                    Helper.log("[fldinst]: unknown field type: " + fieldType);
                    break;
            }
        }
    }
}

class FldrsltDestination extends DestinationFormattedTextBase {
    constructor(parser: GlobalState, inst: Document) {
        super(parser, "fldrslt");
    }

    public apply(): void {
        const field = findParentDestination(this.parser, "field") as FieldDestination;
        if (field != null) {
            field.setResult(this);
        }

        super.apply();
    }

    public renderBegin(rtf: RtfDestination, records: number): boolean {
        const field = findParentDestination(this.parser, "field") as FieldDestination;
        if (field != null) {
            const inst = field.getInst();
            if (inst != null) {
                return inst.renderFieldBegin(field, rtf, records);
            }
        }
        return false;
    }

    public renderEnd(rtf: RtfDestination, records: number): void {
        const field = findParentDestination(this.parser, "field") as FieldDestination;
        if (field != null) {
            const inst = field.getInst();
            if (inst != null) {
                inst.renderFieldEnd(field, rtf, records);
            }
        }
    }
}

// ===== rtfjs/parser/destinations/Destinations.ts =====
const Destinations
    : {[key: string]
        : ((new (parser: GlobalState, inst: Document, name: string, param: number) => any)
        | DestinationFactory<any>)} = {
    rtf: RtfDestination,
    info: InfoDestination,
    title: new MetaPropertyDestinationFactory("title"),
    subject: new MetaPropertyDestinationFactory("subject"),
    author: new MetaPropertyDestinationFactory("author"),
    manager: new MetaPropertyDestinationFactory("manager"),
    company: new MetaPropertyDestinationFactory("company"),
    operator: new MetaPropertyDestinationFactory("operator"),
    category: new MetaPropertyDestinationFactory("category"),
    keywords: new MetaPropertyDestinationFactory("keywords"),
    doccomm: new MetaPropertyDestinationFactory("doccomm"),
    hlinkbase: new MetaPropertyDestinationFactory("hlinkbase"),
    generator: new GenericPropertyDestinationFactory("rtf", "generator"),
    creatim: new MetaPropertyTimeDestinationFactory("creatim"),
    revtim: new MetaPropertyTimeDestinationFactory("revtim"),
    printim: new MetaPropertyTimeDestinationFactory("printim"),
    buptim: new MetaPropertyTimeDestinationFactory("buptim"),
    fonttbl: FonttblDestination,
    falt: new GenericSubTextPropertyDestinationFactory("falt", "fonttbl:sub",
        "setAltFontName"),
    colortbl: ColortblDestination,
    stylesheet: StylesheetDestination,
    footer: new RequiredDestinationFactory("footer"),
    footerf: new RequiredDestinationFactory("footerf"),
    footerl: new RequiredDestinationFactory("footerl"),
    footerr: new RequiredDestinationFactory("footerr"),
    footnote: new RequiredDestinationFactory("footnote"),
    ftncn: new RequiredDestinationFactory("ftncn"),
    ftnsep: new RequiredDestinationFactory("ftnsep"),
    ftnsepc: new RequiredDestinationFactory("ftnsepc"),
    header: new RequiredDestinationFactory("header"),
    headerf: new RequiredDestinationFactory("headerf"),
    headerl: new RequiredDestinationFactory("headerl"),
    headerr: new RequiredDestinationFactory("headerr"),
    pict: PictDestination,
    shppict: new PictGroupDestinationFactory(false),
    nonshppict: new PictGroupDestinationFactory(true),
    private1: new RequiredDestinationFactory("private1"),
    rxe: new RequiredDestinationFactory("rxe"),
    tc: new RequiredDestinationFactory("tc"),
    txe: new RequiredDestinationFactory("txe"),
    xe: new RequiredDestinationFactory("xe"),
    field: FieldDestination,
    fldinst: FldinstDestination,
    fldrslt: FldrsltDestination,
};

// ===== rtfjs/parser/Parser.ts =====
class Parser {
    private inst: Document;
    private parser: GlobalState;

    constructor(document: Document, blob: ArrayBuffer, renderer: Renderer) {
        this.inst = document;
        this.parser = new GlobalState(blob, renderer);
    }

    public parse(): Promise<void> {
        if (this.parser.data.length > 1 && String.fromCharCode(this.parser.data[0]) === "{") {
            this.parseLoop(false, true);
            return Promise.all(this.parser._asyncTasks).then(() => {
                return;
            });
        }
        if (this.parser.version == null) {
            throw new RTFJSError("Not a valid rtf document");
        }
        if (this.parser.state != null) {
            throw new RTFJSError("File truncated");
        }
    }

    private eof() {
        return this.parser.pos >= this.parser.data.length;
    }

    private readChar() {
        if (this.parser.pos < this.parser.data.length) {
            this.parser.column++;
            return String.fromCharCode(this.parser.data[this.parser.pos++]);
        }

        throw new RTFJSError("Unexpected end of file");
    }

    private unreadChar() {
        if (this.parser.pos > 0) {
            this.parser.column--;
            this.parser.pos--;
        } else {
            throw new RTFJSError("Already at beginning of file");
        }
    }

    private readBlob(cnt: number) {
        if (this.parser.pos + cnt > this.parser.data.length) {
            throw new RTFJSError("Cannot read binary data: too long");
        }
        const buf = new ArrayBuffer(cnt);
        const view = new Uint8Array(buf);
        for (let i = 0; i < cnt; i++) {
            view[i] = this.parser.data[this.parser.pos + i];
        }
        return buf;
    }

    private applyDestination(always: boolean) {
        const dest = this.parser.state.destination;
        if (dest != null) {
            if (always || this.parser.state.parent == null
                || this.parser.state.parent.destination !== this.parser.state.destination) {
                if (dest.apply != null) {
                    dest.apply();
                }
                this.parser.state.destination = null;
            }
        }
    }

    private applyText() {
        if (this.parser.text.length > 0) {
            const dest = this.parser.state.destination;
            if (dest == null) {
                throw new RTFJSError("Cannot route text to destination");
            }
            if (dest.appendText != null && !this.parser.state.skipdestination) {
                const summarizedText = this.summarizeText(this.parser.text);
                dest.appendText(summarizedText);
            }
            this.parser.text = [];
        }
    }

    private summarizeText(text: (PlainText | HexText)[]) {
        let result = "";
        for (let i = 0; i < text.length; i++) {
            const value = text[i];
            if (value instanceof PlainText) {
                result += value.text;
            } else if (value instanceof HexText) {
                // Looking for current fonttbl charset
                let codepage = this.parser.codepage;
                if (Object.prototype.hasOwnProperty.call(value.chp, "fontfamily")) {
                    const idx = value.chp.fontfamily;
                    // Code page 42 isn't a real code page and shouldn't appear here
                    if (this.inst._fonts !== undefined && this.inst._fonts[idx] != null
                        && this.inst._fonts[idx].charset && this.inst._fonts[idx].charset !== 42) {
                        codepage = this.inst._fonts[idx].charset;
                    }
                }

                let hex = value.hex;
                if (this.parser.state.pap.charactertype === Helper.CHARACTER_TYPE.DOUBLE
                    || (this.parser.state.pap.charactertype == null && hex >= 0x80)) {
                    // A reference check is sufficient for the chp instances,
                    // as they have to be the same if they belong to one character
                    if (i + 1 < text.length
                        && text[i + 1] instanceof HexText && (text[i + 1] as HexText).chp === value.chp) {
                        const doubleByteCharacterHex = hex * 0x100 + (text[i + 1] as HexText).hex;
                        // Verify the double byte character is valid for this code page
                        if (cptable[codepage].dec[doubleByteCharacterHex] !== undefined) {
                            hex = doubleByteCharacterHex;
                            // Don't process the following hex character twice
                            i++;
                        }
                    }
                }

                result += cptable[codepage].dec[hex];
            }
        }

        return result;
    }

    private pushState(forceSkip: boolean) {
        this.parser.state = new State(this.parser.state);
        if (forceSkip) {
            this.parser.state.skipdestination = true;
        }

        const dest = this.parser.state.destination;
        if (dest != null && !this.parser.state.skipdestination) {
            if (dest.sub != null) {
                const sub = dest.sub();
                if (sub != null) {
                    this.parser.state.destination = sub;
                }
            }
        }
    }

    private popState() {
        const state = this.parser.state;
        if (state == null) {
            throw new RTFJSError("Unexpected end of state");
        }

        this.applyText();
        if (state.parent == null || state.destination !== state.parent.destination) {
            this.applyDestination(true);
        }
        this.parser.state = state.parent;

        if (this.parser.state !== null) {
            const currentState = this.parser.state;
            this.inst._ins.push((renderer) => {
                renderer.setChp(new RenderChp(currentState.chp));
            });
            this.inst._ins.push((renderer) => {
                renderer.setPap(new RenderPap(currentState.pap));
            });
        }
        return this.parser.state;
    }

    private changeDestination(name: string, param: number) {
        this.applyText();
        const handler = Destinations[name];
        if (handler != null) {
            this.applyDestination(false);
            if (handler instanceof DestinationFactory) {
                this.parser.state.destination = handler.newDestination(this.parser, this.inst, name, param);
            } else {
                this.parser.state.destination = new handler(this.parser, this.inst, name, param);
            }
            return true;
        }
        return false;
    }

    private processKeyword(keyword: string, param: number | null) {
        const first = this.parser.state.first;
        if (first) {
            if (keyword === "*") {
                this.parser.state.skipunknowndestination = true;
                return;
            }

            this.parser.state.first = false;
        }

        if (this.parser.state.bindata > 0) {
            throw new RTFJSError("Keyword encountered within binary data");
        }

        // Reset if we unexpectedly encounter a keyword
        this.parser.state.skipchars = 0;
        switch (keyword) {
            case "tab":
                return "\t";
            case "emdash":
                return "—";
            case "endash":
                return "–";
            case "emspace":
                return " ";
            case "enspace":
                return " ";
            case "qmspace":
                return " ";
            case "bullet":
                return "•";
            case "lquote":
                return "‘";
            case "rquote":
                return "’";
            case "ldblquote":
                return "“";
            case "rdblquote":
                return "”";
            case "~":
                return " ";
            case "_":
                return "‑";
            case "{":
            case "}":
            case "\\":
                return keyword;

            case "uc":
                if (param != null && param >= 0) {
                    this.parser.state.ucn = param;
                }
                break;
            case "u":
                if (param != null) {
                    if (param < 0) {
                        param += 65536;
                    }
                    if (param < 0 || param > 65535) {
                        throw new RTFJSError("Invalid unicode character encountered");
                    }

                    const idx = this.parser.state.chp.fontfamily;
                    // Code page 42 indicates a symbol, symbols between 0x0020 and 0x00ff
                    // are mapped to the range between 0xf020 and 0xf0ff
                    if (idx && this.inst._fonts
                        && this.inst._fonts[idx].charset && this.inst._fonts[idx].charset === 42
                        && param >= 0xf020 && param <= 0xf0ff) {
                        this.appendText(new PlainText(String.fromCharCode(param - 0xf000)));
                    } else {
                        this.appendText(new PlainText(String.fromCharCode(param)));
                    }
                    this.parser.state.skipchars = this.parser.state.ucn;
                }
                return;

            case "bin":
                if (param == null) {
                    throw new RTFJSError("Binary data is missing length");
                }
                if (param < 0) {
                    throw new RTFJSError("Binary data with invalid length");
                }
                this.parser.state.bindata = param;
                return;

            case "upr":
                this.parseLoop(true, false); // skip the first sub destination (ansi)
                // this will be followed by a \ud sub destination
                return;

            case "ud":
            case "ltrch":
            case "rtlch":
                return;

            case "\n":
            case "\r": {
                // Carriage return and line feed must be treated like a \par, so we rewrite the keyword
                // here and then fall through to the default behavior
                this.parser.line++;
                this.parser.column = 0;

                keyword = "par";
            }
            // eslint-disable-next-line no-fallthrough
            default:
                if (!this.parser.state.skipdestination) {
                    if (first) {
                        if (!this.changeDestination(keyword, param)) {
                            let handled = false;
                            const dest = this.parser.state.destination;
                            if (dest != null) {
                                if (dest.handleKeyword != null) {
                                    handled = dest.handleKeyword(keyword, param) || false;
                                }
                            }
                            if (!handled && this.parser.state.skipunknowndestination) {
                                this.parser.state.skipdestination = true;
                            }
                        }
                    } else {
                        this.applyText();
                        const dest = this.parser.state.destination;
                        if (dest != null) {
                            if (dest.handleKeyword != null) {
                                dest.handleKeyword(keyword, param);
                            }
                        } else {
                            Helper.log("Unhandled keyword: " + keyword + " param: " + param);
                        }
                    }
                }
                return;
        }

        this.parser.state.skipdestination = false;
    }

    private appendText(textData: PlainText | HexText) {
        this.parser.state.first = false;
        if (this.parser.state.skipchars > 0) {
            if (textData instanceof PlainText) {
                const len = textData.text.length;
                if (this.parser.state.skipchars >= len) {
                    this.parser.state.skipchars -= len;
                    return;
                }

                if (this.parser.state.destination == null || !this.parser.state.skipdestination) {
                    this.parser.text.push(new PlainText(textData.text.slice(this.parser.state.skipchars)));
                }
            } else {
                if (this.parser.state.skipchars >= 1) {
                    this.parser.state.skipchars -= 1;
                    return;
                }

                if (this.parser.state.destination == null || !this.parser.state.skipdestination) {
                    this.parser.text.push(textData);
                }
            }
            this.parser.state.skipchars = 0;
        } else if (this.parser.state.destination == null || !this.parser.state.skipdestination) {
            this.parser.text.push(textData);
        }
    }

    private applyBlob(blob: ArrayBuffer) {
        this.parser.state.first = false;
        this.applyText();
        if (this.parser.state.skipchars > 0) {
            // \bin and all its data is considered one character for skipping purposes
            this.parser.state.skipchars--;
        } else {
            const dest = this.parser.state.destination;
            if (dest == null) {
                throw new RTFJSError("Cannot route binary to destination");
            }
            if (dest.handleBlob != null && !this.parser.state.skipdestination) {
                dest.handleBlob(blob);
            }
        }
    }

    private parseKeyword(process: boolean) {
        if (this.parser.state == null) {
            throw new RTFJSError("No state");
        }

        let param: number;
        let ch = this.readChar();
        if (!Helper._isalpha(ch)) {
            // 8 bit character encoded as hexadecimal
            if (ch === "'") {
                const hex = this.readChar() + this.readChar();

                param = Helper._parseHex(hex);
                if (isNaN(param)) {
                    throw new RTFJSError("Could not parse hexadecimal number");
                }

                if (process) {
                    this.appendText(new HexText(param, this.parser.state.chp));
                }
            } else if (process) {
                const text = this.processKeyword(ch, null);
                if (text != null) {
                    this.appendText(new PlainText(text));
                }
            }
        } else {
            let keyword = ch;
            ch = this.readChar();
            while (keyword.length < 30 && Helper._isalpha(ch)) {
                keyword += ch;
                ch = this.readChar();
            }

            let num;
            if (ch === "-") {
                num = "-";
                ch = this.readChar();
            } else {
                num = "";
            }

            if (Helper._isdigit(ch)) {
                do {
                    num += ch;
                    ch = this.readChar();
                } while (num.length < 20 && Helper._isdigit(ch));

                if (num.length >= 20) {
                    throw new RTFJSError("Param for keyword " + keyword + " too long");
                }

                param = parseInt(num, 10);
                if (isNaN(param)) {
                    throw new RTFJSError("Invalid keyword " + keyword + " param");
                }
            }

            if (ch !== " ") {
                this.unreadChar();
            }

            if (process) {
                const text = this.processKeyword(keyword, param);
                if (text != null) {
                    this.appendText(new PlainText(text));
                }
            }
        }
    }

    private parseLoop(skip: boolean, process: boolean) {
        try {
            const initialState = this.parser.state;
            main_loop: while (!this.eof()) {
                if (this.parser.state != null && this.parser.state.bindata > 0) {
                    const blob = this.readBlob(this.parser.state.bindata);
                    this.parser.state.bindata = 0;
                    this.applyBlob(blob);
                } else {
                    const ch = this.readChar();
                    switch (ch) {
                        case "\r":
                            continue;
                        case "\n":
                            this.parser.line++;
                            this.parser.column = 0;
                            continue;
                        case "{":
                            this.pushState(skip);
                            break;
                        case "}":
                            if (initialState === this.parser.state) {
                                this.unreadChar();
                                break main_loop;
                            } else if (this.popState() === initialState) {
                                break main_loop;
                            }
                            break;
                        case "\\":
                            this.parseKeyword(!skip ? process : null);
                            break;
                        default:
                            if (!skip) {
                                this.appendText(new PlainText(ch));
                            }
                            break;
                    }
                }
            }
        } catch (error) {
            if (error instanceof RTFJSError) {
                error.message += " (line: " + this.parser.line + "; column: " + this.parser.column + ")";
            }
            throw error;
        }
    }
}

// ===== rtfjs/DocumentFacade.ts =====
interface ISettings {
    onHyperlink?(create: () => HTMLElement, hyperlink: { url: () => string }): IContainerElement;

    /**
     * Callback which is called with information about the type of picture and a function to render it.
     * The callback can then decide the output to be rendered.
     * @param isLegacy Null if the picture is the only one provided. Otherwise specifies whether the picture
     * is a legacy picture (e.g. if both an emf and a wmf version of a picture are available).
     * @param create A function which returns the result of rendering the picture.
     * @return The {HTMLElement} you want to display
     */
    onPicture?(isLegacy: null | boolean, create: () => HTMLElement): HTMLElement;

    onImport?(relUrls: string, callback: (data: {
        error?: Error, keyword?: string, blob?: ArrayBuffer,
        width?: number, height?: number
    }) => void): void;
}

class DocumentFacade {
    private _document: Document;
    private _renderer: Renderer;
    private _parsed: Promise<void>;

    constructor(blob: ArrayBuffer, settings: ISettings) {
        this._document = new Document(settings);
        this._renderer = new Renderer(this._document);
        const parser = new Parser(this._document, blob, this._renderer);
        this._parsed = parser.parse();
    }

    public metadata(): { [key: string]: any } {
        return this._document._meta;
    }

    public render(): Promise<HTMLElement[]> {
        return this._parsed
            .then(() => {
                return this._renderer.buildDom();
            }).catch((error) => {
                throw new RTFJSError(error);
            });
    }

}

const RTFJS = {
  Document: DocumentFacade,
  Error: RTFJSError,
  loggingEnabled,
};
export { RTFJS, EMFJS, WMFJS };
