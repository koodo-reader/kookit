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
    super(mode);
    this.epubBuffer = epubBuffer;
    this.mode = mode;
    this.chapterList = [];
    this.chapterDocList = [];
    this.book = "";
    this.element = "";
  }
  renderTo(element: HTMLElement) {
    return new Promise<void>(async (resolve, reject) => {
      let blob = new Blob([this.epubBuffer]);
      let file = new File([blob], "book", {
        lastModified: new Date().getTime(),
        type: blob.type,
      });
      const loader: any = await this.makeZipLoader(file);
      this.book = await new EPUB(loader).init();
      let parser = new GeneralParser(this.book);
      this.element = element;
      this.chapterList = await parser.getChapter(this.book.toc);
      this.chapterDocList = await parser.getChapterDoc();
      createIframe(element);
      handleLayout(element, this.mode);
      this.trigger("rendered");
      resolve();
    });
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
    const loadBlob = load((entry, type) => entry.getData(new BlobWriter(type)));
    const getSize = (name) => (map.get(name) as any)?.uncompressedSize ?? 0;
    return { entries, loadText, loadBlob, getSize };
  }
  async getMetadata() {
    let blob = new Blob([this.epubBuffer]);
    let file = new File([blob], "book", {
      lastModified: new Date().getTime(),
      type: blob.type,
    });

    const loader: any = await this.makeZipLoader(file);
    this.book = await new EPUB(loader).init();
    let parser = new GeneralParser(this.book);
    return await parser.getMetadata();
  }
}
export default EpubRender;
