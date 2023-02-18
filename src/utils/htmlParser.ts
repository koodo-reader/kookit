import {
  getTitleElement,
  handleImageMarker,
  isKeyword,
  isNodeTitle,
  isSpecialChar,
} from "./titleUtil";

class HtmlParser {
  bookStr: string;
  chapterList: any[];
  chapterDocList: any[];
  constructor(bookStr: string) {
    this.bookStr = bookStr;
    this.chapterList = [];
    this.chapterDocList = [];
  }
  getChapterDoc() {
    let tempChapterList = this.bookStr
      .split("<address> </address>")
      .filter((item) => item.trim() !== "")
      .map((item) => handleImageMarker(item));
    let chapterStrList: string[] = [];
    let titleList: string[] = [];
    let tempChapter = "";
    for (let i = 0; i < tempChapterList.length; i++) {
      let chapterDoc = new DOMParser().parseFromString(
        tempChapterList[i],
        "text/html"
      );

      if (isNodeTitle(chapterDoc)) {
        chapterStrList.push(tempChapter + tempChapterList[i]);
        tempChapter = "";
      } else {
        tempChapter += tempChapterList[i];
      }
    }
    if (chapterStrList.length === 0) {
      chapterStrList.push(tempChapter);
    }
    for (let i = 0; i < chapterStrList.length; i++) {
      let chapterDoc = new DOMParser().parseFromString(
        chapterStrList[i],
        "text/html"
      );
      let titleNodeList = getTitleElement(chapterDoc);
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
        title: firstValidTitle ? firstValidTitle.innerText : "",
        text: chapterStrList[i],
      });
      firstValidTitle && titleList.push(firstValidTitle.innerText);
    }

    return this.chapterDocList;
  }

  getChapter() {
    for (let i = 0; i < this.chapterDocList.length; i++) {
      this.chapterDocList[i].title &&
        this.chapterList.push({
          title: this.chapterDocList[i].title,
          id: "title" + i,
          href: "title" + i,
          index: i,
          subitems: [],
        });
    }
    return this.chapterList;
  }
}

export default HtmlParser;
