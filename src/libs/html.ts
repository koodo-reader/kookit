import Chinese from "chinese-s2t";
export const makeHtmlBook = (
  bookStr: string,
  isTxt = false,
  parserRegex = ""
) => {
  const bookDoc = new DOMParser().parseFromString(
    isTxt ? txtToHtml(bookStr, parserRegex) : bookStr,
    "text/html"
  );
  let chapterDomList = getTitleElement(bookDoc);
  if (chapterDomList.length === 0) {
    chapterDomList = getTitlefromText(bookDoc) as any;
  }
  for (let i = 0; i < chapterDomList.length; i++) {
    // this.chapterDomList[i].id = this.chapterList[i].id;
    var newItem = document.createElement("address");
    var textnode = document.createTextNode(" ");
    newItem.appendChild(textnode);

    chapterDomList[i].parentNode &&
      chapterDomList[i].parentNode!.insertBefore(newItem, chapterDomList[i]);
  }
  const chapterList = getChapterDoc(bookDoc.body.innerHTML);
  const load = async (index: number) => {
    const page = URL.createObjectURL(
      new Blob([chapterList[index].text], { type: "text/html" })
    );
    return page;
  };
  const unload = (index: number) => {};
  const book: any = {};
  book.getCover = () => "";
  book.sections = chapterList.map((item) => ({
    id: item.index,
    load: () => load(item.index),
    unload: () => unload(item.index),
  }));
  book.toc = chapterList
    .map((item) => ({
      label: item.label,
      href: "title" + item.index,
    }))
    .filter((item) => item.label !== "");
  book.rendition = { layout: "pre-paginated" };
  book.resolveHref = (href: string) => {
    return { index: parseInt(href.substring(5, href.length)) };
  };
  book.splitTOCHref = (href) => [href, null];
  book.getTOCFragment = (doc) => doc.documentElement;
  return book;
};
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
  "尾声",
];
let startWithNumAndChars = [" ", "　", "、", "·", ".", "：", ":"];

const getTitleElement = (Element) => {
  return Array.from(
    Element.querySelectorAll("h1,h2,h3,h4,h5,h6,title")
  ) as HTMLElement[];
};
export const cleanText = (str) => {
  return str
    .trim()
    .replace(/(\r\n|\n|\r|\t)/gm, "")
    .substring(0, 100)
    .split("")
    .filter(
      (item: string) =>
        item !== "=" && item !== "-" && item !== "_" && item !== "+"
    )
    .join("");
};

const isTitle = (line: any, parserRegex: string = "") => {
  if (parserRegex) {
    return new RegExp(parserRegex).test(line);
  }
  return (
    line &&
    line.length < 40 &&
    !isContain(line) &&
    (isStartWithChars(line) ||
      (line.startsWith("第") && startWithDI(line)) ||
      (line.startsWith("卷") && startWithJUAN(line)) ||
      (line.indexOf("第") > -1 &&
        line.lastIndexOf("第") < 4 &&
        startWithDI(line.substr(line.indexOf("第")))) ||
      isStartWithNumAndChars(line))
  );
};
const isContain = (line: string) => {
  return containChars.filter((item) => line.indexOf(item) > -1).length > 0;
};
const isStartWithChars = (line: string) => {
  return (
    startWithChars.filter(
      (item) =>
        line.startsWith(item) ||
        line.startsWith(Chinese.s2t(item)) ||
        line.startsWith(Chinese.t2s(item))
    ).length > 0
  );
};
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
      /^[\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341\u767e\u5343\u4e07\u842c\u96f6]+$/.test(
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

const getChapterDoc = (bookStr: string) => {
  let chapterDocList: {
    index: number;
    label: string;
    text: any;
    href: string;
  }[] = [];
  let chapterStrList: any = bookStr
    .split("<address> </address>")
    .filter((item) => item.trim() !== "");
  let titleList: string[] = chapterStrList.map((item) => {
    return getHFromStr(item) || getTitleFromStr(item);
  });

  chapterDocList = chapterStrList.map((item, index) => {
    return {
      index: index,
      label: titleList[index],
      text: item,
      href: "title" + index,
    };
  });
  return chapterDocList;
};
const txtToHtml = (text: string, parserRegex: string) => {
  let html: string = "";
  let lines = text.split("\n");
  if (lines.length === 1) {
    lines = text.split("\r");
  }
  for (let item of lines) {
    if (cleanText(item) && isTitle(cleanText(item), parserRegex)) {
      html += `<h1>${cleanText(item)}</h1>`;
    } else {
      html += `<p>${item}</p>`;
    }
  }
  if (html) {
    return html;
  } else {
    return `<h1>Title</h1><p>${text}</p>`;
  }
};
const getHFromStr = (str) => {
  const regex = /<h[1-6][^>]*>(.*?)<\/h[1-6]>/; // 匹配第一个h1标签里的内容，支持换行符和其他特殊字符
  const match = regex.exec(str);
  const content = match
    ? match[1].replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    : ""; // 处理转义字符
  return content; // 输出：This\nis\na\nheading
};
const getTitleFromStr = (str) => {
  const regex = /<title[^>]*>(.*?)<\/title>/; // 匹配第一个h1标签里的内容，支持换行符和其他特殊字符
  const match = regex.exec(str);
  const content = match
    ? match[1].replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    : ""; // 处理转义字符
  return content; // 输出：This\nis\na\nheading
};
const getTitlefromText = (bookDoc) => {
  let elements = bookDoc.getElementsByTagName("*");
  let titleElements = Array.from(elements).filter((item: any) => {
    return (
      item.childNodes.length === 1 &&
      item.childNodes[0].nodeType === Node.TEXT_NODE &&
      isTitle(cleanText(item.textContent))
    );
  });
  let h1TitleElements: any = [];
  for (let index = 0; index < titleElements.length; index++) {
    const oldElement: any = titleElements[index];
    const newElement = document.createElement("h1");
    newElement.innerHTML = oldElement.innerText;
    oldElement.parentNode.replaceChild(newElement, oldElement);
    h1TitleElements.push(newElement);
  }
  return h1TitleElements;
};
