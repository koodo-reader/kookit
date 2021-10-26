class StorageUtil {
  static getReaderConfig(key: string) {
    let readerConfig = JSON.parse(localStorage.getItem("kookitConfig")!) || {};
    return readerConfig[key];
  }
  static setReaderConfig(key: string, value: string) {
    let readerConfig = JSON.parse(localStorage.getItem("kookitConfig")!) || {};
    readerConfig[key] = value;
    localStorage.setItem("kookitConfig", JSON.stringify(readerConfig));
  }
}

export default StorageUtil;
