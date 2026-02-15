/**
 * OCR 资源缓存工具
 * 用于缓存 OCR 引擎所需的各种资源文件到 IndexedDB
 */

const DB_NAME = "OCRResourceCache";
const DB_VERSION = 1;
const STORE_NAME = "resources";

interface CacheEntry {
  url: string;
  data: ArrayBuffer | string;
  timestamp: number;
  type: "arraybuffer" | "text" | "blob";
}

class OCRCacheUtil {
  private db: IDBDatabase | null = null;

  /**
   * 判断 URL 是否为远程资源（http/https）
   */
  private isRemoteUrl(url: string): boolean {
    return url.startsWith("http://") || url.startsWith("https://");
  }

  /**
   * 初始化 IndexedDB
   */
  async init(): Promise<void> {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "url" });
          store.createIndex("timestamp", "timestamp", { unique: false });
        }
      };
    });
  }

  /**
   * 从缓存获取资源
   */
  async get(url: string): Promise<CacheEntry | null> {
    await this.init();
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(url);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  }

  /**
   * 保存资源到缓存
   */
  async set(
    url: string,
    data: ArrayBuffer | string,
    type: "arraybuffer" | "text" | "blob"
  ): Promise<void> {
    await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const entry: CacheEntry = {
        url,
        data,
        timestamp: Date.now(),
        type,
      };
      const request = store.put(entry);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * 删除指定缓存
   */
  async delete(url: string): Promise<void> {
    await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(url);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * 清空所有缓存
   */
  async clear(): Promise<void> {
    await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * 获取所有缓存的 URL
   */
  async getAllKeys(): Promise<string[]> {
    await this.init();
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAllKeys();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result as string[]);
    });
  }

  /**
   * 带缓存的资源获取（文本）
   */
  async fetchText(url: string): Promise<string> {
    try {
      // 只缓存远程资源
      if (!this.isRemoteUrl(url)) {
        const response = await fetch(url);
        return await response.text();
      }

      const cached = await this.get(url);
      if (cached && cached.type === "text") {
        console.log(`从缓存加载: ${url}`);
        return cached.data as string;
      }

      console.log(`从网络下载: ${url}`);
      const response = await fetch(url);
      const text = await response.text();

      // 异步保存到缓存，不阻塞返回
      this.set(url, text, "text").catch((err) =>
        console.warn(`缓存保存失败 (${url}):`, err)
      );

      return text;
    } catch (error) {
      console.error(`获取资源失败 (${url}):`, error);
      throw error;
    }
  }

  /**
   * 带缓存的资源获取（ArrayBuffer）
   */
  async fetchArrayBuffer(url: string): Promise<ArrayBuffer> {
    try {
      // 只缓存远程资源
      if (!this.isRemoteUrl(url)) {
        const response = await fetch(url);
        return await response.arrayBuffer();
      }

      const cached = await this.get(url);
      if (cached && cached.type === "arraybuffer") {
        console.log(`从缓存加载: ${url}`);
        return cached.data as ArrayBuffer;
      }

      console.log(`从网络下载: ${url}`);
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();

      // 异步保存到缓存，不阻塞返回
      this.set(url, arrayBuffer, "arraybuffer").catch((err) =>
        console.warn(`缓存保存失败 (${url}):`, err)
      );

      return arrayBuffer;
    } catch (error) {
      console.error(`获取资源失败 (${url}):`, error);
      throw error;
    }
  }

  /**
   * 带缓存的资源获取（Blob URL）
   * 用于需要 Blob URL 的场景（如 Worker）
   */
  async fetchBlobURL(url: string, mimeType?: string): Promise<string> {
    try {
      // 只缓存远程资源
      if (!this.isRemoteUrl(url)) {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const blob = new Blob([arrayBuffer], {
          type: mimeType || "application/javascript",
        });
        return URL.createObjectURL(blob);
      }

      const cached = await this.get(url);
      if (cached && cached.type === "blob") {
        console.log(`从缓存加载 Blob: ${url}`);
        // 从缓存的 ArrayBuffer 创建 Blob URL
        const blob = new Blob([cached.data as ArrayBuffer], {
          type: mimeType || "application/javascript",
        });
        return URL.createObjectURL(blob);
      }

      console.log(`从网络下载 Blob: ${url}`);
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();

      // 异步保存到缓存，不阻塞返回
      this.set(url, arrayBuffer, "blob").catch((err) =>
        console.warn(`缓存保存失败 (${url}):`, err)
      );

      const blob = new Blob([arrayBuffer], {
        type: mimeType || "application/javascript",
      });
      return URL.createObjectURL(blob);
    } catch (error) {
      console.error(`获取 Blob 资源失败 (${url}):`, error);
      throw error;
    }
  }

  /**
   * 获取缓存统计信息
   */
  async getCacheStats(): Promise<{
    count: number;
    totalSize: number;
    keys: string[];
  }> {
    await this.init();
    if (!this.db) return { count: 0, totalSize: 0, keys: [] };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const entries = request.result as CacheEntry[];
        const totalSize = entries.reduce((sum, entry) => {
          const size =
            typeof entry.data === "string"
              ? entry.data.length
              : entry.data.byteLength;
          return sum + size;
        }, 0);

        resolve({
          count: entries.length,
          totalSize,
          keys: entries.map((e) => e.url),
        });
      };
    });
  }

  /**
   * 创建一个自定义的 fetch 拦截器，用于自动缓存所有请求
   * 返回一个代理 fetch 函数
   */
  createCachedFetch(): typeof fetch {
    const originalFetch = fetch.bind(window);
    const cacheInstance = this;

    return async function cachedFetch(
      input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<Response> {
      const url = typeof input === "string" ? input : input.toString();

      // 只缓存远程 HTTP/HTTPS 资源
      const isRemote = url.startsWith("http://") || url.startsWith("https://");
      if (!isRemote) {
        return originalFetch(input, init);
      }

      // 只缓存 GET 请求
      if (init?.method && init.method !== "GET") {
        return originalFetch(input, init);
      }

      try {
        // 检查缓存
        const cached = await cacheInstance.get(url);
        if (cached) {
          console.log(`从缓存加载资源: ${url}`);

          // 根据类型创建 Response
          let body: BodyInit;
          let headers: HeadersInit = {};

          if (cached.type === "text") {
            body = cached.data as string;
            headers = { "Content-Type": "text/plain" };
          } else {
            body = cached.data as ArrayBuffer;
            headers = { "Content-Type": "application/octet-stream" };
          }

          return new Response(body, {
            status: 200,
            statusText: "OK (from cache)",
            headers: new Headers(headers),
          });
        }

        // 缓存未命中，从网络获取
        console.log(`从网络加载资源: ${url}`);
        const response = await originalFetch(input, init);

        // 克隆响应以便同时使用和缓存
        const clonedResponse = response.clone();

        // 异步缓存响应内容（根据 Content-Type 判断类型）
        (async () => {
          try {
            const contentType =
              clonedResponse.headers.get("Content-Type") || "";

            if (
              contentType.includes("text") ||
              contentType.includes("json") ||
              contentType.includes("javascript") ||
              url.endsWith(".txt") ||
              url.endsWith(".js")
            ) {
              const text = await clonedResponse.text();
              await cacheInstance.set(url, text, "text");
            } else {
              const arrayBuffer = await clonedResponse.arrayBuffer();
              await cacheInstance.set(url, arrayBuffer, "arraybuffer");
            }
            console.log(`缓存保存成功: ${url}`);
          } catch (err) {
            console.warn(`缓存保存失败 (${url}):`, err);
          }
        })();

        return response;
      } catch (error) {
        // 如果缓存逻辑失败，降级到原始 fetch
        console.warn(`缓存逻辑失败，使用原始 fetch (${url}):`, error);
        return originalFetch(input, init);
      }
    };
  }

  /**
   * 安装全局 fetch 拦截器（谨慎使用）
   */
  installGlobalFetchInterceptor(): void {
    if (typeof window !== "undefined") {
      (window as any).fetch = this.createCachedFetch();
      console.log("OCR 缓存拦截器已安装");
    }
  }

  /**
   * 恢复原始 fetch
   */
  restoreOriginalFetch(): void {
    // 注意：这只是一个简单的恢复方法
    // 实际使用中可能需要保存原始 fetch 引用
    console.warn("fetch 恢复功能需要在安装时保存原始引用");
  }
}

// 导出单例
export const ocrCache = new OCRCacheUtil();
