import Chapter from "../model/chapter";
import ChapterDoc from "../model/chapterDoc";
import { createIframe, handleLayout } from "../utils/layoutUtil";
import GeneralRender from "./GeneralRender";
import { makeHtmlBook } from "../libs/html";
import GeneralParser from "../utils/generalParser";
import chardet from "chardet";
import { getCache } from "../libs/cache.js";
class TxtRender extends GeneralRender {
  text: string;
  constructor(text: string, mode: string, animation: string) {
    super(mode, "TXT", animation);
    this.text = text;
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
      handleLayout(element, this.mode, doc);
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
    return await getCache(this.book);
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
