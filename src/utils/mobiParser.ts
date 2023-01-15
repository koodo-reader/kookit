import Chapter from "../model/chapter";
import ChapterDoc from "../model/chapterDoc";

class Parser {
  book: any;
  chapterList: Chapter[];
  flattenChapters: Chapter[];
  chapterDocList: ChapterDoc[];
  constructor(book: any) {
    this.book = book;
    this.chapterList = [];
    this.flattenChapters = [];
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
    this.chapterList = await Promise.all<Chapter>(
      toc.map(async (item) => {
        let random = Math.floor(Math.random() * 900000) + 100000;
        let index = (await item.index).index;
        return {
          title: item.label,
          id: "title" + random,
          href: "title" + random,
          index: index,
          subitems: item.subitems ? await this.getChapter(item.subitems) : [],
        } as Chapter;
      })
    );
    this.flattenChapters = this.flatChapter(this.chapterList);
    return this.chapterList;
  }
  flatChapter(chapters: any) {
    let newChapter: any = [];
    for (let i = 0; i < chapters.length; i++) {
      if (chapters[i].subitems && chapters[i].subitems.length > 0) {
        newChapter.push(chapters[i]);
        newChapter = newChapter.concat(this.flatChapter(chapters[i].subitems));
      } else {
        newChapter.push(chapters[i]);
      }
    }
    return newChapter;
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
