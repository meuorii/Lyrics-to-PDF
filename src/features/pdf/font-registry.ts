import pdfMake from 'pdfmake/build/pdfmake.js';
import fontFiles from 'pdfmake/build/vfs_fonts.js';
import { create as createFont } from 'fontkit';
import type { TVirtualFile } from 'pdfmake/interfaces';
import { PDF_LAYOUT } from './layout-config';

export const PDF_FONT_FAMILY = PDF_LAYOUT.fontFamily;

type FontFace = ReturnType<typeof createFont>;
type FontMetrics = { regular: FontFace; bold: FontFace };

let metrics: FontMetrics | undefined;

function decodeFont(file: string | TVirtualFile): Uint8Array {
  if (typeof file !== 'string') {
    if (file.data instanceof Uint8Array) return file.data;
    return decodeFont(file.data);
  }
  const binary = atob(file);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function registerPdfFonts(): void {
  pdfMake.addVirtualFileSystem(fontFiles);
  pdfMake.addFonts({
    [PDF_FONT_FAMILY]: {
      normal: 'Roboto-Regular.ttf',
      bold: 'Roboto-Medium.ttf',
      italics: 'Roboto-Italic.ttf',
      bolditalics: 'Roboto-MediumItalic.ttf',
    },
  });
}

export function getPdfFontMetrics(): FontMetrics {
  if (metrics) return metrics;
  try {
    const regular = fontFiles['Roboto-Regular.ttf'];
    const bold = fontFiles['Roboto-Medium.ttf'];
    if (!regular || !bold) throw new Error('Required embedded Roboto faces are missing.');
    metrics = {
      regular: createFont(decodeFont(regular)),
      bold: createFont(decodeFont(bold)),
    };
    return metrics;
  } catch {
    throw new Error('The embedded PDF font could not be loaded.');
  }
}
