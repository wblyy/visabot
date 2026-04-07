import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import fontkit from '@pdf-lib/fontkit';
import type { PDFDocument, PDFFont } from 'pdf-lib';

const FONT_DIR = join(import.meta.dirname, '..', 'data', 'fonts');

let cachedFontBytes: Uint8Array | null = null;

async function loadFontBytes(): Promise<Uint8Array> {
  if (!cachedFontBytes) {
    cachedFontBytes = await readFile(join(FONT_DIR, 'NotoSansSC-Regular.ttf'));
  }
  return cachedFontBytes;
}

export interface EmbeddedFonts {
  cjk: PDFFont;   // NotoSansSC - handles Chinese, Japanese, English
  latin: PDFFont;  // Same font for consistency (NotoSansSC covers Latin too)
}

/**
 * Embed CJK-capable font into a PDFDocument.
 * NotoSansSC covers Latin + CJK Unified Ideographs + Kana.
 */
export async function embedFonts(pdf: PDFDocument): Promise<EmbeddedFonts> {
  pdf.registerFontkit(fontkit);
  const fontBytes = await loadFontBytes();
  const cjk = await pdf.embedFont(fontBytes, { subset: false });
  return { cjk, latin: cjk };
}
