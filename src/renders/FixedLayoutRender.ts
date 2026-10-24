import ComicRender from "./ComicRender";
import { loadEpubBook } from "../libs/epub-loader";
import { loadMobiBook } from "../libs/mobi-loader";
import {
  getFixedLayoutMetadata,
  measureFixedLayoutAspectRatio,
  removeFixedLayoutContent,
  renderFixedLayoutChapter,
  unloadFixedLayoutChapter,
} from "./fixedLayoutComic";

class FixedLayoutRender extends ComicRender {
  fileBuffer: ArrayBuffer;
  isEpub: boolean;
  constructor(fileBuffer: ArrayBuffer, config: any) {
    const format = (config.format || "").toUpperCase();
    super(fileBuffer, { ...config, format });
    this.fileBuffer = fileBuffer;
    this.isEpub = format === "EPUB";
  }
  async parse() {
    this.book = this.isEpub
      ? await loadEpubBook(this.fileBuffer)
      : await loadMobiBook(this.fileBuffer);
  }
  async handleRenderComicChapter(chapterDocIndex: number) {
    await renderFixedLayoutChapter(this, chapterDocIndex);
  }
  async handleUnloadComicChapter(chapterDocIndex: number) {
    await unloadFixedLayoutChapter(this, chapterDocIndex);
  }
  async getTemplateAspectRatio() {
    return await measureFixedLayoutAspectRatio(this);
  }
  async getMetadata() {
    return await getFixedLayoutMetadata(this);
  }
  async preCache() {
    return "";
  }
  removeContent() {
    super.removeContent();
    removeFixedLayoutContent(this);
  }
}
export default FixedLayoutRender;
