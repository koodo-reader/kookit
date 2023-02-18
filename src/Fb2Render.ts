import Chapter from "./model/chapter";
import ChapterDoc from "./model/chapterDoc";
import { createIframe, handleLayout } from "./utils/layoutUtil";
import GeneralParser from "./utils/generalParser";
import { makeFB2 } from "./libs/fb2";
import GeneralRender from "./GeneralRender";

class Fb2Render extends GeneralRender {
  fb2Buffer: ArrayBuffer;
  mode: string;
  book: any;
  chapterList: Chapter[];
  chapterDocList: ChapterDoc[];
  element: any;
  constructor(fb2Buffer: ArrayBuffer, mode: string) {
    super(mode);
    this.fb2Buffer = fb2Buffer;
    this.mode = mode;
    this.chapterList = [];
    this.chapterDocList = [];
    this.book = "";
    this.element = "";
  }
  renderTo(element: HTMLElement) {
    return new Promise<void>(async (resolve, reject) => {
      let blob = new Blob([this.fb2Buffer]);
      this.book = await makeFB2(blob);
      let parser = new GeneralParser(this.book);
      this.element = element;

      this.chapterList = await parser.getChapter(this.book.toc);
      this.chapterDocList = await parser.getChapterDoc();
      createIframe(element);

      handleLayout(element, this.mode);
      this.trigger("rendered");
      resolve();
    });
  }
  async getMetadata() {
    let blob = new Blob([this.fb2Buffer]);
    this.book = await makeFB2(blob);
    let parser = new GeneralParser(this.book);
    return await parser.getMetadata();
  }
}
export default Fb2Render;
