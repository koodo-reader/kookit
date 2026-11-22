let keywords = [
  "章",
  "节",
  "回",
  "節",
  "卷",
  "部",
  "輯",
  "辑",
  "話",
  "集",
  "话",
  "篇",
  " ",
  "　",
];
let containChars = [];
// let containChars = ["[", "。", "；", ";"];
let startWithChars = [
  "CHAPTER",
  "Chapter",
  "序章",
  "前言",
  "声明",
  "写在前面的话",
  "后记",
  "楔子",
  "后序",
  "章节目录",
  "尾声",
  "聲明",
  "引子",
  "序言",
  "题记",
  "开篇",
  "开篇词",
  "卷首",
  "卷首语",
  "引言",
  "导言",
  "入话",
  "作者的话",
  "写在前面",
  "重要声明",
  "免责声明",
  "版权声明",
  "致读者",
  "特别说明",
  "终章",
  "大结局",
  "完结感言",
  "完结篇",
  "写在后面的话",
  "作者有话说",
  "感言",
  "番外",
  "番外篇",
  "外传",
  "特别篇",
  "特别篇目",
  "附录",
  "小剧场",
  "彩蛋",
  "寫在前面的話",
  "後記",
  "後序",
  "章節目錄",
  "尾聲",
  "題記",
  "開篇",
  "開篇詞",
  "卷首語",
  "導言",
  "入話",
  "作者的話",
  "寫在前面",
  "重要聲明",
  "免責聲明",
  "版權聲明",
  "致讀者",
  "特別說明",
  "終章",
  "大結局",
  "完結感言",
  "完結篇",
  "寫在後面的話",
  "作者有話說",
  "外傳",
  "特別篇",
  "特別篇目",
  "附錄",
  "小劇場",
];
let startWithNumAndChars = [" ", "　", "、", "·", ".", "：", ":"];
export const findLastIndex = (arr: any[], callback: (item: any) => boolean) => {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (callback(arr[i])) {
      return i;
    }
  }
  return -1;
};
// 同名章节可能出现在书首目录、不同分卷里。按整篇解析的规则统计每一处标题
// 将生成的章节序号（开头无标题的一段会单独成章，连续出现的标题只有最后
// 一个存活），再挑出与保存的 chapterDocIndex 最接近的一处标题。
export const findChapterTitleLine = (
  lines: string[],
  candidates: number[],
  chapterDocIndex: number,
  hasPreambleChapter: boolean,
  isChapterTitle: (item: string) => boolean
) => {
  let chapterCount = hasPreambleChapter ? 1 : 0;
  let pendingChapterIndex = chapterCount;
  let hasPendingTitle = false;
  let result = -1;
  let resultDistance = Infinity;
  let candidatePointer = 0;
  const lastCandidate = candidates[candidates.length - 1];
  for (let lineIndex = 0; lineIndex <= lastCandidate; lineIndex++) {
    const item = lines[lineIndex];
    const isCandidate = candidates[candidatePointer] === lineIndex;
    if (isCandidate) {
      candidatePointer++;
    }
    if (isChapterTitle(item)) {
      if (!hasPendingTitle) {
        pendingChapterIndex = chapterCount;
      }
      hasPendingTitle = true;
      if (isCandidate) {
        const distance = Math.abs(pendingChapterIndex - chapterDocIndex);
        // 序号相同时取靠后的标题：连续标题里只有最后一个会生成章节
        if (
          distance < resultDistance ||
          (distance === resultDistance && lineIndex > result)
        ) {
          resultDistance = distance;
          result = lineIndex;
        }
      }
    } else if (item.trim() !== "" && hasPendingTitle) {
      // 正文出现后，前面的标题才真正生成章节，序号随之递增
      chapterCount = pendingChapterIndex + 1;
      hasPendingTitle = false;
      // 已经找到匹配项，后面的候选只会离保存的序号更远，可以提前结束
      if (result !== -1 && chapterCount > chapterDocIndex) {
        break;
      }
    }
  }
  return result;
};
export const txtToHtml = (
  text: string,
  parserRegex: string,
  bookLocation?: any
) => {
  let lines = text.split("\n");
  if (lines.length === 1) {
    lines = text.split("\r");
  }
  // 丢弃文件开头的纯空白行，避免空白内容脱离第一个章节标题单独成章
  while (lines.length > 0 && lines[0].trim() === "") {
    lines.shift();
  }

  const htmlParts: string[] = []; // Use an array to store HTML parts
  let prependHtml = ""; // 占位章节必须排在切片内容前面，单独拼接避免参数过多
  let isRefresh = false;
  let noTitle = false;
  if (bookLocation && bookLocation.refresh) {
    isRefresh = true;
  }
  if (bookLocation && bookLocation.noTitle) {
    noTitle = true;
  }
  if (noTitle) {
    //分章方式改成每500行分一章，且不进行标题识别
    let chapterIndex = 0;
    if (lines.length === 0) {
      // 纯空白行文件，避免生成空 HTML 导致 noTitle 兜底无限递归
      htmlParts.push(`<h1 class="hide">Chapter 0</h1>`);
      chapterIndex = 1;
    }
    for (let i = 0; i < lines.length; i += 500) {
      const chapterLines = lines.slice(i, i + 500);
      htmlParts.push(`<h1 class="hide">Chapter ${chapterIndex}</h1>`); // Push chapter title to array
      chapterLines.forEach((line) => {
        if (line.trim() === "") {
          htmlParts.push(`<p class="hide">${line}</p>`); // Push line break for empty lines
        } else {
          htmlParts.push(`<p>${line}</p>`); // Push line content to array
        }
      });
      chapterIndex++;
    }
  } else if (lines.length > 10000 && !isRefresh) {
    if (!bookLocation || !bookLocation.chapterTitle) {
      bookLocation = {
        text: lines[0],
        chapterTitle: "",
        chapterDocIndex: 0,
      };
    }
    if (!bookLocation.text) {
      bookLocation.text = bookLocation.chapterTitle || "";
    }
    // --- Slicing and Title Identification Logic ---
    // 章节名可能在书首目录、不同分卷里重复出现，只取最后一次出现会把切片
    // 带到别的分卷。先收集所有同名标题，再用保存的章节序号判断哪一处属于
    // 当前章节，最后取离它最近的正文匹配。
    const cleanedLocationText = cleanText(bookLocation.text);
    const cleanedChapterTitle = cleanText(bookLocation.chapterTitle || "");
    let titleLineIndex = -1;
    let targetLineIndex = -1;
    if (cleanedChapterTitle) {
      const chapterTitleLineIndexes: number[] = [];
      const locationLineIndexes: number[] = [];
      for (let index = 0; index < lines.length; index++) {
        const cleanedLine = cleanText(lines[index]);
        if (lines[index] && cleanedLine === cleanedChapterTitle) {
          chapterTitleLineIndexes.push(index);
        }
        if (cleanedLocationText && cleanedLine === cleanedLocationText) {
          locationLineIndexes.push(index);
        }
      }
      if (chapterTitleLineIndexes.length === 1) {
        titleLineIndex = chapterTitleLineIndexes[0];
      } else if (chapterTitleLineIndexes.length > 1) {
        const titleRegex = parserRegex ? new RegExp(parserRegex) : null;
        const isChapterTitle = (item: string) => {
          if (!item) return false;
          if (!titleRegex) return !!isTitle(item);
          titleRegex.lastIndex = 0;
          return titleRegex.test(item);
        };
        // 第一个存活标题之前的行会形成一个无标题章节，其后序号顺延；
        // 开头连续出现的标题只有最后一个存活，前面会被降级成正文
        let hasPreambleChapter = !isChapterTitle(lines[0]);
        if (!hasPreambleChapter) {
          for (let index = 1; index < lines.length; index++) {
            if (isChapterTitle(lines[index])) {
              hasPreambleChapter = true;
              break;
            }
            if (lines[index].trim() !== "") break;
          }
        }
        titleLineIndex = findChapterTitleLine(
          lines,
          chapterTitleLineIndexes,
          parseInt(bookLocation.chapterDocIndex, 10),
          hasPreambleChapter,
          isChapterTitle
        );
        if (titleLineIndex === -1) {
          // 章节序号缺失或标题判定规则变化时，保持原来的兜底行为
          titleLineIndex =
            chapterTitleLineIndexes[chapterTitleLineIndexes.length - 1];
        }
      }
      if (locationLineIndexes.length === 0) {
        // 正文没匹配到（例如阅读记录已过期）时，以章节标题为中心切片
        targetLineIndex = titleLineIndex;
      } else if (titleLineIndex === -1) {
        targetLineIndex = locationLineIndexes[0];
      } else {
        let closestDistance = Infinity;
        for (const index of locationLineIndexes) {
          // 保存的正文应该位于章节标题之后，标题之前的同名内容属于上一章
          if (index < titleLineIndex) continue;
          const distance = index - titleLineIndex;
          if (distance < closestDistance) {
            closestDistance = distance;
            targetLineIndex = index;
          }
        }
        if (targetLineIndex === -1) {
          // 正文只匹配到标题之前（阅读记录可能已过期）时，以标题为准
          targetLineIndex = titleLineIndex;
        }
      }
    } else {
      // 没有章节标题时无需对齐，取第一处匹配即可（避免扫描整本大文件）
      targetLineIndex = lines.findIndex(
        (item) => cleanText(item) === cleanedLocationText
      );
    }
    if (targetLineIndex === -1) {
      targetLineIndex = 0;
    }

    // Slice the lines array
    const startIndex = Math.max(targetLineIndex - 3000, 0);
    const endIndex = Math.min(targetLineIndex + 3000, lines.length);
    const relevantLines = lines.slice(startIndex, endIndex); // Process only the relevant slice
    // Identify potential titles within the relevant slice
    const titlesInSlice = relevantLines.filter((item) => {
      return item && isTitle(item, parserRegex);
    });
    if (titlesInSlice.length <= 1) {
      // Fallback to processing the entire file if no titles found in slice
      return txtToHtml(text, parserRegex, { noTitle: true });
    }

    // Create a Set of cleaned titles for fast lookup
    const cleanedTitlesSet = new Set(
      titlesInSlice.map((title) => cleanText(title))
    );

    // --- Main Loop for Relevant Lines ---
    // 章节标题的判定必须和整篇解析一致：只有后面跟着正文的标题才算章节，
    // 连续出现的标题（例如正文前的章节目录）降级成正文段落。否则分段解析出的
    // 章节序号会和整篇解析错位：目录条目会变成一个个只有标题的空章节，
    // 刷新目录后旧序号还会指向别的章节，导致翻到章节末尾无法进入下一章。
    const chapterTitleList: string[] = [];
    const chapterTitleLineList: number[] = [];
    let lastTitleIndex = -1;
    let hasContentSinceTitle = false;
    for (let index = 0; index < relevantLines.length; index++) {
      const item = relevantLines[index];
      const cleanedItem = cleanText(item); // Clean once per line
      // Use the Set for O(1) average lookup
      if (cleanedItem && cleanedTitlesSet.has(cleanedItem)) {
        if (lastTitleIndex !== -1 && !hasContentSinceTitle) {
          // 上一个标题只有标题没有正文，降级为正文段落，剔除出目录
          htmlParts[lastTitleIndex] = `<p>${htmlParts[lastTitleIndex].slice(
            4,
            -5
          )}</p>`;
          chapterTitleList.pop();
          chapterTitleLineList.pop();
        }
        lastTitleIndex = htmlParts.length;
        htmlParts.push(`<h1>${cleanedItem}</h1>`); // Push to array
        chapterTitleList.push(cleanedItem);
        chapterTitleLineList.push(startIndex + index);
        hasContentSinceTitle = false;
      } else if (item.trim() === "") {
        htmlParts.push(`<p class="hide">${item}</p>`); // Push line break for empty lines
      } else {
        // Avoid cleaning again if not necessary, use original item for content
        htmlParts.push(`<p>${item}</p>`); // Push to array
        hasContentSinceTitle = true;
      }
    }

    // --- Prepending Logic (if needed) ---
    // 这里的占位章节用来把切片里的章节序号对齐到整篇解析的序号，
    // 切片开头的正文会并入最后一个占位章节，只有切片从文件开头开始时
    // 那段正文才是完整的第一章，不需要占位
    // 用标题所在行定位切片内的章节序号，避免切片里也有同名标题时取错
    let targetTitleIndex = chapterTitleLineList.indexOf(titleLineIndex);
    if (targetTitleIndex === -1) {
      targetTitleIndex = findLastIndex(chapterTitleList, (item) => {
        return item === cleanedChapterTitle;
      });
    }
    if (targetTitleIndex === -1) {
      targetTitleIndex = 0;
    }
    const prependLength =
      parseInt(bookLocation.chapterDocIndex || "0") -
      targetTitleIndex -
      (startIndex === 0 ? 1 : 0);
    if (prependLength > 0) {
      const prependParts: string[] = [];
      for (let i = 0; i < prependLength; i++) {
        prependParts.push(`<h1>Prepend ${i}</h1>`);
        prependParts.push(`<p>Text ${i}</p>`);
      }
      prependHtml = prependParts.join("");
    }
  } else {
    // --- Loop for Full File (if not large or no bookLocation) ---
    let lastTitleIndex = -1;
    let hasContentSinceTitle = false;
    for (const item of lines) {
      if (item && isTitle(item, parserRegex)) {
        if (lastTitleIndex !== -1 && !hasContentSinceTitle) {
          // 上一个章节只有标题没有正文，降级为正文段落，剔除出目录
          htmlParts[lastTitleIndex] = `<p>${htmlParts[lastTitleIndex].slice(
            4,
            -5
          )}</p>`;
        }
        lastTitleIndex = htmlParts.length;
        htmlParts.push(`<h1>${item}</h1>`); // Push to array
        hasContentSinceTitle = false;
      } else {
        if (item.trim() === "") {
          htmlParts.push(`<p class="hide">${item}</p>`); // Push line break for empty lines
          continue; // Skip further processing for empty lines
        }
        htmlParts.push(`<p>${item}</p>`); // Push to array
        hasContentSinceTitle = true;
      }
    }
    if (lastTitleIndex !== -1 && !hasContentSinceTitle) {
      // 文件末尾最后一个标题只有标题没有正文，降级为正文段落，剔除出目录
      htmlParts[lastTitleIndex] = `<p>${htmlParts[lastTitleIndex].slice(
        4,
        -5
      )}</p>`;
    }
  }

  // Join the array at the end
  const finalHtml = prependHtml + htmlParts.join("");

  if (finalHtml && finalHtml.includes("<h1")) {
    return finalHtml;
  } else {
    return txtToHtml(text, parserRegex, { noTitle: true });
  }
};
export const cleanText = (str) => {
  return str
    .trim()
    .replace(/(\r\n|\n|\r|\t)/gm, "")
    .substring(0, 100)
    .replace(/[=\-_+]/g, "");
};
export const isTitle = (line: any, parserRegex: string = "") => {
  if (parserRegex) {
    return new RegExp(parserRegex).test(line);
  }
  line = cleanText(line); // Clean once per line
  return (
    line &&
    line.length < 50 &&
    !isContain(line) &&
    (isStartWithChars(line) ||
      (line.startsWith("第") && startWithDI(line)) ||
      (line.startsWith("卷") && startWithJUAN(line)) ||
      (line.indexOf("第") > -1 &&
        line.lastIndexOf("第") < 7 &&
        startWithDI(line.substr(line.indexOf("第")))))
  );
};

