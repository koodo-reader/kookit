import Chapter from "./model/chapter";
import ChapterDoc from "./model/chapterDoc";
import { createIframe, handleLayout } from "./utils/layoutUtil";
import GeneralParser from "./utils/generalParser";
import { EPUB } from "./libs/epub";
import GeneralRender from "./GeneralRender";
declare var window: any;

class EpubRender extends GeneralRender {
  epubBuffer: ArrayBuffer;
  mode: string;
  book: any;
  chapterList: Chapter[];
  chapterDocList: ChapterDoc[];
  element: any;
  constructor(epubBuffer: ArrayBuffer, mode: string) {
    super(mode, "EPUB");
    this.epubBuffer = epubBuffer;
    this.mode = mode;
    this.chapterList = [];
    this.chapterDocList = [];
    this.book = "";
    this.element = "";
  }
  renderTo(element: HTMLElement) {
    return new Promise<void>(async (resolve, reject) => {
      this.element = element;
      if (!this.book) {
        await this.parse();
      }
      let parser = new GeneralParser(this.book);
      this.chapterList = await parser.getChapter(this.book.toc);
      this.chapterDocList = await parser.getChapterDoc();
      createIframe(element);
      handleLayout(element, this.mode);
      this.trigger("rendered");
      resolve();
    });
  }
  async parse() {
    let blob = new Blob([this.epubBuffer]);
    let file = new File([blob], "book", {
      lastModified: new Date().getTime(),
      type: blob.type,
    });
    const loader: any = await this.makeZipLoader(file);
    this.book = await new EPUB(loader).init();
  }
  async preCache() {
    if (!this.book) {
      await this.parse();
    }
    return await this.getCache(this.book);
  }
  async makeZipLoader(file) {
    const { ZipReader, BlobReader, TextWriter, BlobWriter } = window.zip;
    window.zip.configure({ useWebWorkers: false });
    const reader = new ZipReader(new BlobReader(file));
    const entries = await reader.getEntries();
    const map = new Map(entries.map((entry) => [entry.filename, entry]));
    const load =
      (f) =>
      (name, ...args) =>
        map.has(name) ? f(map.get(name), ...args) : null;
    const loadText = load((entry) => entry.getData(new TextWriter()));
    const loadBlob = load((entry, type) => {
      return new Promise<any>((resolve, reject) => {
        entry
          .getData(new BlobWriter(type))
          .then((res) => {
            resolve(res);
          })
          .catch((err) => {
            resolve(new Blob());
          });
      });
      // return entry.getData(new BlobWriter(type));
    });
    const getSize = (name) => (map.get(name) as any)?.uncompressedSize ?? 0;
    return { entries, loadText, loadBlob, getSize };
  }
  async getMetadata() {
    if (!this.book) {
      await this.parse();
    }
    let parser = new GeneralParser(this.book);
    return await parser.getMetadata();
  }
}
export default EpubRender;
