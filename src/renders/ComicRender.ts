import Chapter from "../model/chapter";
import ChapterDoc from "../model/chapterDoc";
import { createIframe, handleLayout } from "../utils/layoutUtil";
import GeneralParser from "../utils/generalParser";
import { makeComicBook } from "../libs/comic-book";
import GeneralRender from "./GeneralRender";
import untar from "js-untar";
import { getCache } from "../libs/cache.js";
import JSZip from "jszip";
declare var window: any;

class ComicRender extends GeneralRender {
  comicBuffer: ArrayBuffer;
  readerMode: string;
  book: any;
  format: string;
  chapterList: Chapter[];
  chapterDocList: ChapterDoc[];
  element: any;
  rpc: any;
  constructor(comicBuffer: ArrayBuffer, config: any) {
    super(config);
    this.comicBuffer = comicBuffer;
    this.readerMode = config.readerMode;
    this.format = config.format;
    this.chapterList = [];
    this.chapterDocList = [];
    this.book = "";
    this.element = "";
    this.rpc;
  }
  renderTo(element: HTMLElement) {
    return new Promise<void>(async (resolve, reject) => {
      this.element = element;
      createIframe(element, this.isAllowScript);
      if (!this.book) {
        try {
          await this.parse();
        } catch (error) {
          console.error(error);
          reject(error);
        }
      }
      let parser = new GeneralParser(this.book);
      this.chapterList = await parser.getChapter(this.book.toc);
      this.chapterDocList = await parser.getChapterDoc();
      let doc = this.getDocument();
      if (!doc) return;
      handleLayout(element, this.readerMode, doc);
      resolve();
    });
  }
  async parse() {
    try {
      let blob = new Blob([this.comicBuffer]);
      let file = new File([blob], "book." + this.format.toLocaleLowerCase(), {
        lastModified: new Date().getTime(),
        type: blob.type,
      });
      const archiveType = this.detectArchiveType();
      if (archiveType === "zip") {
        const loader: any = await this.makeZipLoader(file);
        this.book = makeComicBook(loader, file, this.readerMode);
      } else if (archiveType === "tar") {
        const loader: any = await this.makeTarLoader();
        this.book = makeComicBook(loader, file, this.readerMode);
      } else if (archiveType === "rar") {
        this.rpc = await window.RPC.new("./lib/libunrar/worker.js", {
          loaded: function () {
            console.info("loaded");
          },
          progressShow: function (fileName, fileSize, progress) {
            console.info(progress);
          },
        });
        await new Promise((r) => setTimeout(r, 200));
        const loader: any = await this.makeRarLoader();
        this.book = makeComicBook(loader, file, this.readerMode);
      } else if (archiveType === "7z") {
        const loader: any = await this.make7zLoader();
        this.book = makeComicBook(loader, file, this.readerMode);
      }
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
  /**
   * 通过文件魔数判断真实压缩格式，而非依赖文件扩展名。
   * 很多漫画文件被改名（如实际是 zip 却命名为 .cbr），需从内容本身判定。
   */
  detectArchiveType() {
    const bytes = new Uint8Array(this.comicBuffer);
    if (bytes.length < 4) {
      // 无法探测则回退到扩展名
      return this.format.toLocaleLowerCase();
    }
    // ZIP: PK\x03\x04
    if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
      const sig = [bytes[2], bytes[3]];
      // 空 zip、常规 zip
      if (
        (sig[0] === 0x03 && sig[1] === 0x04) ||
        (sig[0] === 0x05 && sig[1] === 0x06) ||
        (sig[0] === 0x07 && sig[1] === 0x08)
      ) {
        return "zip";
      }
    }
    // RAR4: "Rar!\x1a\x07\x00"; RAR5: "Rar!\x1a\x07\x01\x00"
    if (
      bytes[0] === 0x52 &&
      bytes[1] === 0x61 &&
      bytes[2] === 0x72 &&
      bytes[3] === 0x21
    ) {
      return "rar";
    }
    // 7z: "7z\xbc\xaf\x27\x1c"
    if (
      bytes[0] === 0x37 &&
      bytes[1] === 0x7a &&
      bytes[2] === 0xbc &&
      bytes[3] === 0xaf
    ) {
      return "7z";
    }
    // tar: 传统 USTAR POSIX 头在偏移 257 处为 "ustar"。也检查其他 tar 变体。
    if (
      this.comicBuffer.byteLength >= 265 &&
      new TextDecoder("utf8")
        .decode(new Uint8Array(this.comicBuffer, 257, 5)) === "ustar"
    ) {
      return "tar";
    }
    // 未知格式，回退到扩展名
    return this.format.toLocaleLowerCase();
  }
  async preCache() {
    if (!this.book) {
      await this.parse();
    }
    return await getCache(this.book);
  }
  async makeZipLoader(file) {
    let zip = await JSZip.loadAsync(file);
    const entries = zip.files;
    const loadText = async (name) => {
      let entry = zip.file(name);
      if (entry) {
        return entry.async("string");
      }
      return "";
    };
    const loadBlob = async (name) => {
      let entry = zip.file(name);
      if (entry) {
        let buffer = await entry.async("arraybuffer");
        return new Blob([buffer]);
      }
      return new Blob([new ArrayBuffer(0)]);
    };
    const getSize = (name) => {
      let entry: any = zip.file(name);
      if (entry) {
        return entry._data.uncompressedSize || 1;
      }
    };
    return {
      entries: Object.values(entries).map((item) => {
        return { filename: item.name };
      }),
      loadText,
      loadBlob,
      getSize,
    };
  }
  async makeTarLoader() {
    const entries = await untar(this.comicBuffer);
    const map = new Map(entries.map((entry) => [entry.name, entry]));
    const load =
      (f) =>
      (name, ...args) =>
        map.has(name) ? f(map.get(name), ...args) : null;
    const loadText = load((entry) => entry.readAsString());
    const loadBlob = load((entry, type) => entry.blob);
    const getSize = (name) => (map.get(name) as any)?.size ?? 1;
    return {
      entries: entries.map((item) => {
        return { filename: item.name };
      }),
      loadText,
      loadBlob,
      getSize,
    };
  }
  async makeRarLoader() {
    return new Promise<any>((resolve, reject) => {
      var buffers = [this.comicBuffer];
      var dataToPass = [{ name: "book.rar", content: this.comicBuffer }];
      var password = null;
      this.rpc.transferables = buffers;

      this.rpc
        .unrar(dataToPass, password, 0)
        .then((ret) => {
          let entries = this.getRarEntries(ret.ls);
          const map = new Map(
            Object.values(entries).map((entry: any) => [
              entry.fullFileName,
              entry,
            ])
          );
          const load =
            (f) =>
            (name, ...args) =>
              map.has(name) ? f(map.get(name), ...args) : null;
          const loadText = load((entry) => entry.fullFileName);
          const loadBlob = load((entry, type) => new Blob([entry.fileContent]));
          const getSize = (name) => (map.get(name) as any)?.fileSize ?? 1;
          resolve({
            entries: Object.values(entries).map((item: any) => {
              return { filename: item.fullFileName };
            }),
            loadText,
            loadBlob,
            getSize,
          });
        })
        .catch((err) => {
          console.error(err);
          reject(err);
        });
    });
  }
  async make7zLoader() {
    const wasmBinaryFile = "./lib/7z-wasm/7zz.wasm";
    if (!window.wasmBinary) {
      const response = await fetch(wasmBinaryFile, {
        credentials: "same-origin",
      });
      if (!response["ok"]) {
        throw "failed to load wasm binary file at '" + wasmBinaryFile + "'";
      }
      window.wasmBinary = await response["arrayBuffer"]();
    }
    const sevenZip = await window.SevenZip({
      wasmBinary: window.wasmBinary,
    });

    const archiveData = new Uint8Array(this.comicBuffer);
    const archiveName = "archive.cb7";

    const stream = sevenZip.FS.open(archiveName, "w+");
    sevenZip.FS.write(stream, archiveData, 0, archiveData.length);
    sevenZip.FS.close(stream);
    sevenZip.callMain(["x", archiveName]);
    const loader = sevenZip.FS;
    const entries = this.get7zEntries(loader.lookupPath("/").node);
    const map = new Map(entries.map((entry) => [entry.name, entry]));
    const load =
      (f) =>
      (name, ...args) =>
        map.has(name) ? f(map.get(name), ...args) : null;
    const loadText = load((entry) => entry.name);
    const loadBlob = load((entry, type) => new Blob([entry.buffer]));
    const getSize = (name) => (map.get(name) as any)?.size ?? 1;
    return {
      entries: entries.map((item) => {
        return { filename: item.name };
      }),
      loadText,
      loadBlob,
      getSize,
    };
  }
  getRarEntries(Node) {
    const list = Object.keys(Node);
    let entries: any = [];
    for (let index = 0; index < list.length; index++) {
      const item = list[index];
      if (Node[item].type === "dir") {
        entries = entries.concat(this.getRarEntries(Node[item].ls));
      } else {
        entries.push({
          fullFileName: item,
          fileContent: Node[item].fileContent,
          fileSize: Node[item].fileSize,
        });
      }
    }
    return entries;
  }
  get7zEntries(FSNode: any) {
    const contents = FSNode.contents;
    const list = Object.keys(contents).filter((item) => {
      return (
        item != "archive.cb7" &&
        item != "dev" &&
        item != "home" &&
        item != "proc" &&
        item != "tmp"
      );
    });
    let entries: any = [];
    for (let index = 0; index < list.length; index++) {
      const item = list[index];
      if (contents[item].isFolder) {
        entries = entries.concat(this.get7zEntries(contents[item]));
      } else {
        entries.push({
          name: item,
          buffer: contents[item].contents,
          size: contents[item].usedBytes,
        });
      }
    }
    return entries;
  }
  async getMetadata() {
    return new Promise<any>(async (resolve, reject) => {
      try {
        if (!this.book) {
          await this.parse();
        }

        const coverBlob = await this.book.getCover();
        var reader = new FileReader();
        reader.readAsDataURL(coverBlob);
        reader.onloadend = () => {
          resolve({
            cover: reader.result,
          });
        };
      } catch (error) {
        console.error(error);
        reject(error);
      }
    });
  }
}
export default ComicRender;
