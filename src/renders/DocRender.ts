import { createIframe, handleLayout } from "../utils/layoutUtil";
import GeneralRender from "./GeneralRender";
import { makeHtmlBook } from "../libs/html";
import GeneralParser from "../utils/generalParser";
import { defaultMsDocCss, parseMsDoc, renderMsDoc } from "../libs/doc";
import { getCache } from "../libs/cache.js";
class DocRender extends GeneralRender {
  docBuffer: ArrayBuffer;
  constructor(docBuffer: ArrayBuffer, config: any) {
    super({ ...config, format: "DOC" });
    this.docBuffer = docBuffer;
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
      createIframe(element, this.isAllowScript);
      let doc = this.getDocument();
      if (!doc) return;
      handleLayout(element, this.readerMode, doc);
      resolve();
    });
  }
  async parse() {
    // .doc 为二进制格式，解析是同步的耗时操作，先让出一帧再解析，
    // 避免移动端 WebView 在解析大文档时直接卡死（与 rtf/djvu 的分片思路一致）
    await new Promise((resolve) => setTimeout(resolve, 0));
    try {
      const parsed = parseMsDoc(this.docBuffer);
      const rendered = renderMsDoc(parsed);
      // 解析产出的 HTML 只含结构样式（无头样式表），头部补上内置 CSS，
      // 章节 HTML 会被写入 iframe body，style 标签随章节内容生效
      this.book = makeHtmlBook(
        `<style>${defaultMsDocCss()}</style><div class="msdoc-root">${
          rendered.html
        }</div>`,
        false
      );
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
}
export default DocRender;
