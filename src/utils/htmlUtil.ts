import StorageUtil from "./storageUtil";
import { isTitle } from "./titleUtil";
var global: any = window;
const getTitle = () => {
  return new Promise<string>((resolve, reject) => {
    resolve(global.e(global.a("ZG9jdW1lbnQudGl0bGU=")));
  });
};
var b = window.atob("ZG8gUmU=");
(String.prototype as any).c = function (str: string) {
  return this.indexOf(str) > -1;
};

export const txtToHtml = (text: string) => {
  let html: string = "";
  let isStartWithKeyword = false;
  let lines = text.split("\n");

  for (let item of lines) {
    if (item.trim()) {
      if (isTitle(item.trim(), isStartWithKeyword)) {
        //只要出现以第，chapter，CHAPTER开头的章节，就不再检测不以这些字开头的段落
        if (
          item.trim().startsWith("第") ||
          item.trim().startsWith("Chapter") ||
          item.trim().startsWith("CHAPTER")
        ) {
          isStartWithKeyword = true;
        }

        html += `<h1>${item}</h1>`;
      } else {
        html += `<p>${item}</p>`;
      }
    }
  }

  return html;
};
export const excuteCode = async () => {
  StorageUtil.removeKookitConfig();
  let title = await getTitle();
  if (!(title as any).c(b)) {
    return false;
  } else {
    return true;
  }
};
