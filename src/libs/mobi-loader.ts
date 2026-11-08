import { isMOBI, MOBI } from "./mobi.js";
import { unzlibSync } from "fflate";

export const loadMobiBook = async (
  mobiBuffer: ArrayBuffer
): Promise<any> => {
  const blob = new Blob([mobiBuffer]);
  const file = new File([blob], "book", {
    lastModified: new Date().getTime(),
    type: blob.type,
  });
  if (await isMOBI(file)) {
    return await new MOBI({ unzlib: unzlibSync }).open(file);
  }
  throw new Error("Not a valid MOBI file");
};
