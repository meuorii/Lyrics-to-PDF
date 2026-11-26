declare module 'fontkit' {
  export interface Font {
    familyName: string;
    unitsPerEm: number;
    hasGlyphForCodePoint(codePoint: number): boolean;
    layout(text: string): { advanceWidth: number };
  }

  export function create(fontData: Uint8Array): Font;
}