const isContain = (line: string) => {
  return containChars.filter((item) => line.indexOf(item) > -1).length > 0;
};
const isStartWithChars = (line: string) => {
  return startWithChars.filter((item) => line.startsWith(item)).length > 0;
};
//过于敏感已弃用
const isStartWithNumAndChars = (line: string) => {
  return (
    startWithNumAndChars.filter(
      (item) =>
        line.indexOf(item) > -1 &&
        (/^[\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341\u767e\u5343\u4e07\u842c\u96f6]+$/.test(
          line.substring(0, line.indexOf(item))
        ) ||
          /^\d+$/.test(line.substring(0, line.indexOf(item))))
    ).length > 0
  );
};
const startWithDI = (line) => {
  let flag = false;
  for (let i = 0; i < keywords.length; i++) {
    if (
      /^[\u96f6\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341\u767e\u5343\u4e07\u4ebf\u5146\u5eff\u5345\u62fe\u4f70\u4edf\u58f9\u8d30\u53c1\u8086\u4f0d\u9646\u67d2\u634c\u7396\u4e24\u842c\u5169]+$/.test(
        line.substring(1, line.indexOf(keywords[i])).trim()
      ) ||
      /^\d+$/.test(line.substring(1, line.indexOf(keywords[i])).trim())
    ) {
      flag = true;
    }
    if (flag) break;
  }
  return flag;
};
const startWithJUAN = (line) => {
  let regExp =
    /^[\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341\u767e\u5343\u4e07\u842c\u96f6]+$/;
  if (
    regExp.test(line.substring(1, line.indexOf(" "))) ||
    /^\d+$/.test(line.substring(1, line.indexOf(" ")))
  )
    return true;
  if (
    regExp.test(line.substring(1, line.indexOf("　"))) ||
    /^\d+$/.test(line.substring(1, line.indexOf("　")))
  )
    return true;
  if (
    regExp.test(line.substring(1, line.indexOf("·"))) ||
    /^\d+$/.test(line.substring(1, line.indexOf("·")))
  )
    return true;
  if (regExp.test(line.substring(1)) || /^\d+$/.test(line.substring(1)))
    return true;
  return false;
};
