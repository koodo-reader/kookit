import { createIframe, handleLayout } from "../utils/layoutUtil";
import GeneralRender from "./GeneralRender";
import { makeCacheBook } from "../libs/cache";
import GeneralParser from "../utils/generalParser";

class CacheRender extends GeneralRender {
  cacheBuffer: ArrayBuffer;
  constructor(cacheBuffer: ArrayBuffer, config: any) {
    super({ ...config, format: "CACHE" });
    this.cacheBuffer = cacheBuffer;
  }
  renderTo(element: HTMLElement) {
    return new Promise<void>(async (resolve, reject) => {
      this.element = element;
      this.book = await makeCacheBook(this.cacheBuffer);
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
}
export default CacheRender;
