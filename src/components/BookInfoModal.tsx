import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Clock, FileText, RotateCcw, Star } from 'lucide-react';
import { BookItem } from '../data/books';
import {
  estimateRemainingTimeVi,
  formatFileSizeVi,
  formatReadingTimeVi,
  getBookTextStats,
  getCurrentChapterInfo,
  splitFileLocation,
} from '../utils/bookStats';
import { BookCover } from './BookCover';

interface BookInfoModalProps {
  book: BookItem;
  scrollSignal?: { dir: -1 | 1; seq: number };
  onReadBook: () => void;
  onRestartBook: () => void;
  onToggleFavorite: () => void;
  onClose: () => void;
}

export const BookInfoModal: React.FC<BookInfoModalProps> = ({
  book,
  scrollSignal,
  onReadBook,
  onRestartBook,
  onToggleFavorite,
  onClose,
}) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [scrollBar, setScrollBar] = useState<{ topPct: number; heightPct: number }>({
    topPct: 0,
    heightPct: 100,
  });

  const syncScrollBar = useCallback(() => {
    const el = scrollRef.current;
    if (!el || el.scrollHeight <= el.clientHeight + 2) {
      setScrollBar({ topPct: 0, heightPct: 100 });
      return;
    }
    const heightPct = Math.max(18, Math.round((el.clientHeight / el.scrollHeight) * 100));
    const maxTop = 100 - heightPct;
    const progress = el.scrollTop / Math.max(1, el.scrollHeight - el.clientHeight);
    setScrollBar({
      topPct: Math.max(0, Math.min(maxTop, progress * maxTop)),
      heightPct,
    });
  }, []);

  useEffect(() => {
    const raf = window.requestAnimationFrame(syncScrollBar);
    return () => window.cancelAnimationFrame(raf);
  }, [book.id, syncScrollBar]);

  useEffect(() => {
    if (!scrollSignal || scrollSignal.seq === 0) return;
    scrollRef.current?.scrollBy({
      top: scrollSignal.dir * 84,
      behavior: 'smooth',
    });
  }, [scrollSignal]);

  const pct = Math.round(((book.currentPage + 1) / Math.max(1, book.totalPages)) * 100);
  const { fileName, directory } = useMemo(() => splitFileLocation(book.filePath), [book.filePath]);
  const chapterInfo = useMemo(() => getCurrentChapterInfo(book), [book]);
  const textStats = useMemo(() => getBookTextStats(book), [book]);
  const isComicOnly = book.format === 'CBZ';
  const totalChaptersDisplay = Math.max(
    chapterInfo.totalChapters,
    book.chapterCount || 1
  );

  const infoRows: { label: string; value: string; accent?: string; mono?: boolean }[] = [
    { label: 'Tên tập tin', value: fileName, mono: true },
    { label: 'Vị trí', value: directory, mono: true },
    { label: 'Kích cỡ', value: formatFileSizeVi(book.fileSize), accent: 'text-sky-200', mono: true },
    { label: 'Định dạng', value: book.format, accent: 'text-emerald-200', mono: true },
    { label: 'Số trang', value: `${book.totalPages}`, mono: true },
    {
      label: 'Trang hiện tại',
      value: `${book.currentPage + 1} (${pct}%)`,
      accent: 'text-sky-300',
      mono: true,
    },
    { label: 'Số chương', value: `${totalChaptersDisplay}`, mono: true },
    {
      label: 'Chương hiện tại',
      value: `${chapterInfo.chapterIdx + 1}, ${chapterInfo.title}`,
    },
    {
      label: 'Đánh dấu trang',
      value: book.bookmarks.length > 0 ? `${book.bookmarks.length} trang` : 'Chưa có',
      accent: book.bookmarks.length > 0 ? 'text-rose-300' : undefined,
    },
  ];

  const readingRows: { label: string; value: string; accent?: string }[] = [
    {
      label: 'Thời gian đã đọc',
      value: formatReadingTimeVi(book.readingSeconds),
      accent: (book.readingSeconds || 0) > 0 ? 'text-amber-200' : undefined,
    },
    {
      label: 'Ước tính còn lại',
      value: estimateRemainingTimeVi(book),
      accent: 'text-emerald-200',
    },
  ];

  if (!isComicOnly && textStats.charCount > 0) {
    readingRows.push(
      {
        label: 'Ký tự trong sách',
        value: textStats.charCount.toLocaleString('vi-VN'),
      },
      {
        label: 'Từ trong sách',
        value: textStats.wordCount.toLocaleString('vi-VN'),
      }
    );
  }

  const pdfRows: { label: string; value: string }[] =
    book.format === 'PDF'
      ? [
          { label: 'Creator', value: book.pdfMeta?.creator || '—' },
          { label: 'Subject', value: book.pdfMeta?.subject || '—' },
          { label: 'Keywords', value: book.pdfMeta?.keywords || '—' },
          { label: 'Producer', value: book.pdfMeta?.producer || '—' },
          { label: 'Version', value: book.pdfMeta?.version || 'PDF-1.x' },
        ]
      : [];

  return (
    <div className="animate-backdrop-in absolute inset-0 z-50 flex items-center justify-center bg-black/72 p-3 backdrop-blur-xs">
      <div className="animate-modal-pop flex h-[402px] w-[628px] max-w-[95%] flex-col rounded-xl border border-white/15 bg-[#101520]/96 p-4 text-slate-100 shadow-2xl">
        {/* Header */}
        <div className="mb-3 flex items-start justify-between gap-3 border-b border-white/10 pb-2.5 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate font-display text-base font-semibold text-white">
                {book.title}
              </h3>
              <span className="shrink-0 rounded bg-white/10 px-1.5 py-0.5 font-mono-hud text-[9.5px] font-medium text-sky-200">
                {book.format}
              </span>
            </div>
            <p className="mt-0.5 truncate text-xs text-slate-300">
              {book.author} · {book.folderName}
            </p>
          </div>
          <span className="shrink-0 font-mono-hud text-[10px] text-slate-400">
            [▲▼] Cuộn chi tiết
          </span>
        </div>

        {/* Body: Left Cover + Right Scrollable Moon+ Reader Style Info */}
        <div className="flex min-h-0 flex-1 gap-4">
          {/* Left Cover & Progress */}
          <div className="flex w-28 shrink-0 flex-col justify-between">
            <div>
              <div className="aspect-[3/4] w-full">
                <BookCover
                  book={book}
                  showProgress={false}
                  className="h-full w-full rounded-lg shadow-xl"
                />
              </div>
              <div className="mt-2.5 rounded-lg bg-white/4 px-2 py-1.5 ring-1 ring-white/8">
                <div className="flex items-center justify-between font-mono-hud text-[10px]">
                  <span className="text-slate-400">Tiến độ</span>
                  <span className="font-semibold text-sky-300">{pct}%</span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-sky-400 to-emerald-400"
                    style={{ width: `${Math.max(4, pct)}%` }}
                  />
                </div>
                <div className="mt-1 text-center font-mono-hud text-[9.5px] text-slate-400">
                  {book.currentPage + 1}/{book.totalPages} trang
                </div>
              </div>
            </div>
          </div>

          {/* Right Detailed Info List */}
          <div className="relative min-h-0 flex-1">
            <div
              ref={scrollRef}
              onScroll={syncScrollBar}
              className="no-scrollbar h-full space-y-2.5 overflow-y-auto pr-3 text-[11px]"
            >
              {book.synopsis && (
                <p className="rounded-lg bg-white/4 px-3 py-2 text-[11px] leading-relaxed text-slate-200 ring-1 ring-white/8">
                  {book.synopsis}
                </p>
              )}

              {/* File & Position Details */}
              <div className="rounded-lg bg-white/4 px-3 py-2 ring-1 ring-white/8">
                <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-sky-300">
                  <FileText className="h-3 w-3" />
                  <span>Thông tin tập tin & Vị trí</span>
                </div>
                <div className="space-y-1">
                  {infoRows.map((row) => (
                    <div
                      key={row.label}
                      className="flex items-baseline justify-between gap-3 border-b border-white/5 pb-1 last:border-b-0 last:pb-0"
                    >
                      <span className="shrink-0 text-slate-400">{row.label}:</span>
                      <span
                        className={`min-w-0 break-all text-right ${
                          row.mono ? 'font-mono-hud text-[10.5px]' : ''
                        } ${row.accent || 'text-slate-100'}`}
                      >
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Reading Stats */}
              <div className="rounded-lg bg-white/4 px-3 py-2 ring-1 ring-white/8">
                <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
                  <Clock className="h-3 w-3" />
                  <span>Thống kê đọc sách</span>
                </div>
                <div className="space-y-1">
                  {readingRows.map((row) => (
                    <div
                      key={row.label}
                      className="flex items-baseline justify-between gap-3 border-b border-white/5 pb-1 last:border-b-0 last:pb-0"
                    >
                      <span className="shrink-0 text-slate-400">{row.label}:</span>
                      <span
                        className={`font-mono-hud text-[10.5px] text-right ${
                          row.accent || 'text-slate-100'
                        }`}
                      >
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* PDF Metadata (Matches Moon+ Reader PDF Details) */}
              {pdfRows.length > 0 && (
                <div className="rounded-lg bg-white/4 px-3 py-2 ring-1 ring-white/8">
                  <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                    Siêu dữ liệu PDF
                  </div>
                  <div className="space-y-1">
                    {pdfRows.map((row) => (
                      <div
                        key={row.label}
                        className="flex items-baseline justify-between gap-3 border-b border-white/5 pb-1 last:border-b-0 last:pb-0"
                      >
                        <span className="shrink-0 text-slate-400">{row.label}:</span>
                        <span className="min-w-0 break-all text-right font-mono-hud text-[10.5px] text-slate-200">
                          {row.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {scrollBar.heightPct < 100 && (
              <div className="pointer-events-none absolute top-1 bottom-1 right-0.5 w-[2.5px] rounded-full bg-white/8">
                <div
                  className="absolute inset-x-0 rounded-full bg-white/35 transition-[top] duration-100 ease-out"
                  style={{
                    top: `${scrollBar.topPct}%`,
                    height: `${scrollBar.heightPct}%`,
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-3 flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-2.5">
          <button
            type="button"
            onClick={onToggleFavorite}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
              book.favorite
                ? 'bg-amber-400/20 text-amber-200 ring-1 ring-amber-400/45'
                : 'bg-white/8 text-slate-300 hover:bg-white/15'
            }`}
          >
            <Star className={`h-3.5 w-3.5 ${book.favorite ? 'fill-amber-300 text-amber-300' : ''}`} />
            <span>[Y] {book.favorite ? 'Đã thích' : 'Yêu thích'}</span>
          </button>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-white/8 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/15 transition-colors"
            >
              [B] Đóng
            </button>
            {book.currentPage > 0 && (
              <button
                type="button"
                onClick={onRestartBook}
                title="Đặt lại về trang 1 và đọc lại từ đầu [R1]"
                className="flex items-center gap-1 rounded-lg bg-amber-500/18 px-2.5 py-1.5 text-xs font-medium text-amber-200 ring-1 ring-amber-400/40 hover:bg-amber-500/28 transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>[R1] Đọc từ đầu</span>
              </button>
            )}
            <button
              type="button"
              onClick={onReadBook}
              className="flex items-center gap-1.5 rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-sky-400 transition-colors"
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>[A] {book.currentPage > 0 ? 'Đọc tiếp' : 'Đọc'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
