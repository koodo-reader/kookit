import Chapter from "./model/chapter";
import ChapterDoc from "./model/chapterDoc";
import { createIframe, handleLayout } from "./utils/layoutUtil";
import GeneralRender from "./GeneralRender";
import { makeHtmlBook } from "./libs/html";
import GeneralParser from "./utils/generalParser";
declare var window: any;
class MdRender extends GeneralRender {
  mdBuffer: ArrayBuffer;
  mode: string;
  chapterList: Chapter[];
  chapterDocList: ChapterDoc[];
  element: any;
  constructor(
    mdBuffer: ArrayBuffer,
    mode: string,
    animation: string,
    id: string
  ) {
    super(mode, "MD", animation);
    this.mdBuffer = mdBuffer;
    this.mode = mode;
    this.chapterList = [];
    this.chapterDocList = [];
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
    return new Promise<void>((resolve, reject) => {
      try {
        var blob = new Blob([this.mdBuffer], { type: "text/plain" });
        var reader = new FileReader();
        reader.onload = async (evt) => {
          let docStr = window.marked(evt.target?.result as any);
          this.book = makeHtmlBook(docStr, false);

          resolve();
        };
        reader.readAsText(blob, "UTF-8");
      } catch (error) {
        console.log(error);
        reject(error);
      }
    });
  }
  async preCache() {
    if (!this.book) {
      await this.parse();
    }
    return await this.getCache(this.book);
  }
}
export default MdRender;
