import Chapter from "../model/chapter";
import ChapterDoc from "../model/chapterDoc";
import { createIframe, handleLayout } from "../utils/layoutUtil";
import GeneralRender from "./GeneralRender";
import { makeCacheBook } from "../libs/cache-mobile";
import GeneralParser from "../utils/generalParser";

class MobileRender extends GeneralRender {
  toc: any[];
  sections: any[];
  constructor(toc: any[], sections: any[], mode: string, animation: string) {
    super(mode, "CACHE", animation);
    this.toc = toc;
    this.sections = sections;
  }
  renderTo(element: HTMLElement) {
    return new Promise<void>(async (resolve, reject) => {
      this.element = element;
      this.book = await makeCacheBook(this.toc, this.sections);
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
}
export default MobileRender;
