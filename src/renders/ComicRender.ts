import Chapter from "../model/chapter";
import ChapterDoc from "../model/chapterDoc";
import { createIframe, handleLayout } from "../utils/layoutUtil";
import GeneralParser from "../utils/generalParser";
import { makeComicBook } from "../libs/comic-book";
import GeneralRender from "./GeneralRender";
import untar from "js-untar";
import { ZipReader, BlobReader, TextWriter, BlobWriter } from "@zip.js/zip.js";
import { getCache } from "../libs/cache.js";
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
      createIframe(element);
      if (!this.book) {
        try {
          await this.parse();
        } catch (error) {
          console.log(error);
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
      if (this.format === "CBZ") {
        const loader: any = await this.makeZipLoader(file);
        this.book = makeComicBook(loader, file, this.readerMode);
      } else if (this.format === "CBT") {
        const loader: any = await this.makeTarLoader();
        this.book = makeComicBook(loader, file, this.readerMode);
      } else if (this.format === "CBR") {
        this.rpc = await window.RPC.new("./lib/libunrar/worker.js", {
          loaded: function () {
            console.log("loaded");
          },
          progressShow: function (fileName, fileSize, progress) {
            console.log(progress);
          },
        });
        await new Promise((r) => setTimeout(r, 200));
        const loader: any = await this.makeRarLoader();
        this.book = makeComicBook(loader, file, this.readerMode);
      } else if (this.format === "CB7") {
        const loader: any = await this.make7zLoader();
        this.book = makeComicBook(loader, file, this.readerMode);
      }
    } catch (error) {
      console.log(error);
      throw error;
    }
  }
  async preCache() {
    if (!this.book) {
      await this.parse();
    }
    return await getCache(this.book);
  }
  async makeZipLoader(file) {
    const reader = new ZipReader(new BlobReader(file));
    const entries = await reader.getEntries();
    const map = new Map(entries.map((entry) => [entry.filename, entry]));
    const load =
      (f) =>
      (name, ...args) =>
        map.has(name) ? f(map.get(name), ...args) : null;
    const loadText = load((entry) => entry.getData(new TextWriter()));
    const loadBlob = load((entry, type) => entry.getData(new BlobWriter(type)));
    const getSize = (name) => (map.get(name) as any)?.uncompressedSize ?? 0;
    return { entries, loadText, loadBlob, getSize };
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
    const getSize = (name) => (map.get(name) as any)?.size ?? 0;
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
          const getSize = (name) => (map.get(name) as any)?.fileSize ?? 0;
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
          reject(err);
          console.log(err);
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
    const getSize = (name) => (map.get(name) as any)?.packSize ?? 0;
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
        console.log(error);
        reject(error);
      }
    });
  }
}
export default ComicRender;
