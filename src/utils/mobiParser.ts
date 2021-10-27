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
    let chapterList = this.bookStr.split("<mbp:pagebreak>");
    let chapterObj: { title: string; text: string }[] = [];
    let titleList: string[] = [];
    let count = 0;
    for (let i = 0; i < chapterList.length; i++) {
      let random = Math.floor(Math.random() * 900000) + 100000;
      let chapterDoc = new DOMParser().parseFromString(
        chapterList[i],
        "text/html"
      );
      if (
        chapterDoc.body.innerText.trim() ||
        chapterDoc.getElementsByTagName("img").length > 0
      ) {
        let firstValidTitle;
        let firstValidText;
        let validTitleNodeList = chapterDoc.querySelectorAll(
          "h1,h2,h3,h4,blockquote,font,b"
        );
        let validTextNodeList = chapterDoc.querySelectorAll("p");
        for (let i = 0; i < validTitleNodeList.length; i++) {
          if ((validTitleNodeList[i] as HTMLElement).innerText.trim()) {
            if (
              titleList.indexOf(
                (validTitleNodeList[i] as HTMLElement).innerText
              ) === -1
            ) {
              firstValidTitle = (validTitleNodeList[i] as HTMLElement)
                .innerText;
            } else {
              firstValidTitle =
                (validTitleNodeList[i] as HTMLElement).innerText + "-" + count;
              count++;
            }
            break;
          }
        }
        for (let i = 0; i < validTextNodeList.length; i++) {
          if ((validTextNodeList[i] as HTMLElement).innerText.trim()) {
            firstValidText = (validTextNodeList[i] as HTMLElement).innerText;

            break;
          }
        }

        chapterObj.push({
          title: firstValidTitle
            ? firstValidTitle
            : firstValidText
            ? firstValidText
            : (chapterDoc.getElementsByTagName("img")[0] as any)
            ? "image" +
              (chapterDoc.getElementsByTagName("img")[0] as any).getAttribute(
                "recindex"
              )
            : "Chapter" + random,
          text: chapterList[i],
        });
        titleList.push(chapterObj[i].title);
      }
    }
    this.chapterDocList = chapterObj;
    return this.chapterDocList;
  }

  getChapter() {
    for (let i = 0; i < this.chapterDocList.length; i++) {
      let random = Math.floor(Math.random() * 900000) + 100000;
      this.chapterList.push({
        label: this.chapterDocList[i].title,
        id: "title" + random,
        href: "#title" + random,
        subitems: [],
      });
    }
    // console.log(object)
    return this.chapterList;
  }
}

export default MobiParser;
