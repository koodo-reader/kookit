import HtmlParser from "./htmlParser";
import { getTitleElement } from "./titleUtil";

class StrParser {
  bookStr: string;
  bookDoc: HTMLDocument;
  chapterList: any[];
  chapterDocList: any[];
  chapterDomList: any[];
  constructor(bookStr: string) {
    this.bookStr = bookStr;
    this.chapterList = [];
    this.chapterDocList = [];
    this.bookDoc = new DOMParser().parseFromString(this.bookStr, "text/html");
    this.chapterDomList = [];
  }
  getChapter() {
    this.chapterDomList = getTitleElement(this.bookDoc);
    this.insertPageBreak();
    let parser = new HtmlParser(this.bookDoc.body.innerHTML);
    this.chapterDocList = parser.getChapterDoc();
    this.chapterList = parser.getChapter();
    return this.chapterList;
  }
  getDocText() {
    return this.bookDoc.body.textContent || "";
  }
  isContainChapter() {
    this.chapterDomList = getTitleElement(this.bookDoc);
    if (this.chapterDomList.length > 0) {
      return true;
    } else {
      return false;
    }
  }
  insertPageBreak() {
    for (let i = 0; i < this.chapterDomList.length; i++) {
      // this.chapterDomList[i].id = this.chapterList[i].id;
      var newItem = document.createElement("address");
      var textnode = document.createTextNode(" ");
      newItem.appendChild(textnode);

      this.chapterDomList[i].parentNode &&
        this.chapterDomList[i].parentNode.insertBefore(
          newItem,
          this.chapterDomList[i]
        );
    }
  }
  getChapterDoc() {
    return this.chapterDocList;
  }
}

export default StrParser;
