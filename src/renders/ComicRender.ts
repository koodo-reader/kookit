import Chapter from "../model/chapter";
import ChapterDoc from "../model/chapterDoc";
import { createIframe } from "../utils/layoutUtil";
import GeneralParser from "../utils/generalParser";
import { makeComicBook } from "../libs/comic-book";
import GeneralRender from "./GeneralRender";
import untar from "js-untar";
import { getCache } from "../libs/cache.js";
import JSZip from "jszip";
import { isElectron } from "../utils/common";
import {
  createPDFIframe,
  handleIOSScrollPage,
  handlePDFLayout,
  handleScrollPDFPosition,
  isPDFScrolledIntoView,
} from "../utils/pdfUtil.js";
import { handleScrollPage } from "../utils/navigationUtil.js";
declare var window: any;

class ComicRender extends GeneralRender {
  comicBuffer: ArrayBuffer;
  readerMode: string;
  book: any;
  format: string;
  chapterList: Chapter[];
  chapterDocList: ChapterDoc[];
  element: any;
  rpc: any;
  getTarBuffer: (entryPath: string, filePath: string) => Promise<ArrayBuffer>;
  getZipBuffer: (entryPath: string, filePath: string) => Promise<ArrayBuffer>;
  getTarEntries: (
    filePath: string
  ) => Promise<{ entryPath: string; size: number; fileName: string }[]>;
  getZipEntries: (
    filePath: string
  ) => Promise<{ entryPath: string; size: number; fileName: string }[]>;
  filePath: string;
  scrollComicInterval: any = null;
  constructor(comicBuffer: ArrayBuffer, config: any) {
    super(config);
    this.comicBuffer = comicBuffer;
    this.readerMode = config.readerMode;
    this.format = config.format;
    this.chapterList = [];
    this.chapterDocList = [];
    this.book = "";
    this.element = "";
    this.rpc;
    this.getTarBuffer = config.getTarBuffer;
    this.getZipBuffer = config.getZipBuffer;
    this.getTarEntries = config.getTarEntries;
    this.getZipEntries = config.getZipEntries;
    this.filePath = config.filePath;
  }
  renderTo(element: HTMLElement) {
    return new Promise<void>(async (resolve, reject) => {
      this.element = element;
      if (!this.book) {
        try {
          await this.parse();
        } catch (error) {
          console.error(error);
          reject(error);
          return;
        }
      }
      let parser = new GeneralParser(this.book);
      this.chapterList = await parser.getChapter(this.book.toc);
      this.chapterDocList = await parser.getChapterDoc();
      createIframe(element, this.isAllowScript);
      let doc: any = this.getDocument();
      if (!doc) return;
      await this.createComicContainer(doc);
      let scrollTimeout: any = null;
      if (this.readerMode === "scroll") {
        this.element.addEventListener("scroll", (e) => {
          if (scrollTimeout) {
            clearTimeout(scrollTimeout);
          }
          scrollTimeout = setTimeout(async () => {
            await this.handleComicScrollEvent(doc);
            await this.record();
          }, 100);
        });
      } else {
        doc.addEventListener("scroll", (e) => {
          if (scrollTimeout) {
            clearTimeout(scrollTimeout);
          }
          scrollTimeout = setTimeout(async () => {
            await this.handleComicScrollEvent(doc);
            await this.record();
          }, 200);
        });
      }
      handlePDFLayout(element, this.readerMode, doc);
      resolve();
    });
  }
  async createComicContainer(doc: Document) {
    const fragment = doc.createDocumentFragment();
    const aspectRatio = await this.getTemplateAspectRatio();
    for (let index = 0; index < this.chapterDocList.length; index++) {
      const iframeContainer = doc.createElement("div");
      iframeContainer.style.position = "relative";
      iframeContainer.style.width = "100%";
      iframeContainer.id = "pdf-container-" + index;
      iframeContainer.className = "pdf-container";
      if (this.readerMode === "single") {
        iframeContainer.style.paddingTop = this.element.clientHeight + "px";
      } else {
        iframeContainer.style.paddingTop = `${(1 / aspectRatio) * 100}%`;
        iframeContainer.style.marginBottom = "2%";
        iframeContainer.style.overflow = "hidden";
      }
      if (this.readerMode === "double") {
        iframeContainer.style.breakInside = "avoid";
      }
      fragment.appendChild(iframeContainer);
    }
    (doc.body || doc.documentElement).appendChild(fragment);
    if (this.readerMode === "scroll") {
      let iframe = this.getIframe();
      if (iframe) {
        iframe.height = doc.body.scrollHeight + 300 + "px";
      }
    }
  }
  async getTemplateAspectRatio() {
    // 采样前几张图片的解码尺寸，取最常见的宽高比作为全书的模板比例，
    // 用于 double/scroll 模式下容器的初始高度占位
    const sampleCount = Math.min(3, this.chapterDocList.length);
    const ratios: number[] = [];
    for (let i = 0; i < sampleCount; i++) {
      try {
        const url = await this.book.sections[i].load();
        const res = await fetch(url);
        const imageBlob = await res.blob();
        const meta = await this.getImageMeta(imageBlob);
        if (meta.width && meta.height) {
          ratios.push(Math.round((meta.width / meta.height) * 1000) / 1000);
        }
      } catch (error) {
        console.error(error);
      }
    }
    if (ratios.length === 0) return 0.75;
    const frequency = new Map<number, number>();
    ratios.forEach((ratio) => {
      frequency.set(ratio, (frequency.get(ratio) || 0) + 1);
    });
    let maxRatio = ratios[0];
    let maxCount = 0;
    frequency.forEach((count, ratio) => {
      if (count > maxCount) {
        maxCount = count;
        maxRatio = ratio;
      }
    });
    return maxRatio;
  }
  async getImageMeta(blob: Blob) {
    let url = URL.createObjectURL(blob);
    const img = new Image();
    img.src = url;
    try {
      await img.decode();
    } catch (error) {
      console.error(error);
    }
    const { naturalWidth, naturalHeight } = img;
    URL.revokeObjectURL(url);
    return { width: naturalWidth, height: naturalHeight };
  }
  async handleComicScrollEvent(doc: Document) {
    let subContainers = doc.querySelectorAll(".pdf-container");
    for (let index = 0; index < subContainers.length; index++) {
      let subContainer = subContainers[index];
      let id = subContainer.getAttribute("id");
      if (!id) continue;
      let chapterDocIndex = parseInt(id.split("-").reverse()[0]);
      let isScrollIntoView = isPDFScrolledIntoView(
        this.element,
        subContainer as HTMLElement,
        this.readerMode,
        doc
      );
      if (isScrollIntoView) {
        await this.renderComicPage(chapterDocIndex);
      }
    }
  }
  async parse() {
    try {
      if (isElectron()) {
        if (this.format === "CBZ") {
          const loader: any = await this.makeZipStreamLoader(this.filePath);
          this.book = makeComicBook(loader, { name: this.filePath });
          return;
        } else if (this.format === "CBT") {
          const loader: any = await this.makeTarStreamLoader(this.filePath);
          this.book = makeComicBook(loader, { name: this.filePath });
          return;
        }
      }
      let blob = new Blob([this.comicBuffer]);
      let file = new File([blob], "book." + this.format.toLocaleLowerCase(), {
        lastModified: new Date().getTime(),
        type: blob.type,
      });
      const archiveType = this.detectArchiveType();
      if (archiveType === "zip" || archiveType === "cbz") {
        const loader: any = await this.makeZipLoader(file);
        this.book = makeComicBook(loader, file);
      } else if (archiveType === "tar" || archiveType === "cbt") {
        const loader: any = await this.makeTarLoader();
        this.book = makeComicBook(loader, file);
      } else if (archiveType === "rar" || archiveType === "cbr") {
        this.rpc = await window.RPC.new("./lib/libunrar/worker.js", {
          loaded: function () {
            console.info("loaded");
          },
          progressShow: function (fileName, fileSize, progress) {
            console.info(progress);
          },
        });
        await new Promise((r) => setTimeout(r, 200));
        const loader: any = await this.makeRarLoader();
        this.book = makeComicBook(loader, file);
      } else if (archiveType === "7z" || archiveType === "cb7") {
        const loader: any = await this.make7zLoader();
        this.book = makeComicBook(loader, file);
      }
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
  /**
   * 通过文件魔数判断真实压缩格式，而非依赖文件扩展名。
   * 很多漫画文件被改名（如实际是 zip 却命名为 .cbr），需从内容本身判定。
   */
  detectArchiveType() {
    const bytes = new Uint8Array(this.comicBuffer);
    if (bytes.length < 4) {
      // 无法探测则回退到扩展名
      return this.format.toLocaleLowerCase();
    }
    // ZIP: PK\x03\x04
    if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
      const sig = [bytes[2], bytes[3]];
      // 空 zip、常规 zip
      if (
        (sig[0] === 0x03 && sig[1] === 0x04) ||
        (sig[0] === 0x05 && sig[1] === 0x06) ||
        (sig[0] === 0x07 && sig[1] === 0x08)
      ) {
        return "zip";
      }
    }
    // RAR4: "Rar!\x1a\x07\x00"; RAR5: "Rar!\x1a\x07\x01\x00"
    if (
      bytes[0] === 0x52 &&
      bytes[1] === 0x61 &&
      bytes[2] === 0x72 &&
      bytes[3] === 0x21
    ) {
      return "rar";
    }
    // 7z: "7z\xbc\xaf\x27\x1c"
    if (
      bytes[0] === 0x37 &&
      bytes[1] === 0x7a &&
      bytes[2] === 0xbc &&
      bytes[3] === 0xaf
    ) {
      return "7z";
    }
    // tar: 传统 USTAR POSIX 头在偏移 257 处为 "ustar"。也检查其他 tar 变体。
    if (
      this.comicBuffer.byteLength >= 265 &&
      new TextDecoder("utf8").decode(
        new Uint8Array(this.comicBuffer, 257, 5)
      ) === "ustar"
    ) {
      return "tar";
    }
    // 未知格式，回退到扩展名
    return this.format.toLocaleLowerCase();
  }
  async preCache() {
    if (!this.book) {
      await this.parse();
    }
    return await getCache(this.book);
  }
  async makeZipStreamLoader(filePath: string) {
    const entries = await this.getZipEntries(filePath);
    const loadText = async (name) => {
      let entry = entries.find((item) => item.fileName === name);
      if (entry) {
        return entry.fileName;
      }
      return "";
    };
    const loadBlob = async (name) => {
      let entry = entries.find((item) => item.fileName === name);
      if (entry) {
        let buffer = await this.getZipBuffer(entry.entryPath, filePath);
        return new Blob([buffer]);
      }
      return new Blob([new ArrayBuffer(0)]);
    };
    const getSize = (name) => {
      let entry: any = entries.find((item) => item.fileName === name);
      if (entry) {
        return entry.size || 1;
      }
    };
    return {
      entries: entries.map((item) => {
        return { filename: item.fileName };
      }),
      loadText,
      loadBlob,
      getSize,
    };
  }
  async makeTarStreamLoader(filePath: string) {
    const entries = await this.getTarEntries(filePath);
    const loadText = async (name) => {
      let entry = entries.find((item) => item.fileName === name);
      if (entry) {
        return entry.fileName;
      }
      return "";
    };
    const loadBlob = async (name) => {
      let entry = entries.find((item) => item.fileName === name);
      if (entry) {
        let buffer = await this.getTarBuffer(entry.entryPath, filePath);
        return new Blob([buffer]);
      }
      return new Blob([new ArrayBuffer(0)]);
    };
    const getSize = (name) => {
      let entry: any = entries.find((item) => item.fileName === name);
      if (entry) {
        return entry.size || 1;
      }
    };
    return {
      entries: entries.map((item) => {
        return { filename: item.fileName };
      }),
      loadText,
      loadBlob,
      getSize,
    };
  }
  async makeZipLoader(file) {
    let zip = await JSZip.loadAsync(file);
    const entries = zip.files;
    const loadText = async (name) => {
      let entry = zip.file(name);
      if (entry) {
        return entry.async("string");
      }
      return "";
    };
    const loadBlob = async (name) => {
      let entry = zip.file(name);
      if (entry) {
        let buffer = await entry.async("arraybuffer");
        return new Blob([buffer]);
      }
      return new Blob([new ArrayBuffer(0)]);
    };
    const getSize = (name) => {
      let entry: any = zip.file(name);
      if (entry) {
        return entry._data.uncompressedSize || 1;
      }
    };
    return {
      entries: Object.values(entries).map((item) => {
        return { filename: item.name };
      }),
      loadText,
      loadBlob,
      getSize,
    };
  }
  async makeTarLoader() {
    const entries = await untar(this.comicBuffer);
    const map = new Map(entries.map((entry) => [entry.name, entry]));
    const load =
      (f) =>
      (name, ...args) =>
        map.has(name) ? f(map.get(name), ...args) : null;
    const loadText = load((entry) => entry.readAsString());
    const loadBlob = load((entry, type) => entry.blob);
    const getSize = (name) => (map.get(name) as any)?.size ?? 1;
    return {
      entries: entries.map((item) => {
        return { filename: item.name };
      }),
      loadText,
      loadBlob,
      getSize,
    };
  }
  async makeRarLoader() {
    return new Promise<any>((resolve, reject) => {
      var buffers = [this.comicBuffer];
      var dataToPass = [{ name: "book.rar", content: this.comicBuffer }];
      var password = null;
      this.rpc.transferables = buffers;

      this.rpc
        .unrar(dataToPass, password, 0)
        .then((ret) => {
          let entries = this.getRarEntries(ret.ls);
          const map = new Map(
            Object.values(entries).map((entry: any) => [
              entry.fullFileName,
              entry,
            ])
          );
          const load =
            (f) =>
            (name, ...args) =>
              map.has(name) ? f(map.get(name), ...args) : null;
          const loadText = load((entry) => entry.fullFileName);
          const loadBlob = load((entry, type) => new Blob([entry.fileContent]));
          const getSize = (name) => (map.get(name) as any)?.fileSize ?? 1;
          resolve({
            entries: Object.values(entries).map((item: any) => {
              return { filename: item.fullFileName };
            }),
            loadText,
            loadBlob,
            getSize,
          });
        })
        .catch((err) => {
          console.error(err);
          reject(err);
        });
    });
  }
  async make7zLoader() {
    const wasmBinaryFile = "./lib/7z-wasm/7zz.wasm";
    if (!window.wasmBinary) {
      const response = await fetch(wasmBinaryFile, {
        credentials: "same-origin",
      });
      if (!response["ok"]) {
        throw "failed to load wasm binary file at '" + wasmBinaryFile + "'";
      }
      window.wasmBinary = await response["arrayBuffer"]();
    }
    const sevenZip = await window.SevenZip({
      wasmBinary: window.wasmBinary,
    });

    const archiveData = new Uint8Array(this.comicBuffer);
    const archiveName = "archive.cb7";

    const stream = sevenZip.FS.open(archiveName, "w+");
    sevenZip.FS.write(stream, archiveData, 0, archiveData.length);
    sevenZip.FS.close(stream);
    sevenZip.callMain(["x", archiveName]);
    const loader = sevenZip.FS;
    const entries = this.get7zEntries(loader.lookupPath("/").node);
    const map = new Map(entries.map((entry) => [entry.name, entry]));
    const load =
      (f) =>
      (name, ...args) =>
        map.has(name) ? f(map.get(name), ...args) : null;
    const loadText = load((entry) => entry.name);
    const loadBlob = load((entry, type) => new Blob([entry.buffer]));
    const getSize = (name) => (map.get(name) as any)?.size ?? 1;
    return {
      entries: entries.map((item) => {
        return { filename: item.name };
      }),
      loadText,
      loadBlob,
      getSize,
    };
  }
  getRarEntries(Node) {
    const list = Object.keys(Node);
    let entries: any = [];
    for (let index = 0; index < list.length; index++) {
      const item = list[index];
      if (Node[item].type === "dir") {
        entries = entries.concat(this.getRarEntries(Node[item].ls));
      } else {
        entries.push({
          fullFileName: item,
          fileContent: Node[item].fileContent,
          fileSize: Node[item].fileSize,
        });
      }
    }
    return entries;
  }
  get7zEntries(FSNode: any) {
    const contents = FSNode.contents;
    const list = Object.keys(contents).filter((item) => {
      return (
        item != "archive.cb7" &&
        item != "dev" &&
        item != "home" &&
        item != "proc" &&
        item != "tmp"
      );
    });
    let entries: any = [];
    for (let index = 0; index < list.length; index++) {
      const item = list[index];
      if (contents[item].isFolder) {
        entries = entries.concat(this.get7zEntries(contents[item]));
      } else {
        entries.push({
          name: item,
          buffer: contents[item].contents,
          size: contents[item].usedBytes,
        });
      }
    }
    return entries;
  }
  getSubDocument(chapterDocIndex?: number): Document | null {
    let doc: any = this.getDocument();
    if (!doc) return null;
    let subIframe: any = doc.getElementById("pdf-iframe-" + chapterDocIndex);
    if (!subIframe) {
      createPDFIframe(chapterDocIndex || 0, doc);
      subIframe = doc.getElementById("pdf-iframe-" + chapterDocIndex);
    }
    return subIframe?.contentDocument;
  }
  getSubIframe(chapterDocIndex?: number): HTMLIFrameElement | null {
    let doc: any = this.getDocument();
    if (!doc) return null;
    let iframe: any = doc.getElementById("pdf-iframe-" + chapterDocIndex);
    if (!iframe) {
      createPDFIframe(chapterDocIndex || 0, doc);
      iframe = doc.getElementById("pdf-iframe-" + chapterDocIndex);
    }
    return iframe;
  }
  async handleRenderComicChapter(chapterDocIndex: number) {
    if (chapterDocIndex >= this.chapterDocList.length || chapterDocIndex < 0) {
      return;
    }
    let doc: any = this.getDocument();
    if (!doc) return;
    let subIframe: any = doc.getElementById("pdf-iframe-" + chapterDocIndex);
    if (!subIframe) {
      subIframe = createPDFIframe(chapterDocIndex, doc);
    }
    let subDoc = subIframe?.contentDocument;
    if (!subDoc) return;
    if (subDoc.body.innerHTML) {
      return;
    }
    let chapterUrl = await this.chapterDocList[chapterDocIndex].text.load();
    let res = await fetch(chapterUrl);
    let chapterText = await res.text();
    subDoc.body.innerHTML = chapterText;
    subDoc.body.style.margin = "0";
    subDoc.body.style.height = "100%";
    subDoc.documentElement.style.height = "100%";
    this.trigger("rendered", [chapterDocIndex] as any);
  }
  async handleUnloadComicChapter(chapterDocIndex: number) {
    if (chapterDocIndex >= this.chapterDocList.length || chapterDocIndex < 0) {
      return;
    }
    let subDoc = this.getSubDocument(chapterDocIndex);
    if (subDoc && subDoc.body.innerHTML === "") {
      return;
    }
    await this.chapterDocList[chapterDocIndex].text.unload();
    if (subDoc) {
      subDoc.body.innerHTML = "";
    }
  }
  async renderComicPage(chapterDocIndex: number) {
    if (chapterDocIndex >= this.chapterDocList.length || chapterDocIndex < 0) {
      return;
    } else if (chapterDocIndex > 3) {
      await this.handleUnloadComicChapter(chapterDocIndex - 4);
    }
    await this.handleRenderComicChapter(chapterDocIndex);
    this.handleRenderComicChapter(chapterDocIndex + 1);
    if (this.platform === "ios") {
      //ios 性能太差，先不预渲染后续图片
      return;
    }
    this.handleRenderComicChapter(chapterDocIndex + 2);
    this.handleRenderComicChapter(chapterDocIndex + 3);
  }
  async goToChapterIndex(targetChapterIndex: number) {
    if (this.chapterDocList.length > 0) {
      await this.goToChapter(
        targetChapterIndex,
        this.chapterDocList[targetChapterIndex].href,
        this.chapterDocList[targetChapterIndex].label
      );
    }
  }
  async goToChapter(chapterDocIndex, _chapterHref, _chapterTitle) {
    if (this.readerMode === "double" && chapterDocIndex % 2 == 1) {
      chapterDocIndex--;
    }
    let doc = this.getDocument();
    let iframe = this.getIframe();
    if (!doc || !iframe) return;
    await this.renderComicPage(chapterDocIndex);
    await handleScrollPDFPosition(
      parseInt(chapterDocIndex),
      this.readerMode,
      doc
    );
    await this.recordByChapter(chapterDocIndex);
  }
  getPositionByChapter(chapterDocIndex: number) {
    return {
      percentage: chapterDocIndex / this.chapterDocList.length,
      chapterDocIndex: chapterDocIndex + "",
      chapterHref: this.chapterDocList[chapterDocIndex].href,
      chapterTitle: this.chapterDocList[chapterDocIndex].label,
      text: "",
    };
  }
  async goToPercentage(percentage: number) {
    if (this.chapterDocList.length > 0) {
      let chapterIndex =
        percentage === 1
          ? this.chapterDocList.length - 1
          : Math.floor(this.chapterDocList.length * percentage);
      await this.goToChapter(
        chapterIndex,
        this.chapterDocList[chapterIndex].href,
        this.chapterDocList[chapterIndex].label
      );
    }
  }
  async goToPosition(bookLocationStr: string) {
    let doc = this.getDocument();
    let iframe = this.getIframe();
    if (!doc || !iframe) return;
    let bookLocation = JSON.parse(bookLocationStr);
    if (bookLocation.chapterDocIndex === undefined) {
      bookLocation.chapterDocIndex = 0;
    }
    this.tempLocation = {
      text: bookLocation.text,
      chapterTitle: bookLocation.chapterTitle,
      chapterDocIndex: bookLocation.chapterDocIndex,
      chapterHref: bookLocation.chapterHref,
      count: bookLocation.count,
      page: bookLocation.page,
      percentage: bookLocation.percentage,
    };
    let { chapterDocIndex } = bookLocation;
    if (this.readerMode === "double" && chapterDocIndex % 2 == 1) {
      chapterDocIndex--;
    }
    await this.renderComicPage(parseInt(chapterDocIndex));
    if (this.readerMode === "scroll") {
      iframe.height = doc.body.scrollHeight + "px";
      iframe.height = doc.body.scrollHeight + 300 + "px";
    }
    await handleScrollPDFPosition(
      parseInt(chapterDocIndex),
      this.readerMode,
      doc
    );
    await this.recordByChapter(parseInt(chapterDocIndex));
    this.addPageAnimation();
  }
  async prev(platform?: string) {
    let doc = this.getDocument();
    let iframe = this.getIframe();
    if (!doc || !iframe) {
      return;
    }
    if (this.readerMode === "scroll") {
      this.element.scrollBy({
        left: 0,
        top: -(this.element.clientHeight - 50),
        behavior: "smooth",
      });
    } else {
      if (platform === "ios") {
        await handleIOSScrollPage(
          this.element,
          this.animation,
          1,
          doc,
          this.flipToNextPage,
          this.flipToPrevPage,
          this.isMobile,
          parseInt(this.tempLocation.chapterDocIndex || "0"),
          this.readerMode
        );
      } else {
        await handleScrollPage(
          this.element,
          this.animation,
          1,
          doc,
          this.flipToNextPage,
          this.flipToPrevPage,
          this.isMobile
        );
      }
      await this.renderComicPage(
        parseInt(this.tempLocation.chapterDocIndex) -
          (this.readerMode === "double" ? 2 : 1)
      );
    }
    await this.record();
  }
  async next(platform?: string) {
    let doc = this.getDocument();
    let iframe = this.getIframe();
    if (!doc || !iframe) {
      return;
    }
    if (this.readerMode === "scroll") {
      this.element.scrollBy({
        left: 0,
        top: this.element.clientHeight - 50,
        behavior: "smooth",
      });
    } else {
      if (platform === "ios") {
        await handleIOSScrollPage(
          this.element,
          this.animation,
          -1,
          doc,
          this.flipToNextPage,
          this.flipToPrevPage,
          this.isMobile,
          parseInt(this.tempLocation.chapterDocIndex || "0"),
          this.readerMode
        );
      } else {
        await handleScrollPage(
          this.element,
          this.animation,
          -1,
          doc,
          this.flipToNextPage,
          this.flipToPrevPage,
          this.isMobile
        );
      }
      await this.renderComicPage(
        parseInt(this.tempLocation.chapterDocIndex) +
          (this.readerMode === "double" ? 2 : 1)
      );
    }
    await this.record();
  }
  async prevChapter() {
    await this.prev();
  }
  async nextChapter() {
    await this.next();
  }
  async goToPage(targetPage: number): Promise<void> {
    let chapterDocIndex = Math.floor(targetPage - 1);
    if (chapterDocIndex >= this.chapterDocList.length) {
      chapterDocIndex = this.chapterDocList.length - 1;
    }
    if (chapterDocIndex < 0) {
      chapterDocIndex = 0;
    }
    await this.goToChapter(
      chapterDocIndex,
      this.chapterDocList[chapterDocIndex].href,
      this.chapterDocList[chapterDocIndex].label
    );
  }
  async record(): Promise<void> {
    if (this.animation !== "none" && this.isMobile !== "yes") {
      await new Promise((r) => setTimeout(r, 1000));
    }
    let doc = this.getDocument();
    if (!doc) return;
    await this.handleComicRecord(doc);
  }
  async recordByChapter(chapterDocIndex: number): Promise<void> {
    if (this.animation !== "none" && this.isMobile !== "yes") {
      await new Promise((r) => setTimeout(r, 1000));
    }
    if (chapterDocIndex >= this.chapterDocList.length || chapterDocIndex < 0) {
      return;
    }
    this.handleComicRecordByIndex(chapterDocIndex);
  }
  handleComicRecordByIndex(chapterDocIndex: number) {
    if (chapterDocIndex !== parseInt(this.tempLocation.chapterDocIndex)) {
      this.tempLocation.chapterDocIndex = chapterDocIndex + "";
      this.tempLocation.percentage =
        this.chapterDocList.length === 1
          ? "1"
          : chapterDocIndex / (this.chapterDocList.length - 1) + "";
      this.tempLocation.chapterHref = this.chapterDocList[chapterDocIndex].href;
      this.tempLocation.chapterTitle =
        this.chapterDocList[chapterDocIndex].label;
      this.tempLocation.text = "";
      this.trigger("page-changed");
    }
  }
  async handleComicRecord(doc: Document) {
    let subContainers = doc.querySelectorAll(".pdf-container");
    if (
      subContainers.length > 0 &&
      isPDFScrolledIntoView(
        this.element,
        subContainers[subContainers.length - 1] as HTMLElement,
        this.readerMode,
        doc
      )
    ) {
      this.handleComicRecordByContainer(
        subContainers[subContainers.length - 1] as HTMLElement
      );
      return;
    }
    for (let index = 0; index < subContainers.length; index++) {
      let subContainer = subContainers[index];
      if (
        isPDFScrolledIntoView(
          this.element,
          subContainer as HTMLElement,
          this.readerMode,
          doc
        )
      ) {
        this.handleComicRecordByContainer(subContainer as HTMLElement);
        break;
      }
    }
  }
  handleComicRecordByContainer(subContainer: HTMLElement) {
    let id = subContainer.getAttribute("id");
    if (!id) return;
    let chapterDocIndex = parseInt(id.split("-").reverse()[0]);
    this.handleComicRecordByIndex(chapterDocIndex);
  }
  getProgress() {
    return {
      totalPage: this.chapterDocList.length,
      currentPage: parseInt(this.tempLocation.chapterDocIndex || "0") + 1,
    } as any;
  }
  getPageSize() {
    let doc: any = this.getDocument();
    if (!doc) return;
    let scale = this.readerMode === "double" ? 2 : 1;
    let section = Math.floor(doc.body.clientWidth / 12);
    let gap = section % 2 === 0 ? section : section - 1;
    let subIframe = doc.querySelectorAll("iframe")[0];
    let iframeHeight = subIframe?.getBoundingClientRect().height;
    return {
      width: doc.body.clientWidth,
      height: this.element.clientHeight,
      sectionWidth: (doc.body.clientWidth - gap) / scale,
      sectionHeight: iframeHeight,
      gap: gap,
    } as any;
  }
  async visibleText() {
    return [];
  }
  async audioText() {
    return await this.visibleText();
  }
  async getRestAudioText(_count: number) {
    return [];
  }
  async chapterText() {
    return "";
  }
  async doSearch(_keyword: string) {
    return [];
  }
  async getImageList(chapterDocIndex?: number): Promise<string[]> {
    if (
      chapterDocIndex === undefined ||
      chapterDocIndex === null ||
      chapterDocIndex < 0 ||
      chapterDocIndex > this.chapterDocList.length - 1
    ) {
      return [];
    }
    let subDoc = this.getSubDocument(chapterDocIndex);
    if (!subDoc) return [];
    let img = subDoc.querySelector("img");
    return img && img.src ? [img.src] : [];
  }
  async getMetadata() {
    return new Promise<any>(async (resolve, reject) => {
      try {
        if (!this.book) {
          await this.parse();
        }

        const coverBlob = await this.book.getCover();
        var reader = new FileReader();
        reader.readAsDataURL(coverBlob);
        reader.onloadend = () => {
          resolve({
            cover: reader.result,
          });
        };
      } catch (error) {
        console.error(error);
        reject(error);
      }
    });
  }
}
export default ComicRender;
