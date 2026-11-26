import pdfMake from 'pdfmake/build/pdfmake.js';
import fontFiles from 'pdfmake/build/vfs_fonts.js';
import { create as createFont } from 'fontkit';
import type { Font } from 'fontkit';
import type { TVirtualFile } from 'pdfmake/interfaces';
import { PDF_LAYOUT } from './layout-config';
import type { PdfFontScript } from './font-fallback';

export const PDF_FONT_FAMILY = PDF_LAYOUT.fontFamily;
// fontkit exposes the vertical metrics consumed by pdfmake at runtime, but omits them from its public type.
export type FontFaceMetrics = Font & { ascent: number; descent: number };
export type PdfFontFaces = { regular: FontFaceMetrics; bold: FontFaceMetrics; family: string };
export type PdfFontRegistry = { latin: PdfFontFaces } & Partial<Record<Exclude<PdfFontScript, 'latin'>, PdfFontFaces>>;

type FontFile = string | TVirtualFile;
type FontMetrics = { regular: FontFaceMetrics; bold: FontFaceMetrics };

const FONT_FILES = {
  kr: ['NotoSansKR-Regular.otf', 'NotoSansKR-Bold.otf'],
  jp: ['NotoSansJP-Regular.otf', 'NotoSansJP-Bold.otf'],
  sc: ['NotoSansSC-Regular.otf', 'NotoSansSC-Bold.otf'],
  tc: ['NotoSansTC-Regular.otf', 'NotoSansTC-Bold.otf'],
} as const satisfies Record<Exclude<PdfFontScript, 'latin'>, readonly [string, string]>;

const loadedFaces = new Map<Exclude<PdfFontScript, 'latin'>, Promise<PdfFontFaces>>();
let latinMetrics: FontMetrics | undefined;
let latinRegistered = false;

function decodeFont(file: FontFile): Uint8Array {
  if (typeof file !== 'string') return file.data instanceof Uint8Array ? file.data : decodeFont(file.data);
  const binary = atob(file);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function getLatinMetrics(): FontMetrics {
  if (latinMetrics) return latinMetrics;
  const regular = fontFiles['Roboto-Regular.ttf'];
  const bold = fontFiles['Roboto-Medium.ttf'];
  if (!regular || !bold) throw new Error('Required embedded Roboto faces are missing.');
  latinMetrics = { regular: createFont(decodeFont(regular)) as FontFaceMetrics, bold: createFont(decodeFont(bold)) as FontFaceMetrics };
  return latinMetrics;
}

function registerLatin(): void {
  if (latinRegistered) return;
  pdfMake.addVirtualFileSystem(fontFiles);
  pdfMake.addFonts({
    [PDF_FONT_FAMILY]: {
      normal: 'Roboto-Regular.ttf',
      bold: 'Roboto-Medium.ttf',
      italics: 'Roboto-Italic.ttf',
      bolditalics: 'Roboto-MediumItalic.ttf',
    },
  });
  latinRegistered = true;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

async function fetchFont(filename: string): Promise<Uint8Array> {
  const base = import.meta.env.BASE_URL;
  const url = new URL(base + 'fonts/pdf/' + filename, document.baseURI);
  const response = await fetch(url);
  if (!response.ok) throw new Error('A required embedded font asset could not be loaded.');
  return new Uint8Array(await response.arrayBuffer());
}

async function loadScript(script: Exclude<PdfFontScript, 'latin'>): Promise<PdfFontFaces> {
  const existing = loadedFaces.get(script);
  if (existing) return existing;
  const promise = (async () => {
    const [regularName, boldName] = FONT_FILES[script];
    const [regularBytes, boldBytes] = await Promise.all([fetchFont(regularName), fetchFont(boldName)]);
    const regular = createFont(regularBytes) as FontFaceMetrics;
    const bold = createFont(boldBytes) as FontFaceMetrics;
    const family = 'Noto' + script.toUpperCase();
    pdfMake.addVirtualFileSystem({
      [regularName]: toBase64(regularBytes),
      [boldName]: toBase64(boldBytes),
    });
    pdfMake.addFonts({ [family]: { normal: regularName, bold: boldName } });
    return { regular, bold, family };
  })();
  loadedFaces.set(script, promise);
  try {
    return await promise;
  } catch (error) {
    loadedFaces.delete(script);
    throw error;
  }
}

export async function loadPdfFonts(scripts: readonly PdfFontScript[]): Promise<PdfFontRegistry> {
  registerLatin();
  const latin = getLatinMetrics();
  const requested = [...new Set(scripts.filter((script): script is Exclude<PdfFontScript, 'latin'> => script !== 'latin'))];
  const loaded = await Promise.all(requested.map(async (script) => [script, await loadScript(script)] as const));
  return {
    latin: { ...latin, family: PDF_FONT_FAMILY },
    ...Object.fromEntries(loaded),
  } as PdfFontRegistry;
}

export function getPdfFontMetrics(): FontMetrics {
  return getLatinMetrics();
}
