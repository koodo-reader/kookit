import { getVisibleText } from "./navigationUtil";
import { convertStyleNum } from "./layoutUtil";

// 中日韩等表意文字、泰/老/高棉/缅文等无空格连写文字
const NO_SPACE_SCRIPT_REGEX =
  /[\u3000-\u303f\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uff9f\u0e00-\u0e7f\u0e80-\u0eff\u1000-\u109f\u1780-\u17ff]/;

const segmenterCache: Record<string, any> = {};

const getWordSegmenter = (lang?: string) => {
  if (typeof (Intl as any).Segmenter === "undefined") return null;
  const key = lang || "default";
  if (!segmenterCache[key]) {
    segmenterCache[key] = new (Intl as any).Segmenter(lang || undefined, {
      granularity: "word",
    });
  }
  return segmenterCache[key];
};

export const isNoSpaceScript = (text: string): boolean => {
  if (!text) return false;
  return NO_SPACE_SCRIPT_REGEX.test(text);
};

// 判断片段是否只由标点符号组成（不含字母、数字或表意文字），
// 全角区段仅排除全角字母/数字，全角标点（，！？：；（）等）视为标点
const isPunctuationOnly = (word: string): boolean =>
  /^[^\w\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af\u1100-\u11ff\u3130-\u318f\u0e01-\u0e3a\u0e40-\u0e4e\u0e50-\u0e59\u0e80-\u0eff\u1000-\u109f\u1780-\u17b3\u17e0-\u17e9\uff10-\uff19\uff21-\uff3a\uff41-\uff5a]+$/.test(
    word
  );

// 将独立成词的标点符号合并到前一个单词的末尾
const mergePunctuationToPrevWord = (words: string[]): string[] => {
  const merged: string[] = [];
  for (const word of words) {
    if (merged.length > 0 && isPunctuationOnly(word)) {
      merged[merged.length - 1] += word;
    } else {
      merged.push(word);
    }
  }
  return merged;
};

// 英文等空格连写语言按空白切分；中日韩、泰语等非印欧语系语言使用 Intl.Segmenter 分词
export const segmentSpeedReadingWords = (text: string): string[] => {
  if (!text || !text.trim()) return [];
  if (isNoSpaceScript(text)) {
    const segmenter = getWordSegmenter();
    if (segmenter) {
      const words = Array.from(segmenter.segment(text))
        .map((segment: any) => segment.segment as string)
        .filter((segment: string) => segment.trim().length > 0);
      return mergePunctuationToPrevWord(words);
    }
    return mergePunctuationToPrevWord(
      Array.from(text).filter((char) => char.trim().length > 0)
    );
  }
  return text.split(/\s+/).filter((word) => word.length > 0);
};

// ORP（Optimal Recognition Point）最佳识别点：
// 短词（1–3 字母）高亮第 1 个字母，中等长度词高亮第 2 或第 3 个字母，
// 长词高亮更靠左的固定位置，保证注视点始终锁定同一位置
export const getSpeedReadingORPIndex = (word: string): number => {
  const length = Array.from(word).length;
  if (length <= 3) return 0;
  if (length <= 6) return 1;
  if (length <= 9) return 2;
  if (length <= 13) return 3;
  return 4;
};

