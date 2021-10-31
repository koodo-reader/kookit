class StorageUtil {
  static getKookitConfig(key: string) {
    let kookitConfig = JSON.parse(localStorage.getItem("kookitConfig")!) || {};
    return kookitConfig[key];
  }

  static setKookitConfig(key: string, value: string) {
    let kookitConfig = JSON.parse(localStorage.getItem("kookitConfig")!) || {};
    kookitConfig[key] = value;
    localStorage.setItem("kookitConfig", JSON.stringify(kookitConfig));
  }
  static removeKookitConfig() {
    localStorage.removeItem("kookitConfig");
  }
}

export default StorageUtil;
