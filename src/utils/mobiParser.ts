import Chapter from "../model/chapter";
import ChapterDoc from "../model/chapterDoc";

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
          title: this.chapterList[chapterIndexList.indexOf(index)].title,
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

  async getChapter(toc) {
    for (let i = 0; i < toc.length; i++) {
      let random = Math.floor(Math.random() * 900000) + 100000;
      let index = (await toc[i].index).index;
      this.chapterList.push({
        title: toc[i].label,
        id: "title" + random,
        href: "title" + random,
        index: index,
        subitems: toc[i].subitems ? await this.getChapter(toc[i].subitems) : [],
      });
    }
    return this.chapterList;
  }
  getMetadata() {
    return new Promise<any>(async (resolve, reject) => {
      const metadata = this.book.metadata;
      try {
        const blob = await this.book.getCover();
        var reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          resolve({
            title: metadata.title,
            author: metadata.author[0],
            description: metadata.description,
            publisher: metadata.publisher,
            cover: reader.result,
          });
        };
      } catch (error) {
        resolve({
          name: metadata.title,
          author: metadata.author[0],
          description: metadata.description,
          publisher: metadata.publisher,
          cover: "",
        });
      }
    });
  }
}

export default Parser;
