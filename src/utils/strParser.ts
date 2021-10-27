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
    let isStartWithKeyword = false;
    let titleList: string[] = [];
    let count = 0;
    console.log(this.chapterDomList);
    if (this.chapterDomList.length === 0) {
      this.chapterDomList = Array.from(
        this.bookDoc.querySelectorAll("p")
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
    console.log(this.bookDoc);
    if (this.chapterDomList.length === 0) {
      let random = Math.floor(Math.random() * 900000) + 100000;
      this.chapterList.push({
        label: "Forword",

        id: "title" + random,
        href: "#title" + random,
        subitems: [],
      });
    }
    for (let i = 0; i < this.chapterDomList.length; i++) {
      let random = Math.floor(Math.random() * 900000) + 100000;
      this.chapterList.push({
        label: this.chapterDomList[i]
          ? titleList.lastIndexOf(this.chapterDomList[i].innerText) === -1
            ? this.chapterDomList[i].innerText
            : titleList[
                titleList.lastIndexOf(this.chapterDomList[i].innerText)
              ] + "-1"
          : "Forword",

        id: "title" + random,
        href: "#title" + random,
        subitems: [],
      });
      titleList.push(this.chapterList[i].label);
    }
    for (let i = 0; i < this.chapterDomList.length; i++) {
      this.chapterDomList[i].id = this.chapterList[i].id;
      var newItem = document.createElement("span");
      var textnode = document.createTextNode("pagebreak");
      newItem.appendChild(textnode);

      this.chapterDomList[i].parentNode &&
        this.chapterDomList[i].parentNode.insertBefore(
          newItem,
          this.chapterDomList[i]
        );
    }

    return this.chapterList;
  }

  getChapterDoc() {
    let chapterStrList: string[] = this.bookDoc.body.innerHTML.split(
      "<span>pagebreak</span>"
    );
    console.log(chapterStrList, "chapterStrList");
    let chapterObj: { title: string; text: string }[] = [];
    for (let i = 0; i < chapterStrList.length; i++) {
      if (chapterStrList.length === this.chapterList.length) {
        chapterObj.push({
          title: this.chapterList[i].label,
          text: chapterStrList[i] || this.bookStr,
        });
      } else {
        if (i === 0) {
          console.log(this.bookStr);
          chapterObj.push({
            title: "Forword",
            text: chapterStrList[i] || this.bookStr,
          });
        } else {
          chapterObj.push({
            title: this.chapterList[i - 1].label,
            text: chapterStrList[i],
          });
        }
      }
    }
    return chapterObj;
  }
}

export default StrParser;
