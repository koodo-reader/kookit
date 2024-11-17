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
  constructor(fb2Buffer: ArrayBuffer, mode: string, animation: string) {
    super(mode, "FB2", animation);
    this.fb2Buffer = fb2Buffer;
    this.mode = mode;
    this.chapterList = [];
    this.chapterDocList = [];
    this.book = "";
    this.element = "";
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

      handleLayout(element, this.mode);
      resolve();
    });
  }
  async parse() {
    try {
      let blob = new Blob([this.fb2Buffer]);
      this.book = await makeFB2(blob);
    } catch (error) {
      console.log(error);
      throw error;
    }
  }
  async preCache() {
    if (!this.book) {
      await this.parse();
    }
    return await this.getCache(this.book);
  }
  async getMetadata() {
    try {
      if (!this.book) {
        await this.parse();
      }
      let parser = new GeneralParser(this.book);
      return await parser.getMetadata();
    } catch (error) {
      console.log(error);
      throw error;
    }
  }
}
export default Fb2Render;
