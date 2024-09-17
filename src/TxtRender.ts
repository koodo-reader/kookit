import Chapter from "./model/chapter";
import ChapterDoc from "./model/chapterDoc";
import { createIframe, handleLayout } from "./utils/layoutUtil";
import GeneralRender from "./GeneralRender";
import { makeHtmlBook } from "./libs/html";
import GeneralParser from "./utils/generalParser";
import chardet from "chardet";
declare var window: any;
class TxtRender extends GeneralRender {
  text: string;
  encoding: string;
  bookStr: string;
  mode: string;
  book: any;
  chapterList: Chapter[];
  chapterDocList: ChapterDoc[];
  element: any;
  constructor(text: string, mode: string, encoding: string, animation: string) {
    super(mode, "TXT", animation);
    this.text = text;
    this.encoding = encoding;
    this.mode = mode;
    this.chapterList = [];
    this.chapterDocList = [];
    this.bookStr = "";
    this.element = "";
    this.book = "";
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
      this.book = makeHtmlBook(this.text, true);
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

  async getMetadata(txtBuffer) {
    try {
      const array = new Uint8Array(txtBuffer);
      let charset = chardet.detect(array);
      return { charset: charset || "utf8" };
    } catch (error) {
      console.log(error);
      throw error;
    }
  }
}

export default TxtRender;
