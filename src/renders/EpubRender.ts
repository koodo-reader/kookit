import { createIframe, handleLayout } from "../utils/layoutUtil";
import GeneralParser from "../utils/generalParser";
import { EPUB } from "../libs/epub";
import GeneralRender from "./GeneralRender";
import { getCache } from "../libs/cache.js";
import JSZip from "jszip";
class EpubRender extends GeneralRender {
  epubBuffer: ArrayBuffer;
  constructor(epubBuffer: ArrayBuffer, config: any) {
    super({ format: "EPUB", ...config });
    this.epubBuffer = epubBuffer;
  }
  renderTo(element: HTMLElement) {
    return new Promise<void>(async (resolve, reject) => {
      this.element = element;
      if (!this.book) {
        await this.parse();
      }
      let parser = new GeneralParser(this.book);
      this.chapterList = await parser.getChapter(this.book.toc);
      this.chapterDocList = await parser.getChapterDoc();
      createIframe(element);
      let doc = this.getDocument();
      if (!doc) return;
      handleLayout(element, this.readerMode, doc);
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
      console.error(error);
      throw error;
    }
  }
  async preCache() {
    try {
      if (!this.book) {
        await this.parse();
      }
      return await getCache(this.book);
    } catch (error) {
      return "";
    }
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
        return entry.async("arraybuffer");
      }
      return new ArrayBuffer(0);
    };
    const getSize = (name) => {
      return 0;
    };
    return { entries, loadText, loadBlob, getSize };
  }
  async getMetadata() {
    try {
      if (!this.book) {
        await this.parse();
      }
      let parser = new GeneralParser(this.book);
      return await parser.getMetadata();
    } catch (error) {
      console.error(error, "error");
      throw error;
    }
  }
}
export default EpubRender;
