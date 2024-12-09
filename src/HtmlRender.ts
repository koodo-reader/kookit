import Chapter from "./model/chapter";
import ChapterDoc from "./model/chapterDoc";
import { createIframe, handleLayout } from "./utils/layoutUtil";
import GeneralRender from "./GeneralRender";
import { makeHtmlBook } from "./libs/html";
import GeneralParser from "./utils/generalParser";
import { mimetype } from "./utils/mimetype";
import mhtml2html from "mhtml2html";
class HtmlRender extends GeneralRender {
  htmlBuffer: ArrayBuffer;
  mode: string;
  format: string;
  chapterList: Chapter[];
  chapterDocList: ChapterDoc[];
  element: any;
  constructor(
    htmlBuffer: ArrayBuffer,
    mode: string,
    format: string,
    animation: string
  ) {
    super(mode, format, animation);
    this.htmlBuffer = htmlBuffer;
    this.mode = mode;
    this.format = format;
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
        var blob = new Blob([this.htmlBuffer], {
          type: mimetype[this.format.toLocaleLowerCase()],
        });
        var reader = new FileReader();
        reader.onload = async (evt) => {
          let html = evt.target?.result as any;
          if (this.format === "MHTML") {
            console.log(mhtml2html.convert(html));
            html =
              mhtml2html.convert(html).window.document.documentElement
                .innerHTML;
          }

          this.book = makeHtmlBook(html, false);
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
export default HtmlRender;
