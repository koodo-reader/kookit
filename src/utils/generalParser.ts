import Chapter from "../model/chapter";
import ChapterDoc from "../model/chapterDoc";
const isString = (value: any): boolean => {
  return typeof value === "string" || value instanceof String;
};
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
  unescapeHtml(htmlStr: string): string {
    if (!htmlStr) return "";
    const doc = new DOMParser().parseFromString(htmlStr, "text/html");
    return doc.documentElement.textContent || "";
  }
  async getChapter(toc) {
    if (toc) {
      this.chapterList = await Promise.all<Chapter>(
        toc.map(async (item) => {
          let index = -1;
          try {
            index =
              item.href && (await this.book.resolveHref(item.href))
                ? (await this.book.resolveHref(item.href)).index
                : -1;
          } catch (error) {
            console.error(error);
          }

          return {
            label: this.unescapeHtml(item.label)
              ? this.unescapeHtml(item.label)
              : index + "",
            href: item.href ? item.href : "title" + index,
            index: index,
            subitems: item.subitems ? await this.getChapter(item.subitems) : [],
          } as Chapter;
        })
      );
    } else {
      this.chapterList = await Promise.all<Chapter>(
        this.book.sections.map(async (item, index) => {
          return {
            label: this.unescapeHtml(item.label)
              ? this.unescapeHtml(item.label)
              : index + "",
            href: item.href ? item.href : "title" + index,
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
    const chapterIndexList = this.flattenChapters.map((item) => item.index);
    return this.book.sections.map((item: any, index: number) => {
      if (chapterIndexList.indexOf(index) > -1) {
        return {
          label: this.unescapeHtml(
            this.flattenChapters[chapterIndexList.indexOf(index)].label
          ),
          href: this.flattenChapters[chapterIndexList.indexOf(index)].href,
          text: item,
        };
      } else {
        return {
          label: "",
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
      let author =
        metadata.author &&
        metadata.author[0] &&
        metadata.author[0].name &&
        isString(metadata.author[0].name)
          ? metadata.author[0].name
          : metadata.author &&
            metadata.author[0] &&
            isString(metadata.author[0])
          ? metadata.author[0]
          : metadata.author && isString(metadata.author)
          ? metadata.author
          : "";
      try {
        const blob = await this.book.getCover();
        var reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          resolve({
            name: metadata.title,
            author: author,
            description: metadata.description,
            publisher: metadata.publisher,
            cover: reader.result,
          });
        };
      } catch (error) {
        console.error(error);
        try {
          resolve({
            name: metadata.title,
            author: author,
            description: metadata.description,
            publisher: metadata.publisher,
            cover: "",
          });
        } catch (error) {
          console.error(error);
          reject(error);
        }
      }
    });
  }
}

export default GeneralParser;
