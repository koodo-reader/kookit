import { createIframe, handleLayout } from "../utils/layoutUtil";
import GeneralParser from "../utils/generalParser";
import { EPUB } from "../libs/epub";
import GeneralRender from "./GeneralRender";
import { ZipReader, BlobReader, TextWriter, BlobWriter } from "@zip.js/zip.js";
import { getCache } from "../libs/cache.js";
class EpubRender extends GeneralRender {
  epubBuffer: ArrayBuffer;
  constructor(epubBuffer: ArrayBuffer, mode: string, animation: string) {
    super({ mode, format: "EPUB", animation });
    this.epubBuffer = epubBuffer;
  }
  renderTo(element: HTMLElement) {
    return new Promise<void>(async (resolve, reject) => {
      this.element = element;
      if (!this.book) {
        await this.parse();
      }
      console.log(this.book, "this.book");
      let parser = new GeneralParser(this.book);
      this.chapterList = await parser.getChapter(this.book.toc);
      this.chapterDocList = await parser.getChapterDoc();
      createIframe(element);
      let doc = this.getDocument();
      if (!doc) return;
      handleLayout(element, this.mode, doc);
      resolve();
    });
  }
  async parse() {
    let blob = new Blob([this.epubBuffer]);
    let file = new File([blob], "book", {
      lastModified: new Date().getTime(),
      type: blob.type,
    });
    try {
      const loader: any = await this.makeZipLoader(file);
      this.book = await new EPUB(loader).init();
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
    let reader: any;
    try {
      reader = new ZipReader(new BlobReader(file));
    } catch (error) {
      throw error;
    }
    const entries = await reader.getEntries();
    const map = new Map(entries.map((entry) => [entry.filename, entry]));
    const load =
      (f) =>
      (name, ...args) =>
        map.has(name) ? f(map.get(name), ...args) : null;
    const loadText = load((entry) => entry.getData(new TextWriter()));
    const loadBlob = load((entry, type) => {
      return new Promise<any>((resolve, reject) => {
        entry
          .getData(new BlobWriter(type))
          .then((res) => {
            resolve(res);
          })
          .catch((err) => {
            resolve(new Blob());
          });
      });
      // return entry.getData(new BlobWriter(type));
    });
    const getSize = (name) => (map.get(name) as any)?.uncompressedSize ?? 0;
    return { entries, loadText, loadBlob, getSize };
  }
  async getMetadata() {
    try {
      if (!this.book) {
        await this.parse();
      }
      console.log(this.book);
      let parser = new GeneralParser(this.book);
      return await parser.getMetadata();
    } catch (error) {
      console.log(error);
      throw error;
    }
  }
}
export default EpubRender;
