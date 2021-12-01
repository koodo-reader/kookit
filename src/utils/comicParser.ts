import _ from "underscore";
import { mimetype } from "./mimetype";

class ComicParser {
  bookStr: string;
  extension: string;
  mode: string;
  format: string;
  bookDoc: any;
  element: any;
  zip: any;
  fileNameList: string[];
  chapterList: any[];
  constructor(
    fileNameList: string[],
    zip: any,
    mode: string,
    element: any,
    format: string
  ) {
    this.fileNameList = fileNameList;
    this.zip = zip;
    this.bookStr = "";
    this.format = format;
    this.bookDoc = null;
    this.mode = mode;
    this.chapterList = [];
    this.extension = this.fileNameList[0].split(".").reverse()[0];
    this.element = element;
    this.getBookStr();
  }
  getBookStr() {
    let bookDoc = document.createElement("div");
    let scale = this.mode === "single" ? 1 : 2;

    for (let i = 0; i < this.fileNameList.length; i++) {
      let imageDom = document.createElement("img");

      imageDom.id = i + "";
      imageDom.setAttribute(
        "style",
        `width: ${
          this.mode === "scroll"
            ? this.element.clientWidth
            : (this.element.clientWidth - 88) / scale
        }px;max-height:${
          this.mode === "scroll" ? "inherit" : this.element.clientHeight
        }px`
      );
      bookDoc.appendChild(imageDom);
    }
    this.bookDoc = bookDoc;
  }
  getChapter() {
    for (let i = 0; i < this.fileNameList.length; i++) {
      this.chapterList.push({
        label: this.fileNameList[i],
        id: i + "",
        href: "#" + i,
        subitems: [],
      });
    }
    return this.chapterList;
  }
  getImgRatio() {
    this.extension = this.fileNameList[0].split(".").reverse()[0];
    return new Promise<number>(async (resolve, reject) => {
      var i = new Image();
      i.onload = function () {
        resolve(i.height / i.width);
      };
      let buffer: ArrayBuffer;
      if (this.format === "cbr") {
        buffer = this.zip.decompress(this.fileNameList[0]);
      } else if (this.format === "cbt") {
        buffer =
          this.zip[_.findLastIndex(this.zip, { name: this.fileNameList[0] })]
            .buffer;
      } else {
        buffer = await this.zip.file(this.fileNameList[0]).async("arraybuffer");
      }
      i.src =
        "data:" +
        mimetype[this.extension.toLowerCase()] +
        ";base64," +
        this.base64ArrayBuffer(buffer);
    });
  }
  renderComic() {
    window.frames[0].document.body.innerHTML = this.bookDoc.outerHTML;
  }
  async renderImage(i: number) {
    this.extension = this.fileNameList[0].split(".").reverse()[0];
    if (
      window.frames[0].document.getElementById(i + "") &&
      !(window.frames[0].document.getElementById(i + "") as any).src
    ) {
      let buffer: ArrayBuffer;
      if (this.format === "cbr") {
        buffer = this.zip.decompress(this.fileNameList[i]);
      } else if (this.format === "cbt") {
        buffer =
          this.zip[_.findLastIndex(this.zip, { name: this.fileNameList[i] })]
            .buffer;
      } else {
        buffer = await this.zip.file(this.fileNameList[i]).async("arraybuffer");
      }
      if (window.frames[0].document.getElementById(i + "")) {
        (window.frames[0].document.getElementById(i + "") as any).src =
          "data:" +
          mimetype[this.extension.toLowerCase()] +
          ";base64," +
          this.base64ArrayBuffer(buffer);
      }
    }
  }

  base64ArrayBuffer(arrayBuffer: ArrayBuffer) {
    var base64 = "";
    var encodings =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    var bytes = new Uint8Array(arrayBuffer);
    var byteLength = bytes.byteLength;
    var byteRemainder = byteLength % 3;
    var mainLength = byteLength - byteRemainder;
    var a, b, c, d;
    var chunk;
    for (var i = 0; i < mainLength; i = i + 3) {
      chunk = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
      a = (chunk & 16515072) >> 18;
      b = (chunk & 258048) >> 12; // 258048   = (2^6 - 1) << 12
      c = (chunk & 4032) >> 6; // 4032     = (2^6 - 1) << 6
      d = chunk & 63; // 63       = 2^6 - 1
      base64 += encodings[a] + encodings[b] + encodings[c] + encodings[d];
    }

    if (byteRemainder === 1) {
      chunk = bytes[mainLength];

      a = (chunk & 252) >> 2; // 252 = (2^6 - 1) << 2
      b = (chunk & 3) << 4; // 3   = 2^2 - 1
      base64 += encodings[a] + encodings[b] + "==";
    } else if (byteRemainder === 2) {
      chunk = (bytes[mainLength] << 8) | bytes[mainLength + 1];
      a = (chunk & 64512) >> 10; // 64512 = (2^6 - 1) << 10
      b = (chunk & 1008) >> 4; // 1008  = (2^6 - 1) << 4
      c = (chunk & 15) << 2; // 15    = 2^4 - 1
      base64 += encodings[a] + encodings[b] + encodings[c] + "=";
    }

    return base64;
  }
}

export default ComicParser;