// 单词展示时长基础值 = 60000 / WPM，长词和句读标点附加停顿
export const getSpeedReadingWordDelay = (word: string, wpm: number): number => {
  const base = 60000 / Math.max(1, wpm);
  const token = word.trim();
  const length = Array.from(token).length;
  let factor = 1;
  if (length >= 13) {
    factor = 1.8;
  } else if (length >= 9) {
    factor = 1.5;
  } else if (length >= 6) {
    factor = 1.2;
  }
  if (token && /^[.!?。！？；：…，,、()]$/.test(token)) {
    factor = 2.5;
  } else if (/[.!?。！？…]["'」』）)]?$/.test(token)) {
    factor = Math.max(factor, 2);
  } else if (/[,，、;；:]["'」』）)]?$/.test(token)) {
    factor = Math.max(factor, 1.5);
  }
  return Math.round(base * factor);
};

// RSVP 速读管理器：在页面上方展示全页遮罩，固定位置逐词展示（WPM 控制），
// ORP 红色高亮，页面单词耗尽自动翻页，到书末自动暂停
class SpeedReadingManager {
  // 配置与运行时状态
  isSpeedReading: string = "no";
  speedReadingSpeed: number = 300;
  isDarkMode: string = "no";
  readerMode: string = "single";

  words: string[] = [];
  index: number = 0;
  timer: any = null;
  playing: boolean = false;
  autoStarted: boolean = false;
  overlayEl: any = null;
  skipFlip: boolean = false;

  // 由 GeneralRender 注入的回调，与渲染实例解耦
  getDoc: () => Document | null = () => null;
  getElement: () => HTMLElement = () => ({}) as HTMLElement;
  getOverlayBackground: (doc: Document) => string = () => "#ffffff";
  getProgress: () => any = () => null;
  getChapterDocIndex: () => any = () => "0";
  nextPage: () => Promise<void> | void = async () => {};
  prevPage: () => Promise<void> | void = async () => {};

  constructor(config: any = {}) {
    this.isSpeedReading = config.isSpeedReading || "no";
    this.speedReadingSpeed = config.speedReadingSpeed || 300;
    this.isDarkMode = config.isDarkMode || "no";
    this.readerMode = config.readerMode || "single";
  }

  applyConfig(config: any = {}) {
    if (config.isSpeedReading != null) {
      this.isSpeedReading = config.isSpeedReading;
    }
    if (config.speedReadingSpeed != null) {
      this.speedReadingSpeed = config.speedReadingSpeed;
    }
    if (config.isDarkMode != null) {
      this.isDarkMode = config.isDarkMode;
    }
  }

  isSpeedReadingActive(): boolean {
    return this.isSpeedReading === "yes";
  }

  private extractWords(): string[] {
    let doc = this.getDoc();
    let element = this.getElement();
    if (!doc || !doc.body || !element) return [];
    let texts = getVisibleText(element, this.readerMode, doc);
    let words: string[] = [];
    for (let index = 0; index < texts.length; index++) {
      words = words.concat(segmentSpeedReadingWords(texts[index]));
    }
    return words;
  }

  private getPageHeight(): number {
    let element = this.getElement();
    return (element && element.clientHeight) || 600;
  }

  private getTextColor(doc: Document): string {
    const base = this.getOverlayBackground(doc);
    const match = base.match(/rgba?\(([^)]+)\)/);
    if (match) {
      const parts = match[1]
        .split(/[\s,/]+/)
        .filter((item: string) => item !== "")
        .map((item: string) => parseFloat(item));
      if (
        parts.length >= 3 &&
        parts.slice(0, 3).every((item) => !isNaN(item))
      ) {
        const luminance =
          0.299 * parts[0] + 0.587 * parts[1] + 0.114 * parts[2];
        return luminance > 128 ? "#333333" : "#f5f5f5";
      }
    }
    const hex = base.trim().replace(/^#/, "");
    if (/^[0-9a-fA-F]{6}$/.test(hex) || /^[0-9a-fA-F]{3}$/.test(hex)) {
      const full =
        hex.length === 3
          ? hex
              .split("")
              .map((item: string) => item + item)
              .join("")
          : hex;
      const r = parseInt(full.slice(0, 2), 16);
      const g = parseInt(full.slice(2, 4), 16);
      const b = parseInt(full.slice(4, 6), 16);
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
      return luminance > 128 ? "#333333" : "#f5f5f5";
    }
    return this.isDarkMode === "yes" ? "#f5f5f5" : "#333333";
  }

  private updateOverlay() {
    let doc = this.getDoc();
    if (!doc || !doc.body) return;
    let overlay = doc.getElementById("kookit-speed-reading-overlay");
    if (!this.isSpeedReadingActive()) {
      if (overlay && overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
      if (overlay === this.overlayEl) {
        this.overlayEl = null;
      }
      return;
    }
    if (!overlay) {
      overlay = doc.createElement("div");
      overlay.id = "kookit-speed-reading-overlay";
      this.overlayEl = overlay;
      const pageHeight = this.getPageHeight();
      const isScrollMode = this.readerMode === "scroll";
      const position = isScrollMode ? "absolute" : "fixed";
      const visibilityTop = isScrollMode
        ? convertStyleNum(this.getElement().scrollTop as any)
        : 0;
      const element = this.getElement();
      const height = isScrollMode
        ? element.clientHeight
        : doc.defaultView
          ? doc.defaultView.innerHeight
          : pageHeight;
      overlay.style.cssText =
        `position:${position};left:0;width:100%;top:${isScrollMode ? visibilityTop : 0}px;` +
        `height:${Math.max(0, height)}px;z-index:2147483000;display:flex;flex-direction:column;` +
        `align-items:center;justify-content:center;padding-bottom:${Math.round(
          pageHeight * 0.2
        )}px;user-select:none;transition:background-color 0.3s ease;margin:0 !important;padding:0 !important;pointer-events:none;`;
      overlay.style.backgroundColor = this.getOverlayBackground(doc);

      let wordArea = doc.createElement("div");
      wordArea.id = "kookit-speed-reading-word-area";
      wordArea.style.cssText =
        "position:relative;display:flex;align-items:baseline;width:80%;max-width:900px;font-weight:600;line-height:1.6;";
      let left = doc.createElement("span");
      left.id = "kookit-speed-reading-word-left";
      left.style.cssText =
        "flex:1;text-align:right;white-space:pre;overflow:visible;";
      let pivot = doc.createElement("span");
      pivot.id = "kookit-speed-reading-word-pivot";
      pivot.style.cssText =
        "color:#ff3b30 !important;white-space:pre;position:relative;";
      let right = doc.createElement("span");
      right.id = "kookit-speed-reading-word-right";
      right.style.cssText =
        "flex:1;text-align:left;white-space:pre;overflow:visible;";
      let tickTop = doc.createElement("span");
      tickTop.id = "kookit-speed-reading-tick-top";
      let tickBottom = doc.createElement("span");
      tickBottom.id = "kookit-speed-reading-tick-bottom";
      const textColor = this.getTextColor(doc);
      const fontPx = Math.max(28, Math.min(72, Math.round(pageHeight * 0.08)));
      const tickCss = `position:absolute;left:50%;transform:translateX(-50%);width:2px;height:${Math.round(
        fontPx * 0.3
      )}px;background:rgba(128,128,128,0.6);`;
      tickTop.style.cssText = tickCss + `top:-${Math.round(fontPx * 0.45)}px;`;
      tickBottom.style.cssText =
        tickCss + `bottom:-${Math.round(fontPx * 0.45)}px;`;
      wordArea.appendChild(left);
      wordArea.appendChild(pivot);
      wordArea.appendChild(right);
      wordArea.appendChild(tickTop);
      wordArea.appendChild(tickBottom);
      wordArea.style.fontSize = fontPx + "px";
      wordArea.style.color = textColor;

      let status = doc.createElement("div");
      status.id = "kookit-speed-reading-status";
      status.style.cssText =
        "display:none;font-size:" +
        Math.round(fontPx * 0.6) +
        "px;opacity:0.7;";
      status.textContent = "The End";
      status.style.color = textColor;

      let toggle = doc.createElement("div");
      toggle.id = "kookit-speed-reading-toggle";
      toggle.style.cssText =
        `margin-top:${Math.round(fontPx * 0.8)}px;width:56px;height:56px;border-radius:50%;` +
        `display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:22px;` +
        `border:1px solid rgba(128,128,128,0.5);color:${textColor};pointer-events:auto;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;`;
      toggle.appendChild(this.createToggleIcon(doc, this.playing));

      overlay.appendChild(wordArea);
      overlay.appendChild(status);
      overlay.appendChild(toggle);
      doc.body.appendChild(overlay);

      toggle.addEventListener("click", (event: any) => {
        event.stopPropagation();
        this.toggle();
      });
      overlay.addEventListener("click", (event: any) => {
        event.stopPropagation();
        this.toggle();
      });
      // 阻止遮罩上的触摸/滚动事件冒泡到翻页处理器
      const blockEvent = (event: any) => {
        event.stopPropagation();
      };
      overlay.addEventListener("touchstart", blockEvent, { passive: false });
      overlay.addEventListener("touchmove", blockEvent, { passive: false });
      overlay.addEventListener("touchend", blockEvent, { passive: false });
      overlay.addEventListener("wheel", blockEvent, { passive: false });
      overlay.addEventListener("mousedown", blockEvent, false);
      overlay.addEventListener("dblclick", blockEvent, false);
    } else if (overlay !== this.overlayEl) {
      this.overlayEl = overlay;
    }
    if (this.readerMode === "scroll" && this.getElement()) {
      // scroll 模式下遮罩需要跟随外层滚动位置
      overlay.style.top =
        convertStyleNum(this.getElement().scrollTop as any) + "px";
      overlay.style.height = this.getElement().clientHeight + "px";
    }
  }

  removeOverlay() {
    let doc = this.getDoc();
    if (!doc) return;
    let overlay = doc.getElementById("kookit-speed-reading-overlay");
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
    this.overlayEl = null;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private isOverlayValid(doc: Document): boolean {
    if (
      !this.overlayEl ||
      doc.getElementById("kookit-speed-reading-overlay") !== this.overlayEl
    ) {
      return false;
    }
    return true;
  }

  private createToggleIcon(doc: Document, playing: boolean) {
    const svg = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "22");
    svg.setAttribute("height", "22");
    svg.style.cssText = "display:block;fill:currentColor;";
    const path = doc.createElementNS("http://www.w3.org/2000/svg", "path");
    // 播放三角形的几何重心偏左，向右偏移 1px 以达到视觉居中
    path.setAttribute(
      "d",
      playing ? "M7 5h4v14H7zM13 5h4v14h-4z" : "M9 5v14l11-7z"
    );
    svg.appendChild(path);
    return svg;
  }

  private updateToggleIcon() {
    let doc = this.getDoc();
    if (!doc) return;
    let toggle = doc.getElementById("kookit-speed-reading-toggle");
    if (!toggle) return;
    while (toggle.firstChild) {
      toggle.removeChild(toggle.firstChild);
    }
    toggle.appendChild(this.createToggleIcon(doc, this.playing));
  }

  private showEndState() {
    let doc = this.getDoc();
    if (!doc) return;
    let wordArea = doc.getElementById("kookit-speed-reading-word-area");
    let status = doc.getElementById("kookit-speed-reading-status");
    if (wordArea) wordArea.style.display = "none";
    if (status) status.style.display = "block";
  }

  private showWordArea() {
    let doc = this.getDoc();
    if (!doc) return;
    let wordArea = doc.getElementById("kookit-speed-reading-word-area");
    let status = doc.getElementById("kookit-speed-reading-status");
    if (wordArea) wordArea.style.display = "flex";
    if (status) status.style.display = "none";
  }

  private renderWord() {
    let doc = this.getDoc();
    if (!doc) return;
    this.updateOverlay();
    this.showWordArea();
    let left = doc.getElementById("kookit-speed-reading-word-left");
    let pivot = doc.getElementById("kookit-speed-reading-word-pivot");
    let right = doc.getElementById("kookit-speed-reading-word-right");
    if (!left || !pivot || !right) return;
    let word = this.words[this.index] || "";
    let chars = Array.from(word);
    if (chars.length === 0) {
      left.textContent = "";
      pivot.textContent = "";
      right.textContent = "";
      this.showEndState();
      return;
    }
    let orp = Math.min(getSpeedReadingORPIndex(word), chars.length - 1);
    left.textContent = chars.slice(0, orp).join("");
    pivot.textContent = chars[orp];
    right.textContent = chars.slice(orp + 1).join("");
  }

  // 供外部调用的公开接口
  start() {
    if (!this.isSpeedReadingActive() || this.playing) return;
    let doc = this.getDoc();
    if (!doc) return;
    this.playing = true;
    this.updateOverlay();
    this.updateToggleIcon();
    if (this.words.length === 0) {
      this.words = this.extractWords();
      this.index = 0;
    }
    if (this.words.length === 0) {
      this.pause();
      this.showEndState();
      return;
    }
    this.renderWord();
    this.scheduleNext();
  }

  pause() {
    this.playing = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.updateToggleIcon();
  }

  toggle() {
    let doc = this.getDoc();
    if (!doc) return;
    if (this.playing) {
      this.pause();
    } else {
      this.start();
    }
  }

  private scheduleNext() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (!this.playing) return;
    let doc = this.getDoc();
    if (!doc || !this.isOverlayValid(doc)) return;
    const word = this.words[this.index] || "";
    const wpm = this.speedReadingSpeed || 300;
    const delay = getSpeedReadingWordDelay(word, wpm);
    this.timer = setTimeout(async () => {
      this.timer = null;
      let currentDoc = this.getDoc();
      if (!this.playing || !currentDoc || !this.isOverlayValid(currentDoc)) {
        return;
      }
      await this.showNextWord();
    }, delay);
  }

  private async showNextWord() {
    if (!this.playing) return;
    if (this.index < this.words.length - 1) {
      this.index++;
      this.renderWord();
      this.scheduleNext();
      return;
    }
    // 当前页单词展示完毕，自动翻页
    await this.flipPage(1);
  }

  private getPageKey(): string {
    let progress = this.getProgress();
    return JSON.stringify([
      this.getChapterDocIndex(),
      progress?.currentPage,
      progress?.totalPage,
    ]);
  }

  async flipPage(direction: number) {
    let doc = this.getDoc();
    if (!doc) {
      this.pause();
      return;
    }
    this.skipFlip = true;
    try {
      let attempts = 0;
      while (attempts < 5 && this.playing) {
        const beforeKey = this.getPageKey();
        if (direction > 0) {
          await this.nextPage();
        } else {
          await this.prevPage();
        }
        await new Promise((r) =>
          setTimeout(r, this.readerMode === "scroll" ? 400 : 150)
        );
        const afterKey = this.getPageKey();
        this.words = this.extractWords();
        if (this.words.length > 0) {
          this.index = direction > 0 ? 0 : this.words.length - 1;
          this.updateOverlay();
          this.renderWord();
          break;
        }
        if (beforeKey === afterKey) {
          // 页面没有变化，说明已经到达书籍末尾，暂停速读
          this.pause();
          this.words = [];
          this.index = 0;
          this.showEndState();
          return;
        }
        attempts++;
      }
    } finally {
      this.skipFlip = false;
    }
    this.scheduleNext();
  }

  // 由 GeneralRender 的 rendered 事件驱动
  public handleRendered() {
    if (!this.isSpeedReadingActive()) {
      this.pause();
      this.removeOverlay();
      return;
    }
    let doc = this.getDoc();
    if (!doc || !doc.body) return;
    this.words = this.extractWords();
    this.index = 0;
    this.updateOverlay();
    this.updateToggleIcon();
    if (this.words.length === 0) {
      this.showEndState();
      if (this.timer) {
        clearTimeout(this.timer);
        this.timer = null;
      }
      return;
    }
    this.showWordArea();
    this.renderWord();
    if (!this.autoStarted) {
      // 首次渲染自动开始播放
      this.autoStarted = true;
      this.start();
    } else if (this.playing) {
      this.scheduleNext();
    }
  }
}

export default SpeedReadingManager;
