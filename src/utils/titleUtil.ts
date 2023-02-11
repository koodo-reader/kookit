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
(String as any).prototype.contains = function (str) {
  return this.indexOf(str) > -1;
};
export const getTitleElement = (Element) => {
  return Array.from(
    Element.querySelectorAll("h1,h2,h3,h4,h5,h6,title")
  ) as HTMLElement[];
};
export const getBlockElement = (Element) => {
  return Array.from(
    Element.querySelectorAll(
      "h1,h2,h3,h4,h5,h6,p,div,ul,dl,ol,pre,blockquote,address"
    )
  ) as HTMLElement[];
};
export const getImageElement = (Element) => {
  return Array.from(Element.querySelectorAll("img")) as HTMLElement[];
};
export const cleanText = (str) => {
  return str
    .trim()
    .replace(/(\r\n|\n|\r)/gm, "")
    .substring(0, 100);
};
export const handleImageMarker = (bookStr) => {
  let chapterDoc = new DOMParser().parseFromString(bookStr, "text/html") as any;
  let imgDomList = getImageElement(chapterDoc);
  if (imgDomList.length === 0) {
    return bookStr;
  } else {
    for (let i = 0; i < imgDomList.length; i++) {
      var newItem = document.createElement("address");
      var textnode = document.createTextNode("img");
      newItem.appendChild(textnode);
      newItem.setAttribute("style", "visibility: hidden; position: absolute");
      if (imgDomList[i].parentNode) {
        (imgDomList[i].parentNode as any).insertBefore(newItem, imgDomList[i]);
      }
    }
    return chapterDoc.documentElement.innerHTML;
  }
};
export const isTitle = (line, isStartWithKeyword = false) => {
  return (
    line &&
    !line.contains("[") &&
    !line.contains("(") &&
    !line.contains("。") &&
    !line.contains("“") &&
    !line.contains("‘") &&
    !line.contains("；") &&
    !line.contains(";") &&
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
        line.contains("第") &&
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
export const startWithDI = (line) => {
  let flag = false;
  for (let i = 0; i < keywords.length; i++) {
    if (
      (line.indexOf(keywords[i]) > -1 &&
        (line[line.indexOf(keywords[i]) + 1] === " " ||
          line[line.indexOf(keywords[i]) + 1] === "　" ||
          line[line.indexOf(keywords[i]) + 1] === "、" ||
          line[line.indexOf(keywords[i]) + 1] === "：" ||
          line.indexOf("章") > -1 ||
          line[line.indexOf(keywords[i]) + 1] === ":")) ||
      !line[line.indexOf(keywords[i]) + 1]
    ) {
      if (
        /^[\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341\u767e\u5343\u4e07\u842c\u96f6]+$/.test(
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
const startWithJUAN = (line) => {
  if (
    /^[\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341\u767e\u5343\u4e07\u842c\u96f6]+$/.test(
      line.substring(1, line.indexOf(" "))
    ) ||
    /^\d+$/.test(line.substring(1, line.indexOf(" ")))
  )
    return true;
  if (
    /^[\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341\u767e\u5343\u4e07\u842c\u96f6]+$/.test(
      line.substring(1, line.indexOf("　"))
    ) ||
    /^\d+$/.test(line.substring(1, line.indexOf("　")))
  )
    return true;
  if (
    /^[\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341\u767e\u5343\u4e07\u842c\u96f6]+$/.test(
      line.substring(1)
    ) ||
    /^\d+$/.test(line.substring(1))
  )
    return true;
  return false;
};

const startWithNumAndSpace = (line) => {
  if (
    /^[\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341\u767e\u5343\u4e07\u842c\u96f6]+$/.test(
      line.substring(0, line.indexOf(" "))
    )
  )
    return true;
  if (
    /^[\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341\u767e\u5343\u4e07\u842c\u96f6]+$/.test(
      line.substring(0, line.indexOf("　"))
    )
  )
    return true;

  if (/^\d+$/.test(line.substring(0, line.indexOf(" ")))) return true;
  if (/^\d+$/.test(line.substring(0, line.indexOf("　")))) return true;
  return false;
};
const startWithNumAndColon = (line) => {
  if (
    /^[\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341\u767e\u5343\u4e07\u842c\u96f6]+$/.test(
      line.substring(0, line.indexOf(":"))
    )
  )
    return true;
  if (
    /^[\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341\u767e\u5343\u4e07\u842c\u96f6]+$/.test(
      line.substring(0, line.indexOf("："))
    )
  )
    return true;

  if (/^\d+$/.test(line.substring(0, line.indexOf(":")))) return true;
  if (/^\d+$/.test(line.substring(0, line.indexOf("：")))) return true;
  return false;
};
const startWithNumAndPause = (line) => {
  if (
    /^[\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341\u767e\u5343\u4e07\u842c\u96f6]+$/.test(
      line.substring(0, line.indexOf("、"))
    )
  )
    return true;

  if (/^\d+$/.test(line.substring(0, line.indexOf("、")))) return true;
  return false;
};
export const isNodeTitle = (chapterDoc) => {
  let titleNodeList = getTitleElement(chapterDoc);
  let isTitleNodeExist = titleNodeList.length > 0;
  let textNodeList = chapterDoc.getElementsByTagName("p");
  let firstValidTitle;
  let firstValidText;

  for (let i = 0; i < titleNodeList.length; i++) {
    let isSpecial =
      firstValidTitle &&
      isSpecialChar(titleNodeList[i].innerText) &&
      isKeyword(titleNodeList[i].innerText);
    if (titleNodeList[i].innerText.trim() && !isSpecial) {
      firstValidTitle = titleNodeList[i];
      break;
    }
  }
  for (let i = 0; i < textNodeList.length; i++) {
    if (
      textNodeList[i].innerText.trim() &&
      textNodeList[i].innerHTML.indexOf("<") === -1
    ) {
      firstValidText = textNodeList[i];
      break;
    }
  }

  let titleNodeExceedLength =
    firstValidTitle && firstValidTitle.innerText.trim().length > 30;
  let isTextLengthLarge = chapterDoc.body.innerText.length > 50;
  return (
    isTitleNodeExist &&
    (!titleNodeExceedLength || isTitle(firstValidTitle.innerText.trim())) &&
    isTextLengthLarge
  );
};
export const isSpecialChar = (title) => {
  return (
    title.trim() === "♦" ||
    title.trim() === "●" ||
    title.trim() === "◾" ||
    title.trim() === "◀" ||
    title.trim() === "◼" ||
    title.trim() === "■"
  );
};
export const isKeyword = (title) => {
  return (
    title.trim() === "|" ||
    title.trim() === "Next" ||
    title.trim() === "Main menu" ||
    title.trim() === "Section menu" ||
    title.trim() === "Previous"
  );
};
