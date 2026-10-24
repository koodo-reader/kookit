import { isMOBI, MOBI } from "./mobi.js";
import { unzlibSync } from "fflate";

export const loadMobiBook = async (mobiBuffer: ArrayBuffer) => {
  let blob = new Blob([mobiBuffer]);
  let file = new File([blob], "book", {
    lastModified: new Date().getTime(),
    type: blob.type,
  });
  if (await isMOBI(file)) {
    return await new MOBI({ unzlib: unzlibSync }).open(file);
  }
  throw new Error("Not a valid MOBI file");
};
