declare module 'fontkit' {
  export interface Font {
    familyName: string;
    unitsPerEm: number;
    hasGlyphForCodePoint(codePoint: number): boolean;
    layout(text: string): { advanceWidth: number; bbox: { minX: number; minY: number; maxX: number; maxY: number } };
  }

  export function create(fontData: Uint8Array): Font;
}
