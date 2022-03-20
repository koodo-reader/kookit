class TxtParser {
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
    let titleList: string[] = [];
    this.chapterDomList = Array.from(
      this.bookDoc.getElementsByTagName("h1")
    ) as HTMLElement[];
    for (let i = 0; i < this.chapterDomList.length; i++) {
      let random = Math.floor(Math.random() * 900000) + 100000;
      this.chapterList.push({
        label: this.chapterDomList[i]
          ? titleList.lastIndexOf(this.chapterDomList[i].innerText) === -1
            ? this.chapterDomList[i].innerText
            : titleList[
                titleList.lastIndexOf(this.chapterDomList[i].innerText)
              ] + i
          : "Forword",

        id: "title" + random,
        href: "title" + random,
        subitems: [],
      });
      titleList.push(this.chapterList[i].label);
    }
    for (let i = 0; i < this.chapterDomList.length; i++) {
      this.chapterDomList[i].id = this.chapterList[i].id;
      var newItem = document.createElement("span");
      var textnode = document.createTextNode("pagebreak");
      newItem.appendChild(textnode);
      this.chapterDomList[i].parentNode!.insertBefore(
        newItem,
        this.chapterDomList[i]
      );
    }

    return this.chapterList;
  }

  getChapterDoc() {
    let chapterStrList: string[] = this.bookDoc.body.innerHTML
      .split("<span>pagebreak</span>")
      .filter((item) => item.trim());
    for (let i = 0; i < chapterStrList.length; i++) {
      if (chapterStrList.length > this.chapterList.length && i === 0) {
        let random = Math.floor(Math.random() * 900000) + 100000;
        this.chapterList.unshift({
          label: "Forword" + "#" + i,
          id: "title" + random,
          href: "title" + random,
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

export default TxtParser;
