import { BookItem } from '../data/books';

export interface BookChapterEntry {
  title: string;
  pageIdx: number;
  pageCount: number;
}

export function getBookChapters(book: BookItem): BookChapterEntry[] {
  const totalPages = Math.max(1, book.totalPages || book.pages.length || 1);

  if (book.pdfChapters && book.pdfChapters.length > 0) {
    const sorted = [...book.pdfChapters]
      .filter((c) => c.title.trim().length > 0)
      .map((c) => ({
        title: c.title.trim(),
        pageIdx: Math.max(0, Math.min(totalPages - 1, c.pageIdx)),
      }));

    if (sorted.length > 0) {
      return sorted.map((item, idx) => {
        const nextIdx = sorted[idx + 1]?.pageIdx ?? totalPages;
        return {
          title: item.title,
          pageIdx: item.pageIdx,
          pageCount: Math.max(1, nextIdx - item.pageIdx),
        };
      });
    }
  }

  if (book.pages.length === 0) {
    return [{ title: book.title, pageIdx: 0, pageCount: totalPages }];
  }

  const chapters: BookChapterEntry[] = [];
  for (let i = 0; i < book.pages.length; i++) {
    const rawName = (book.pages[i]?.chapter || '').trim() || `Trang ${i + 1}`;
    const last = chapters[chapters.length - 1];
    if (last && last.title === rawName) {
      last.pageCount += 1;
    } else {
      chapters.push({
        title: rawName,
        pageIdx: i,
        pageCount: 1,
      });
    }
  }

  return chapters;
}

export function getCurrentChapterInfo(book: BookItem): {
  chapterIdx: number;
  totalChapters: number;
  title: string;
} {
  const chapters = getBookChapters(book);
  const pageIdx = Math.max(0, book.currentPage);
  let active = 0;
  for (let i = 0; i < chapters.length; i++) {
    if (chapters[i].pageIdx <= pageIdx) {
      active = i;
    } else {
      break;
    }
  }
  return {
    chapterIdx: active,
    totalChapters: chapters.length,
    title: chapters[active]?.title || book.pages[pageIdx]?.chapter || book.title,
  };
}

export function getBookTextStats(book: BookItem): {
  charCount: number;
  wordCount: number;
} {
  if (
    typeof book.charCount === 'number' &&
    book.charCount > 0 &&
    typeof book.wordCount === 'number'
  ) {
    return {
      charCount: book.charCount,
      wordCount: book.wordCount,
    };
  }

  let charCount = 0;
  let wordCount = 0;
  for (const p of book.pages) {
    if (p.heading) {
      charCount += p.heading.length;
      wordCount += p.heading.trim().split(/\s+/).filter(Boolean).length;
    }
    if (p.paragraphs) {
      for (const para of p.paragraphs) {
        charCount += para.length;
        wordCount += para.trim().split(/\s+/).filter(Boolean).length;
      }
    }
    if (p.comicScene) {
      const parts = [
        p.comicScene.panelTitle,
        p.comicScene.caption,
        ...p.comicScene.dialogue.map((d) => `${d.speaker} ${d.text}`),
      ];
      for (const part of parts) {
        charCount += part.length;
        wordCount += part.trim().split(/\s+/).filter(Boolean).length;
      }
    }
  }
  return { charCount, wordCount };
}

export function formatFileSizeVi(bytes?: number): string {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes <= 0) {
    return '—';
  }
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2).replace('.', ',')} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2).replace('.', ',')} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2).replace('.', ',')} GB`;
}

export function formatReadingTimeVi(seconds?: number): string {
  const sec = Math.max(0, Math.round(seconds || 0));
  if (sec < 60) {
    return sec === 0 ? 'Chưa đọc' : `${sec} giây`;
  }
  const totalMinutes = Math.floor(sec / 60);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours === 0) return `${mins} phút`;
  return `${hours} giờ ${mins} phút`;
}

export function estimateRemainingTimeVi(book: BookItem): string {
  const remainingPages = Math.max(0, book.totalPages - 1 - book.currentPage);
  if (remainingPages === 0) return 'Đã đọc xong';

  const isComicLike =
    book.format === 'CBZ' ||
    book.pages.some((p) => Boolean(p.comicScene || (p.imageUrl && book.format === 'CBZ')));

  let totalMinutes = 0;
  const readingSecs = book.readingSeconds || 0;
  if (readingSecs >= 60 && book.currentPage > 0) {
    const secsPerPage = Math.max(12, Math.min(180, readingSecs / book.currentPage));
    totalMinutes = Math.max(1, Math.round((remainingPages * secsPerPage) / 60));
  } else if (isComicLike || book.format === 'PDF') {
    totalMinutes = Math.max(1, Math.round((remainingPages * 32) / 60));
  } else {
    const { wordCount } = getBookTextStats(book);
    if (wordCount > 0 && book.totalPages > 0) {
      const remainingWords = Math.round((wordCount * remainingPages) / book.totalPages);
      totalMinutes = Math.max(1, Math.round(remainingWords / 220));
    } else {
      totalMinutes = Math.max(1, remainingPages);
    }
  }

  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours === 0) return `Còn ~${mins} phút`;
  return `Còn ~${hours} giờ ${mins} phút`;
}

export function splitFileLocation(filePath: string): { fileName: string; directory: string } {
  const normalized = filePath.replace(/\\/g, '/');
  const lastSlash = normalized.lastIndexOf('/');
  if (lastSlash === -1) {
    return { fileName: normalized, directory: '/' };
  }
  return {
    fileName: normalized.slice(lastSlash + 1),
    directory: normalized.slice(0, lastSlash) || '/',
  };
}
