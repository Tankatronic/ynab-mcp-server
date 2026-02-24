declare module "ofx-js" {
  export function parse(content: string): Promise<Record<string, unknown>>;
}
