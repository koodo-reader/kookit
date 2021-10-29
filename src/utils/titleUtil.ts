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
];
export const isTitle = (line: string, isStartWithKeyword: boolean = false) => {
  return (
    line &&
    line.indexOf("[") === -1 &&
    line.indexOf("(") === -1 &&
    line.indexOf("。") === -1 &&
    (line.startsWith("CHAPTER") ||
      line.startsWith("Chapter") ||
      line.startsWith("序章") ||
      line.startsWith("前言") ||
      line.startsWith("声明") ||
      line.startsWith("聲明") ||
      line.startsWith("写在前面的话") ||
      line.startsWith("后记") ||
      line.startsWith("楔子") ||
      line.startsWith("后序") ||
      line.startsWith("寫在前面的話") ||
      line.startsWith("後記") ||
      line.startsWith("後序") ||
      (line.startsWith("第") && startWithDI(line)) ||
      (line.startsWith("卷") && startWithJUAN(line)) ||
      (!isStartWithKeyword &&
        line.indexOf("第") > -1 &&
        (line[line.indexOf("第") - 1] === " " ||
          line[line.indexOf("第") - 1] === "　" ||
          line[line.indexOf("第") - 1] === "、" ||
          line[line.indexOf("第") - 1] === "：" ||
          line[line.indexOf("第") - 1] === ":") &&
        startWithDI(line.substr(line.indexOf("第")))) ||
      (!isStartWithKeyword &&
        line.indexOf(" ") &&
        startWithNumAndSpace(line)) ||
      (!isStartWithKeyword &&
        line.indexOf("　") &&
        startWithNumAndSpace(line)) ||
      (!isStartWithKeyword &&
        line.indexOf("、") &&
        startWithNumAndPause(line)) ||
      (!isStartWithKeyword &&
        line.indexOf("：") &&
        startWithNumAndColon(line)) ||
      (!isStartWithKeyword && line.indexOf(":") && startWithNumAndColon(line)))
  );
};
export const startWithDI = (line: string) => {
  let flag = false;
  for (let i = 0; i < keywords.length; i++) {
    if (
      (line.indexOf(keywords[i]) > -1 &&
        (line[line.indexOf(keywords[i]) + 1] === " " ||
          line[line.indexOf(keywords[i]) + 1] === "　" ||
          line[line.indexOf(keywords[i]) + 1] === "、" ||
          line[line.indexOf(keywords[i]) + 1] === "：" ||
          line[line.indexOf(keywords[i]) + 1] === ":")) ||
      !line[line.indexOf(keywords[i]) + 1]
    ) {
      if (
        /^[\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341\u767e\u5343\u4e07\u842c]+$/.test(
          line.substring(1, line.indexOf(keywords[i])).trim()
        ) ||
        /^\d+$/.test(line.substring(1, line.indexOf(keywords[i])).trim())
      ) {
        flag = true;
      }
      if (flag) break;
    }
  }
  return flag;
};
const startWithJUAN = (line: string) => {
  if (
    /^[\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341\u767e\u5343\u4e07\u842c]+$/.test(
      line.substring(1, line.indexOf(" "))
    ) ||
    /^\d+$/.test(line.substring(1, line.indexOf(" ")))
  )
    return true;
  if (
    /^[\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341\u767e\u5343\u4e07\u842c]+$/.test(
      line.substring(1, line.indexOf("　"))
    ) ||
    /^\d+$/.test(line.substring(1, line.indexOf("　")))
  )
    return true;
  if (
    /^[\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341\u767e\u5343\u4e07\u842c]+$/.test(
      line.substring(1)
    ) ||
    /^\d+$/.test(line.substring(1))
  )
    return true;
  return false;
};

const startWithNumAndSpace = (line: string) => {
  if (
    /^[\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341\u767e\u5343\u4e07\u842c]+$/.test(
      line.substring(0, line.indexOf(" "))
    )
  )
    return true;
  if (
    /^[\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341\u767e\u5343\u4e07\u842c]+$/.test(
      line.substring(0, line.indexOf("　"))
    )
  )
    return true;

  if (/^\d+$/.test(line.substring(0, line.indexOf(" ")))) return true;
  if (/^\d+$/.test(line.substring(0, line.indexOf("　")))) return true;
  return false;
};
const startWithNumAndColon = (line: string) => {
  if (
    /^[\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341\u767e\u5343\u4e07\u842c]+$/.test(
      line.substring(0, line.indexOf(":"))
    )
  )
    return true;
  if (
    /^[\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341\u767e\u5343\u4e07\u842c]+$/.test(
      line.substring(0, line.indexOf("："))
    )
  )
    return true;

  if (/^\d+$/.test(line.substring(0, line.indexOf(":")))) return true;
  if (/^\d+$/.test(line.substring(0, line.indexOf("：")))) return true;
  return false;
};
const startWithNumAndPause = (line: string) => {
  if (
    /^[\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341\u767e\u5343\u4e07\u842c]+$/.test(
      line.substring(0, line.indexOf("、"))
    )
  )
    return true;

  if (/^\d+$/.test(line.substring(0, line.indexOf("、")))) return true;
  return false;
};
export const isNodeTitle = (chapterDoc: Document) => {
  let isTitleNodeExist =
    chapterDoc.querySelectorAll("h1,h2,h3,h4,blockquote,font,b").length > 0;

  let titleNodeList = chapterDoc.querySelectorAll(
    "h1,h2,h3,h4,blockquote,font,b"
  );
  let textNodeList = chapterDoc.querySelectorAll("p");
  let firstValidTitle;
  let firstValidText;

  for (let i = 0; i < titleNodeList.length; i++) {
    let isSpecialChar =
      firstValidTitle &&
      ((titleNodeList[i] as HTMLElement).innerText.trim() === "♦" ||
        (titleNodeList[i] as HTMLElement).innerText.trim() === "●" ||
        (titleNodeList[i] as HTMLElement).innerText.trim() === "◾" ||
        (titleNodeList[i] as HTMLElement).innerText.trim() === "◀" ||
        (titleNodeList[i] as HTMLElement).innerText.trim() === "◼" ||
        (titleNodeList[i] as HTMLElement).innerText.trim() === "■");
    if ((titleNodeList[i] as HTMLElement).innerText.trim() && !isSpecialChar) {
      firstValidTitle = titleNodeList[i] as HTMLElement;
      break;
    }
  }
  for (let i = 0; i < textNodeList.length; i++) {
    if (
      (textNodeList[i] as HTMLElement).innerText.trim() &&
      (textNodeList[i] as HTMLElement).innerHTML.indexOf("<") === -1
    ) {
      firstValidText = textNodeList[i] as HTMLElement;
      break;
    }
  }
  let isTitleFirst = true;
  if (firstValidTitle && firstValidText) {
    let nodeList = chapterDoc.querySelectorAll("*");
    let textList: string[] = [];
    for (let i = 0; i < nodeList.length; i++) {
      (nodeList[i] as HTMLElement).innerText &&
        textList.push((nodeList[i] as HTMLElement).innerText);
    }
    if (
      textList.indexOf(firstValidText.innerText) <
      textList.indexOf(firstValidTitle.innerText)
    ) {
      isTitleFirst = false;
    }
  }

  let titleNodeExceedLength =
    firstValidTitle && firstValidTitle.innerText.trim().length > 30;
  let isTextLengthLarge = (chapterDoc as any).body.innerText.length > 50;
  return (
    isTitleNodeExist &&
    (!titleNodeExceedLength || isTitle(firstValidTitle.innerText.trim())) &&
    isTitleFirst &&
    isTextLengthLarge
  );
};
