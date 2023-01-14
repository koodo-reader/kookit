import Chapter from "../model/chapter";
import ChapterDoc from "../model/chapterDom";

class Parser {
  book: any;
  chapterList: Chapter[];
  chapterDocList: ChapterDoc[];
  constructor(book: any) {
    this.book = book;
    this.chapterList = [];
    this.chapterDocList = [];
  }
  async getChapterDoc() {
    let sectionDocList: any[] = await Promise.all(
      this.book.sections.map(async (item) => {
        return item.load ? await item.load() : "";
      })
    );

    const chapterIndexList = this.chapterList.map((item) => item.index);
    return sectionDocList.map((item: string, index: number) => {
      if (chapterIndexList.indexOf(index) > -1) {
        return {
          title: this.chapterList[chapterIndexList.indexOf(index)].label,
          text: item,
        };
      } else {
        return {
          title: "",
          text: item,
        };
      }
    }) as ChapterDoc[];
  }

  async getChapter() {
    for (let i = 0; i < this.book.toc.length; i++) {
      let random = Math.floor(Math.random() * 900000) + 100000;
      let index = this.book.resolveHref
        ? this.book.resolveHref(this.book.toc[i].href).index
        : (await this.book.toc[i].index).index;
      this.chapterList.push({
        label: this.book.toc[i].label,
        id: "title" + random,
        href: "title" + random,
        index: index,
        subitems: [],
      });
    }
    return this.chapterList;
  }
  getMetadata() {
    return new Promise<any>(async (resolve, reject) => {
      const metadata = this.book.metadata;
      console.log(metadata);
      try {
        const blob = await this.book.getCover();
        console.log(blob);
        var reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          resolve({
            name: metadata.title,
            author: metadata.author[0].name,
            description: metadata.description,
            publisher: metadata.publisher,
            cover: reader.result,
          });
        };
      } catch (error) {
        resolve({
          name: metadata.title,
          author: metadata.author.join(", "),
          description: metadata.description,
          publisher: metadata.publisher,
          cover: "",
        });
      }
    });
  }
}

export default Parser;
