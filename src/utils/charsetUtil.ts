import chardet from "chardet";
export const getCharset = (buffer: ArrayBuffer) => {
  return chardet.detect(Buffer.from(buffer));
};
