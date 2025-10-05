import { createIframe, handleLayout } from "../utils/layoutUtil";
import GeneralParser from "../utils/generalParser";
import { isMOBI, MOBI } from "../libs/mobi.js";
import GeneralRender from "./GeneralRender";
import { unzlibSync } from "fflate";
import { getCache } from "../libs/cache.js";
class MobiRender extends GeneralRender {
  mobiBuffer: ArrayBuffer;
  constructor(mobiBuffer: ArrayBuffer, config: any) {
    super({ ...config, format: "MOBI" });
    this.mobiBuffer = mobiBuffer;
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
  async resolveHref(href: string) {
    let chapterDocIndex = this.tempLocation.chapterDocIndex;
    let chapterDoc = this.chapterDocList[chapterDocIndex];
    if (chapterDoc) {
      let result = await chapterDoc.text.resolveHref(href);
      if (!result) return {};
      if (result.index === parseInt(chapterDocIndex)) {
        let doc = this.getDocument();
        if (!doc) return result;
        let element = result.anchor(doc);
        if (!element) return result;
        let id = element.getAttribute("id") || "";
        return { ...result, id };
      }
      return result;
    }
    return {};
  }
  async parse() {
    try {
      let blob = new Blob([this.mobiBuffer]);
      let file = new File([blob], "book", {
        lastModified: new Date().getTime(),
        type: blob.type,
      });
      if (await isMOBI(file)) {
        this.book = await new MOBI({ unzlib: unzlibSync }).open(file);
      } else {
        throw new Error("Not a valid MOBI file");
      }
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
  async preCache() {
    if (!this.book) {
      await this.parse();
    }
    return await getCache(this.book);
  }
  async getMetadata() {
    try {
      if (!this.book) {
        await this.parse();
      }
      let parser = new GeneralParser(this.book);
      return await parser.getMetadata();
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
}
export default MobiRender;
