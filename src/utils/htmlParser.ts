import { isTitle } from "./titleUtil";

class HtmlParser {
  bookStr: string;
  contentList: any[];
  contentDoc: any[];
  constructor(bookStr: string) {
    this.bookStr = bookStr;
    this.contentList = [];
    this.contentDoc = [];
  }
  getContent() {
    let bookDoc = new DOMParser().parseFromString(this.bookStr, "text/html");
    let contentElement = Array.from(
      bookDoc.querySelectorAll("h1,h2,h3,h4,h5,b,font")
    ).filter((item) => isTitle((item as HTMLElement).innerText.trim()));

    for (let i = 0; i < this.contentList.length; i++) {
      let random = Math.floor(Math.random() * 900000) + 100000;
      this.contentList.push({
        label: (contentElement[i] as HTMLElement).innerText,
        id: "title" + random,
        href: "#title" + random,
        subitems: [],
      });
    }
    return this.contentList.filter((item, index) => {
      if (index > 0) {
        return item.innerText !== this.contentList[index - 1].innerText;
      } else {
        return true;
      }
    });
  }

  getChapterDoc(bookStr: string) {
    let content = this.contentList.map((item) => item.label);
    if (content.length === 0) return [bookStr];
    let chapterDoc: string[] = [];
    let chapterStr = "";

    for (let i = 0; i < content.length; i++) {
      if (!bookStr) return;
      chapterStr = bookStr.split(content[i].id)[0];
      bookStr =
        chapterStr.substring(chapterStr.lastIndexOf("<")) +
        content[i].id +
        bookStr.split(content[i].id)[1];

      chapterDoc.push(chapterStr.substring(0, chapterStr.lastIndexOf("<")));
      if (i === content.length - 1) {
        chapterDoc.push(bookStr);
      }
    }
    return chapterDoc;
  }
}

export default HtmlParser;
