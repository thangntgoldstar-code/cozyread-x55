import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PdfMetaDetails, PdfOutlineItem } from '../data/books';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export interface PdfMetaResult {
  totalPages: number;
  title?: string;
  author?: string;
  thumbDataUrl?: string;
  pdfMeta?: PdfMetaDetails;
  pdfChapters?: PdfOutlineItem[];
}

export interface OpenedPdfInfo {
  totalPages: number;
  pdfMeta?: PdfMetaDetails;
  pdfChapters: PdfOutlineItem[];
}

const activePdfDocs = new Map<
  string,
  { doc: pdfjsLib.PDFDocumentProxy; task: pdfjsLib.PDFDocumentLoadingTask }
>();
const renderedPageCache = new Map<string, string>();
const MAX_CACHED_PAGES = 28;

function setCachedPageUrl(key: string, dataUrl: string) {
  if (renderedPageCache.has(key)) {
    renderedPageCache.delete(key);
  }
  renderedPageCache.set(key, dataUrl);
  if (renderedPageCache.size > MAX_CACHED_PAGES) {
    const oldestKey = renderedPageCache.keys().next().value;
    if (oldestKey) renderedPageCache.delete(oldestKey);
  }
}

function cleanStr(val: unknown): string | undefined {
  if (typeof val !== 'string') return undefined;
  const trimmed = val.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

async function readPdfMetadataDetails(
  doc: pdfjsLib.PDFDocumentProxy
): Promise<{ title?: string; author?: string; pdfMeta?: PdfMetaDetails }> {
  try {
    const meta = await doc.getMetadata();
    const info = meta?.info as Record<string, unknown> | undefined;
    if (!info) return {};
    const title = cleanStr(info.Title);
    const author = cleanStr(info.Author);
    const subject = cleanStr(info.Subject);
    const keywords = cleanStr(info.Keywords);
    const creator = cleanStr(info.Creator);
    const producer = cleanStr(info.Producer);
    const rawVer = cleanStr(info.PDFFormatVersion);
    const version = rawVer
      ? rawVer.toUpperCase().startsWith('PDF')
        ? rawVer
        : `PDF-${rawVer}`
      : undefined;
    const pdfMeta: PdfMetaDetails | undefined =
      subject || keywords || creator || producer || version
        ? { subject, keywords, creator, producer, version }
        : undefined;
    return { title, author, pdfMeta };
  } catch {
    return {};
  }
}

async function readPdfOutlineChapters(
  doc: pdfjsLib.PDFDocumentProxy
): Promise<PdfOutlineItem[]> {
  try {
    const outline = await doc.getOutline();
    if (!outline || outline.length === 0) return [];
    const items: PdfOutlineItem[] = [];
    const walk = async (nodes: typeof outline) => {
      for (const node of nodes) {
        if (items.length >= 240) break;
        const title = (node.title || '').replace(/\s+/g, ' ').trim();
        let pageIdx = -1;
        try {
          let dest: unknown = node.dest;
          if (typeof dest === 'string') {
            dest = await doc.getDestination(dest);
          }
          if (Array.isArray(dest) && dest[0] !== undefined && dest[0] !== null) {
            const targetRef = dest[0];
            const idx =
              typeof targetRef === 'number'
                ? targetRef
                : await doc.getPageIndex(targetRef as never);
            if (typeof idx === 'number' && idx >= 0 && idx < doc.numPages) {
              pageIdx = idx;
            }
          }
        } catch {
          // Ignore unresolvable outline destination
        }
        if (title && pageIdx >= 0) {
          items.push({ title, pageIdx });
        }
        if (Array.isArray(node.items) && node.items.length > 0 && items.length < 240) {
          await walk(node.items);
        }
      }
    };
    await walk(outline);
    return items;
  } catch {
    return [];
  }
}

export async function extractPdfMetaAndThumb(bytes: Uint8Array): Promise<PdfMetaResult> {
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: true,
  });
  const doc = await loadingTask.promise;

  try {
    const totalPages = Math.max(1, doc.numPages);
    const [{ title, author, pdfMeta }, pdfChapters] = await Promise.all([
      readPdfMetadataDetails(doc),
      readPdfOutlineChapters(doc),
    ]);

    let thumbDataUrl: string | undefined;
    try {
      const page = await doc.getPage(1);
      const baseVp = page.getViewport({ scale: 1 });
      const targetW = 300;
      const scale = Math.max(0.25, Math.min(2, targetW / Math.max(1, baseVp.width)));
      const vp = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(vp.width));
      canvas.height = Math.max(1, Math.round(vp.height));
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport: vp, canvas }).promise;
        thumbDataUrl = canvas.toDataURL('image/jpeg', 0.82);
      }
      page.cleanup();
    } catch {
      // Fallback stylized cover if page 1 render fails
    }

    return { totalPages, title, author, thumbDataUrl, pdfMeta, pdfChapters };
  } finally {
    await doc.cleanup().catch(() => {});
    await loadingTask.destroy().catch(() => {});
  }
}

export async function openPdfDocument(
  bookId: string,
  bytes: Uint8Array
): Promise<OpenedPdfInfo> {
  const existing = activePdfDocs.get(bookId);
  if (existing) {
    const [{ pdfMeta }, pdfChapters] = await Promise.all([
      readPdfMetadataDetails(existing.doc),
      readPdfOutlineChapters(existing.doc),
    ]);
    return {
      totalPages: Math.max(1, existing.doc.numPages),
      pdfMeta,
      pdfChapters,
    };
  }

  const task = pdfjsLib.getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: true,
  });
  const doc = await task.promise;
  activePdfDocs.set(bookId, { doc, task });
  const [{ pdfMeta }, pdfChapters] = await Promise.all([
    readPdfMetadataDetails(doc),
    readPdfOutlineChapters(doc),
  ]);
  return {
    totalPages: Math.max(1, doc.numPages),
    pdfMeta,
    pdfChapters,
  };
}

export async function renderPdfPageUrl(
  bookId: string,
  pageIndex0: number,
  targetWidth = 1040
): Promise<string | undefined> {
  const cacheKey = `${bookId}:${pageIndex0}`;
  const cached = renderedPageCache.get(cacheKey);
  if (cached) return cached;

  const entry = activePdfDocs.get(bookId);
  if (!entry) return undefined;
  const { doc } = entry;

  const pageNum = Math.max(1, Math.min(doc.numPages, pageIndex0 + 1));
  const page = await doc.getPage(pageNum);
  try {
    const baseVp = page.getViewport({ scale: 1 });
    const scale = Math.max(0.5, Math.min(2.2, targetWidth / Math.max(1, baseVp.width)));
    const vp = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(vp.width));
    canvas.height = Math.max(1, Math.round(vp.height));
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport: vp, canvas }).promise;
    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    setCachedPageUrl(cacheKey, dataUrl);
    return dataUrl;
  } finally {
    page.cleanup();
  }
}

export async function closePdfDocument(bookId: string): Promise<void> {
  const entry = activePdfDocs.get(bookId);
  if (entry) {
    activePdfDocs.delete(bookId);
    await entry.doc.cleanup().catch(() => {});
    await entry.task.destroy().catch(() => {});
  }
  for (const key of Array.from(renderedPageCache.keys())) {
    if (key.startsWith(`${bookId}:`)) {
      renderedPageCache.delete(key);
    }
  }
}
