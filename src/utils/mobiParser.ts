import { isKeyword, isNodeTitle, isSpecialChar } from "./titleUtil";

class MobiParser {
  bookStr: string;
  chapterList: any[];
  chapterDocList: any[];
  constructor(bookStr: string) {
    this.bookStr = bookStr;
    this.chapterList = [];
    this.chapterDocList = [];
  }
  getChapterDoc() {
    let tempChapterList =
      this.bookStr.indexOf("<mbp:pagebreak>") > -1
        ? this.bookStr
            .split("<mbp:pagebreak>")
            .filter((item) => item.trim() !== "")
        : this.bookStr
            .split("<address> </address>")
            .filter((item) => item.trim() !== "");
    let chapterList: string[] = [];
    let titleList: string[] = [];
    let tempChapter = "";
    for (let i = 0; i < tempChapterList.length; i++) {
      let chapterDoc = new DOMParser().parseFromString(
        tempChapterList[i],
        "text/html"
      );

      if (isNodeTitle(chapterDoc)) {
        chapterList.push(tempChapter + tempChapterList[i]);
        tempChapter = "";
      } else {
        tempChapter += tempChapterList[i];
      }
    }
    if (chapterList.length === 0) {
      chapterList.push(tempChapter);
    }
    for (let i = 0; i < chapterList.length; i++) {
      let chapterDoc = new DOMParser().parseFromString(
        chapterList[i],
        "text/html"
      );
      let titleNodeList = chapterDoc.querySelectorAll(
        "h1,h2,h3,h4,blockquote,font,b"
      );
      let firstValidTitle: any;

      for (let i = 0; i < titleNodeList.length; i++) {
        if (
          (titleNodeList[i] as HTMLElement).innerText.trim() &&
          !isSpecialChar((titleNodeList[i] as HTMLElement).innerText) &&
          !isKeyword((titleNodeList[i] as HTMLElement).innerText)
        ) {
          firstValidTitle = titleNodeList[i] as HTMLElement;
          break;
        }
      }

      this.chapterDocList.push({
        title: firstValidTitle
          ? titleList.indexOf(firstValidTitle.innerText) === -1
            ? firstValidTitle.innerText
            : firstValidTitle.innerText + "#" + i
          : "Forword",
        text: chapterList[i],
      });
      firstValidTitle && titleList.push(firstValidTitle.innerText);
    }

    return this.chapterDocList;
  }

  getChapter() {
    for (let i = 0; i < this.chapterDocList.length; i++) {
      let random = Math.floor(Math.random() * 900000) + 100000;
      this.chapterList.push({
        label: this.chapterDocList[i].title,
        id: "title" + random,
        href: "title" + random,
        subitems: [],
      });
    }
    return this.chapterList;
  }
}

export default MobiParser;
