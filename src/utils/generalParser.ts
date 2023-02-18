import Chapter from "../model/chapter";
import ChapterDoc from "../model/chapterDoc";
import { handleImageMarker } from "./titleUtil";

class GeneralParser {
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
  async getChapter(toc) {
    if (toc) {
      this.chapterList = await Promise.all<Chapter>(
        toc.map(async (item) => {
          let index = -1;
          index =
            item.href && (await this.book.resolveHref(item.href))
              ? (await this.book.resolveHref(item.href)).index
              : -1;
          return {
            title: item.label ? item.label : index,
            href: item.href,
            index: index,
            subitems: item.subitems ? await this.getChapter(item.subitems) : [],
          } as Chapter;
        })
      );
    } else {
      this.chapterList = await Promise.all<Chapter>(
        this.book.sections.map(async (item, index) => {
          return {
            title: item.label ? item.label : index,
            href: item.href || "",
            index: index,
            subitems: item.subitems ? await this.getChapter(item.subitems) : [],
          } as Chapter;
        })
      );
    }

    this.flattenChapters = this.flatChapter(this.chapterList);
    return this.chapterList;
  }
  async getChapterDoc() {
    let sectionDocList: any[] = await Promise.all(
      this.book.sections.map(async (item) => {
        return item.load
          ? (await fetch(await item.load()).then((r) => r.blob())).text()
          : "";
      })
    );
    const chapterIndexList = this.flattenChapters.map((item) => item.index);
    return sectionDocList
      .map((item) => handleImageMarker(item))
      .map((item: string, index: number) => {
        if (chapterIndexList.indexOf(index) > -1) {
          return {
            title: this.flattenChapters[chapterIndexList.indexOf(index)].title,
            href: this.flattenChapters[chapterIndexList.indexOf(index)].href,
            text: item,
          };
        } else {
          return {
            title: "",
            href: "",
            text: item,
          };
        }
      }) as ChapterDoc[];
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
          author: metadata.author[0].name
            ? metadata.author[0].name
            : metadata.author[0],
          description: metadata.description,
          publisher: metadata.publisher,
          cover: "",
        });
      }
    });
  }
}

export default GeneralParser;
