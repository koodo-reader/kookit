declare module "dompurify" {
  interface DOMPurifyI {
    sanitize(source: string | Node): string;
    sanitize(
      source: string | Node,
      config: {
        RETURN_DOM_FRAGMENT?: boolean;
        RETURN_DOM?: boolean;
        ALLOW_UNKNOWN_PROTOCOLS?: boolean;
        USE_PROFILES?: { html?: boolean };
        ADD_ATTR?: string[];
        ALLOWED_ATTR?: string[];
        ALLOWED_TAGS?: string[];
      }
    ): string | HTMLElement | DocumentFragment;
  }

  const DOMPurify: DOMPurifyI;
  export default DOMPurify;
}

declare module "pptx-browser" {
  export class PptxRenderer {
    slideCount: number;
    slideSize: { cx: number; cy: number };
    load(
      source: ArrayBuffer | Blob | File | Uint8Array,
      onProgress?: (progress: number, message: string) => void
    ): Promise<void>;
    renderSlide(
      slideIndex: number,
      canvas: HTMLCanvasElement,
      width?: number
    ): Promise<void>;
    loadEmbeddedFonts(): Promise<void>;
    destroy(): void;
  }
}
