import MobiParser from "./mobiParser";
import { isTitle, startWithDI } from "./titleUtil";

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
    this.chapterDomList = Array.from(
      this.bookDoc.querySelectorAll("h1,h2,h3,h4,font,b")
    ) as HTMLElement[];
    if (this.chapterDomList.length > 0) {
      this.insertPageBreak();
      let parser = new MobiParser(this.bookDoc.body.innerHTML);
      this.chapterDocList = parser.getChapterDoc();
      this.chapterList = parser.getChapter();
    } else {
      this.getExtraTitle();
      this.generateChapterList();
      this.insertPageBreak();
    }

    return this.chapterList;
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
  generateChapterList() {
    if (this.chapterDomList.length === 0) {
      let random = Math.floor(Math.random() * 900000) + 100000;
      this.chapterList.push({
        label: "Forword",
        id: "title" + random,
        href: "#title" + random,
        subitems: [],
      });
    }
    let titleList: string[] = [];
    for (let i = 0; i < this.chapterDomList.length; i++) {
      let random = Math.floor(Math.random() * 900000) + 100000;
      this.chapterList.push({
        label: this.chapterDomList[i]
          ? titleList.lastIndexOf(this.chapterDomList[i].innerText) === -1
            ? this.chapterDomList[i].innerText
            : titleList[
                titleList.lastIndexOf(this.chapterDomList[i].innerText)
              ] +
              "#" +
              i
          : "Forword",

        id: "title" + random,
        href: "#title" + random,
        subitems: [],
      });
      titleList.push(this.chapterList[i].label);
    }
  }
  getExtraTitle() {
    let isStartWithKeyword = false;

    if (this.chapterDomList.length === 0) {
      this.chapterDomList = Array.from(
        this.bookDoc.getElementsByTagName("p")
      ).filter((item) => {
        if (
          !isStartWithKeyword &&
          ((item.innerText.trim().startsWith("第") &&
            startWithDI(item.innerText.trim())) ||
            item.innerText.trim().startsWith("Chapter") ||
            item.innerText.trim().startsWith("CHAPTER"))
        ) {
          isStartWithKeyword = true;
        }
        return isTitle(item.innerText.trim(), isStartWithKeyword);
      });
    }
  }
  getChapterDoc() {
    if (this.chapterDocList.length > 0) {
      return this.chapterDocList;
    }
    let chapterStrList: string[] = this.bookDoc.body.innerHTML
      .split("<address> </address>")
      .filter((item) => item.trim() !== "");
    for (let i = 0; i < chapterStrList.length; i++) {
      if (chapterStrList.length > this.chapterList.length && i === 0) {
        let random = Math.floor(Math.random() * 900000) + 100000;
        this.chapterList.unshift({
          label: "Forword" + "#" + i,
          id: "title" + random,
          href: "#title" + random,
          subitems: [],
        });
      }
      this.chapterDocList.push({
        title: this.chapterList[i].label,
        text: chapterStrList[i],
      });
    }
    return this.chapterDocList;
  }
}

export default StrParser;
