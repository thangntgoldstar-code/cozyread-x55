import { AppSettings, BookItem, BookPage } from '../data/books';

export interface ThemePalette {
  bg: string;
  pageBg: string;
  text: string;
  muted: string;
  gutter: string;
}

interface CachedImageEntry {
  img: HTMLImageElement;
  status: 'loading' | 'loaded' | 'error';
}

const pageImageCache = new Map<string, CachedImageEntry>();
const MAX_IMAGE_CACHE = 40;

function getOrLoadPageImage(
  url: string,
  onReady?: () => void
): CachedImageEntry {
  const existing = pageImageCache.get(url);
  if (existing) {
    if (existing.status === 'loading' && onReady) {
      existing.img.addEventListener('load', onReady, { once: true });
    }
    return existing;
  }

  const img = new Image();
  const entry: CachedImageEntry = { img, status: 'loading' };
  pageImageCache.set(url, entry);
  if (pageImageCache.size > MAX_IMAGE_CACHE) {
    const oldest = pageImageCache.keys().next().value;
    if (oldest) pageImageCache.delete(oldest);
  }

  img.onload = () => {
    entry.status = 'loaded';
    onReady?.();
  };
  img.onerror = () => {
    entry.status = 'error';
  };
  img.src = url;
  return entry;
}

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawSinglePageRegion(
  ctx: CanvasRenderingContext2D,
  book: BookItem,
  page: BookPage,
  pageNumDisplay: number,
  x: number,
  y: number,
  w: number,
  h: number,
  settings: AppSettings,
  theme: ThemePalette,
  options: {
    compactVertical: boolean;
    isPortrait: boolean;
    showHud: boolean;
    onImageReady?: () => void;
  }
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  if (page.imageUrl) {
    const isPdf = book.format === 'PDF';
    ctx.fillStyle = isPdf ? '#f8fafc' : '#090b10';
    ctx.fillRect(x, y, w, h);

    const entry = getOrLoadPageImage(page.imageUrl, options.onImageReady);
    if (entry.status === 'loaded' && entry.img.naturalWidth > 0 && entry.img.naturalHeight > 0) {
      const pad = 4;
      const availW = Math.max(1, w - pad * 2);
      const availH = Math.max(1, h - pad * 2);
      const scale = Math.min(availW / entry.img.naturalWidth, availH / entry.img.naturalHeight);
      const dw = entry.img.naturalWidth * scale;
      const dh = entry.img.naturalHeight * scale;
      const dx = x + (w - dw) * 0.5;
      const dy = y + (h - dh) * 0.5;
      ctx.drawImage(entry.img, dx, dy, dw, dh);
    } else if (entry.status === 'error') {
      ctx.font = '500 12px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = isPdf ? '#475569' : '#94a3b8';
      ctx.textAlign = 'center';
      ctx.fillText('Không thể hiển thị trang hình ảnh này', x + w * 0.5, y + h * 0.5);
      ctx.textAlign = 'left';
    } else {
      ctx.font = '500 11px "JetBrains Mono", monospace';
      ctx.fillStyle = isPdf ? '#64748b' : '#94a3b8';
      ctx.textAlign = 'center';
      ctx.fillText(`Đang mở trang ${pageNumDisplay}...`, x + w * 0.5, y + h * 0.5);
      ctx.textAlign = 'left';
    }

    ctx.font = '400 9.5px "JetBrains Mono", monospace';
    ctx.fillStyle = isPdf ? 'rgba(15,23,42,0.55)' : 'rgba(255,255,255,0.55)';
    const numStr = `${pageNumDisplay}/${book.totalPages}`;
    const numW = ctx.measureText(numStr).width;
    ctx.fillText(numStr, x + w - 10 - numW, y + h - 8);
    ctx.restore();
    return;
  }

  if (page.comicScene) {
    const { panelTitle, caption, dialogue, palette, mood, sceneVariant } = page.comicScene;

    const bgGrad = ctx.createLinearGradient(x, y, x + w * 0.4, y + h);
    bgGrad.addColorStop(0, palette[0]);
    bgGrad.addColorStop(1, '#05070c');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(x, y, w, h);

    const pad = 10;
    const fx = x + pad;
    const fy = y + pad;
    const fw = w - pad * 2;
    const fh = h - pad * 2 - 20;

    ctx.save();
    drawRoundedRectPath(ctx, fx, fy, fw, fh, 4);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fill();
    ctx.clip();

    // Scale virtual 400x260 scene with "meet" aspect ratio
    const scale = Math.min(fw / 400, fh / 260);
    const drawW = 400 * scale;
    const drawH = 260 * scale;
    const ox = fx + (fw - drawW) * 0.5;
    const oy = fy + (fh - drawH) * 0.5;

    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(scale, scale);

    const skyGrad = ctx.createLinearGradient(0, 0, 0, 260);
    skyGrad.addColorStop(0, palette[0]);
    skyGrad.addColorStop(1, palette[1]);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, 400, 260);

    if (mood === 'rain') {
      ctx.fillStyle = '#09101d';
      ctx.fillRect(25 + sceneVariant * 8, 75, 55, 190);
      ctx.fillStyle = '#0d172a';
      ctx.fillRect(98 - sceneVariant * 4, 42, 75, 220);
      ctx.fillStyle = '#070d18';
      ctx.fillRect(195, 65 + sceneVariant * 5, 65, 195);
      ctx.fillStyle = '#0b1324';
      ctx.fillRect(275, 50, 92, 210);
      ctx.fillStyle = palette[2];
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      ctx.arc(315 - sceneVariant * 22, 58 + sceneVariant * 4, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = palette[1];
      ctx.lineWidth = 1.2;
      for (let idx = 0; idx < 24; idx++) {
        const rx = (idx * 37 + sceneVariant * 13) % 400;
        const ry = (idx * 19) % 120;
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - 18, ry + 70);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else if (mood === 'forest') {
      ctx.fillStyle = palette[2];
      ctx.globalAlpha = 0.58;
      ctx.beginPath();
      ctx.arc(190 + sceneVariant * 12, 72, 44, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      const drawTri = (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, c: string) => {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x3, y3);
        ctx.closePath();
        ctx.fill();
      };
      drawTri(0, 260, 90, 110, 180, 260, '#0b2419');
      drawTri(120, 260, 230, 90, 340, 260, '#113626');
      drawTri(240, 260, 330, 130, 400, 260, '#0a1f15');
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = palette[1];
      ctx.beginPath();
      ctx.moveTo(160, 260);
      ctx.quadraticCurveTo(200, 190, 240, 260);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = palette[2];
      ctx.globalAlpha = 0.78;
      ctx.beginPath();
      ctx.arc(290 - sceneVariant * 24, 78 + sceneVariant * 6, 32, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.34;
      ctx.fillStyle = palette[1];
      ctx.beginPath();
      ctx.moveTo(0, 200);
      ctx.quadraticCurveTo(120, 140, 240, 190);
      ctx.quadraticCurveTo(320, 225, 400, 175);
      ctx.lineTo(400, 260);
      ctx.lineTo(0, 260);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = '#080c14';
      ctx.beginPath();
      ctx.moveTo(0, 220);
      ctx.quadraticCurveTo(160, 175, 400, 215);
      ctx.lineTo(400, 260);
      ctx.lineTo(0, 260);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.restore();

    // Panel title badge
    ctx.font = '600 8.5px "JetBrains Mono", monospace';
    const badgeW = Math.min(fw - 16, ctx.measureText(panelTitle).width + 14);
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(fx + 6, fy + 6, badgeW, 16);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(fx + 6, fy + 6, badgeW, 16);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(panelTitle, fx + 13, fy + 17);

    // Dialogue bubbles near bottom
    let bubbleY = fy + fh - 10;
    for (let i = dialogue.length - 1; i >= 0; i--) {
      const line = dialogue[i];
      const prefix = `${line.speaker}: `;
      const full = `${prefix}${line.text}`;
      const maxBW = fw * 0.9;
      ctx.font = '400 10px "Plus Jakarta Sans", sans-serif';
      const lines = wrapTextLines(ctx, full, maxBW - 18).slice(0, 3);
      const bh = lines.length * 13 + 8;
      const bw = Math.min(
        maxBW,
        Math.max(...lines.map((l) => ctx.measureText(l).width)) + 18
      );
      bubbleY -= bh;
      const bx = i % 2 === 1 ? fx + fw - 10 - bw : fx + 10;
      drawRoundedRectPath(ctx, bx, bubbleY, bw, bh, 9);
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1;
      ctx.stroke();

      lines.forEach((l, li) => {
        const textY = bubbleY + 13 + li * 13;
        if (li === 0 && l.startsWith(prefix)) {
          ctx.font = '700 10px "Plus Jakarta Sans", sans-serif';
          ctx.fillStyle = '#334155';
          ctx.fillText(prefix, bx + 9, textY);
          const pw = ctx.measureText(prefix).width;
          ctx.font = '400 10px "Plus Jakarta Sans", sans-serif';
          ctx.fillStyle = '#0f172a';
          ctx.fillText(l.slice(prefix.length), bx + 9 + pw, textY);
        } else {
          ctx.font = '400 10px "Plus Jakarta Sans", sans-serif';
          ctx.fillStyle = '#0f172a';
          ctx.fillText(l, bx + 9, textY);
        }
      });
      bubbleY -= 4;
    }

    ctx.restore();

    // Comic frame border
    drawRoundedRectPath(ctx, fx, fy, fw, fh, 4);
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Caption footer
    ctx.font = 'italic 9.5px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText(caption, x + pad, y + h - 8, w - pad * 2 - 42);
    ctx.font = '400 9.5px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    const numStr = `${pageNumDisplay}/${book.totalPages}`;
    const numW = ctx.measureText(numStr).width;
    ctx.fillText(numStr, x + w - pad - numW, y + h - 8);

    ctx.restore();
    return;
  }

  // Prose page
  ctx.fillStyle = theme.pageBg;
  ctx.fillRect(x, y, w, h);

  const px = options.compactVertical ? 20 : 24;
  const py = options.compactVertical ? 12 : 16;
  const contentW = Math.max(40, w - px * 2);

  // Header
  ctx.font = '400 10px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = theme.muted;
  ctx.fillText(page.chapter, x + px, y + py + 9, contentW - 44);
  ctx.font = '400 10px "JetBrains Mono", monospace';
  const fmtW = ctx.measureText(book.format).width;
  ctx.fillText(book.format, x + w - px - fmtW, y + py + 9);

  let curY = y + py + 26;
  if (page.heading) {
    ctx.font = `600 ${options.compactVertical ? 14 : 16}px "Fraunces", Georgia, serif`;
    ctx.fillStyle = theme.text;
    const hLines = wrapTextLines(ctx, page.heading, contentW);
    for (const hl of hLines) {
      ctx.fillText(hl, x + px, curY + 13);
      curY += options.compactVertical ? 19 : 22;
    }
    curY += options.compactVertical ? 4 : 8;
  }

  const effectiveFontSize =
    settings.fontSize *
    (options.compactVertical
      ? 0.82
      : settings.twoPageSpread && !options.isPortrait
        ? 0.86
        : 0.96) *
    (options.showHud ? 0.92 : 1);
  const lineH =
    effectiveFontSize *
    (options.compactVertical ? Math.min(1.48, settings.lineHeight) : settings.lineHeight);
  const fontFamily =
    settings.fontFamily === 'serif'
      ? '"Literata", Georgia, serif'
      : '"Plus Jakarta Sans", system-ui, sans-serif';

  ctx.fillStyle = theme.text;
  const maxTextY = y + h - 30;
  const paragraphs = page.paragraphs ?? [];

  for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
    const para = paragraphs[pIdx];
    const hasDropCap = pIdx === 0 && Boolean(page.heading) && !options.compactVertical && para.length > 1;

    if (hasDropCap) {
      const firstChar = para.slice(0, 1);
      const restText = para.slice(1);
      const capSize = Math.round(effectiveFontSize * 1.65);
      ctx.font = `700 ${capSize}px "Fraunces", Georgia, serif`;
      const capW = ctx.measureText(firstChar).width + 4;
      ctx.fillText(firstChar, x + px, curY + effectiveFontSize + 2);

      ctx.font = `400 ${effectiveFontSize}px ${fontFamily}`;
      const firstLineWords = wrapTextLines(ctx, restText, Math.max(40, contentW - capW));
      if (firstLineWords.length > 0 && curY + lineH <= maxTextY) {
        ctx.fillText(firstLineWords[0], x + px + capW, curY + effectiveFontSize);
        curY += lineH;
        const remainingText = firstLineWords.slice(1).join(' ');
        if (remainingText) {
          const restLines = wrapTextLines(ctx, remainingText, contentW);
          for (let li = 0; li < restLines.length; li++) {
            if (curY + lineH > maxTextY) break;
            const line = restLines[li];
            const isLast = li === restLines.length - 1;
            const words = line.split(' ');
            if (!isLast && words.length > 3) {
              const totalWordsW = words.reduce((acc, wd) => acc + ctx.measureText(wd).width, 0);
              const spaceW = Math.min(effectiveFontSize * 0.85, (contentW - totalWordsW) / (words.length - 1));
              let wx = x + px;
              for (const wd of words) {
                ctx.fillText(wd, wx, curY + effectiveFontSize);
                wx += ctx.measureText(wd).width + spaceW;
              }
            } else {
              ctx.fillText(line, x + px, curY + effectiveFontSize);
            }
            curY += lineH;
          }
        }
      }
    } else {
      ctx.font = `400 ${effectiveFontSize}px ${fontFamily}`;
      const lines = wrapTextLines(ctx, para, contentW);
      for (let li = 0; li < lines.length; li++) {
        if (curY + lineH > maxTextY) break;
        const line = lines[li];
        const isLast = li === lines.length - 1;
        const words = line.split(' ');
        if (!isLast && words.length > 3) {
          const totalWordsW = words.reduce((acc, wd) => acc + ctx.measureText(wd).width, 0);
          const spaceW = Math.min(effectiveFontSize * 0.85, (contentW - totalWordsW) / (words.length - 1));
          let wx = x + px;
          for (const wd of words) {
            ctx.fillText(wd, wx, curY + effectiveFontSize);
            wx += ctx.measureText(wd).width + spaceW;
          }
        } else {
          ctx.fillText(line, x + px, curY + effectiveFontSize);
        }
        curY += lineH;
      }
    }
    curY += options.compactVertical ? 5 : 10;
    if (curY > maxTextY) break;
  }

  // Footer
  const footerLineY = y + h - 24;
  ctx.strokeStyle = theme.gutter;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + px, footerLineY);
  ctx.lineTo(x + w - px, footerLineY);
  ctx.stroke();

  ctx.font = '400 10px "JetBrains Mono", monospace';
  ctx.fillStyle = theme.muted;
  ctx.fillText(book.title, x + px, y + h - 10, contentW - 45);
  const numStr = `${pageNumDisplay}/${book.totalPages}`;
  const numW = ctx.measureText(numStr).width;
  ctx.fillText(numStr, x + w - px - numW, y + h - 10);

  ctx.restore();
}

export function renderSpreadSnapshot(
  book: BookItem,
  baseIdx: number,
  w: number,
  h: number,
  dpr: number,
  settings: AppSettings,
  theme: ThemePalette,
  options: { isPortrait: boolean; showHud: boolean; isComic: boolean; onImageReady?: () => void }
): HTMLCanvasElement {
  const off = document.createElement('canvas');
  off.width = Math.max(1, Math.round(w * dpr));
  off.height = Math.max(1, Math.round(h * dpr));
  const ctx = off.getContext('2d');
  if (!ctx) return off;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = options.isComic ? '#090b10' : theme.pageBg;
  ctx.fillRect(0, 0, w, h);

  const safeIdx = Math.min(baseIdx, Math.max(0, book.pages.length - 1));
  const fallbackPage: BookPage = {
    chapter: book.title,
    paragraphs: ['Đang mở nội dung sách...'],
  };
  const p1 = book.pages[safeIdx] || book.pages[0] || fallbackPage;
  const p2 = book.pages[safeIdx + 1];

  if (settings.twoPageSpread && p2) {
    if (options.isPortrait) {
      const halfH = h * 0.5;
      drawSinglePageRegion(ctx, book, p1, safeIdx + 1, 0, 0, w, halfH, settings, theme, {
        ...options,
        compactVertical: true,
      });
      ctx.strokeStyle = theme.gutter;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, halfH);
      ctx.lineTo(w, halfH);
      ctx.stroke();
      drawSinglePageRegion(ctx, book, p2, safeIdx + 2, 0, halfH, w, halfH, settings, theme, {
        ...options,
        compactVertical: true,
      });
    } else {
      const halfW = w * 0.5;
      drawSinglePageRegion(ctx, book, p1, safeIdx + 1, 0, 0, halfW, h, settings, theme, {
        ...options,
        compactVertical: false,
      });
      drawSinglePageRegion(ctx, book, p2, safeIdx + 2, halfW, 0, halfW, h, settings, theme, {
        ...options,
        compactVertical: false,
      });

      // Center spine gutter shadow
      const gutterGrad = ctx.createLinearGradient(halfW, 0, halfW + 20, 0);
      gutterGrad.addColorStop(0, theme.gutter);
      gutterGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gutterGrad;
      ctx.fillRect(halfW, 0, 20, h);

      ctx.strokeStyle = theme.gutter;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(halfW, 0);
      ctx.lineTo(halfW, h);
      ctx.stroke();
    }
  } else {
    const singleW = Math.min(780, w);
    const singleX = (w - singleW) * 0.5;
    drawSinglePageRegion(ctx, book, p1, safeIdx + 1, singleX, 0, singleW, h, settings, theme, {
      ...options,
      compactVertical: false,
    });
  }

  return off;
}
