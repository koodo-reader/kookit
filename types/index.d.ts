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
