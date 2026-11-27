import React, { useEffect, useRef } from 'react';
import { Delete, Search, CornerDownLeft } from 'lucide-react';
import { BookItem } from '../data/books';
import { BookCover } from './BookCover';

export const KEYBOARD_ROWS: string[][] = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', '⌫'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M', 'SPACE', 'CLEAR', 'OK'],
];

interface SearchModalProps {
  query: string;
  results: BookItem[];
  selectedResultIndex: number;
  keyRow: number;
  keyCol: number;
  activeFolderLabel: string;
  onPressKey: (key: string) => void;
  onSelectResult: (book: BookItem) => void;
  onClose: () => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  query,
  results,
  selectedResultIndex,
  keyRow,
  keyCol,
  activeFolderLabel,
  onPressKey,
  onSelectResult,
  onClose,
}) => {
  const selectedCardRef = useRef<HTMLButtonElement | null>(null);
  const safeIdx = results.length > 0 ? Math.min(selectedResultIndex, results.length - 1) : 0;

  useEffect(() => {
    selectedCardRef.current?.scrollIntoView({
      behavior: 'smooth',
      inline: 'nearest',
      block: 'nearest',
    });
  }, [safeIdx, results.length]);

  return (
    <div className="animate-backdrop-in absolute inset-0 z-50 flex items-center justify-center bg-black/72 p-4 backdrop-blur-xs">
      <div className="animate-modal-pop flex h-[396px] w-[660px] flex-col justify-between rounded-xl border border-white/15 bg-[#0e131d]/96 p-3.5 text-slate-100 shadow-2xl">
        {/* Top Search Bar */}
        <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-2.5">
          <div className="flex flex-1 items-center gap-2.5 rounded-lg bg-black/45 px-3 py-1.5 ring-1 ring-sky-400/35">
            <Search className="h-4 w-4 text-sky-300 shrink-0" />
            <div className="flex-1 font-mono-hud text-sm text-white">
              {query ? (
                <span>{query}</span>
              ) : (
                <span className="text-slate-500">
                  Nhập chữ cái đầu (VD: DMPLK, SNCL) hoặc tên sách...
                </span>
              )}
              <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-sky-400 align-middle" />
            </div>
            <span className="font-mono-hud text-[10px] text-sky-300 shrink-0">
              {activeFolderLabel} · {results.length > 0 ? `${safeIdx + 1}/${results.length}` : '0'} cuốn
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-white/10 px-2.5 py-1.5 font-mono-hud text-[10px] text-slate-300 hover:bg-white/20 shrink-0"
          >
            [B] Đóng
          </button>
        </div>

        {/* Live Search Matches Strip */}
        <div className="my-2 flex h-[92px] items-center gap-2.5 overflow-x-auto no-scrollbar rounded-lg bg-white/4 p-2 ring-1 ring-white/8">
          {results.length === 0 ? (
            <div className="mx-auto text-xs text-slate-400">
              Không tìm thấy sách phù hợp với "{query}"
            </div>
          ) : (
            results.map((book, idx) => {
              const isSelected = idx === safeIdx;
              return (
                <button
                  key={book.id}
                  ref={isSelected ? selectedCardRef : null}
                  type="button"
                  onClick={() => onSelectResult(book)}
                  className={`flex h-full w-[205px] shrink-0 items-center gap-2.5 rounded-lg p-1.5 text-left transition-all duration-150 ${
                    isSelected
                      ? 'bg-sky-500/20 ring-1 ring-sky-400/70 shadow-[0_0_12px_rgba(56,189,248,0.2)]'
                      : 'bg-black/35 hover:bg-white/10 ring-1 ring-white/10'
                  }`}
                >
                  <div className="h-full aspect-[3/4] shrink-0">
                    <BookCover book={book} showProgress={false} className="h-full w-full rounded" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[11px] font-semibold text-white">{book.title}</div>
                    <div className="truncate text-[9.5px] text-slate-400">{book.author}</div>
                    <div className="mt-1 font-mono-hud text-[9px] text-sky-300">
                      {isSelected ? '[Start] / Mở để đọc' : book.format}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Virtual On-Screen Keyboard */}
        <div className="space-y-1.5">
          {KEYBOARD_ROWS.map((row, rIdx) => (
            <div key={rIdx} className="grid grid-cols-10 gap-1.5">
              {row.map((keyLabel, cIdx) => {
                const isFocused = rIdx === keyRow && cIdx === keyCol;
                const display =
                  keyLabel === 'SPACE'
                    ? 'Cách'
                    : keyLabel === 'CLEAR'
                      ? 'Xóa hết'
                      : keyLabel === 'OK'
                        ? 'Mở'
                        : keyLabel;

                return (
                  <button
                    key={keyLabel}
                    type="button"
                    onClick={() => onPressKey(keyLabel)}
                    className={`flex h-8 items-center justify-center rounded-md font-mono-hud text-xs font-semibold transition-all ${
                      isFocused
                        ? 'bg-sky-400 text-slate-950 scale-[1.05] shadow-[0_0_14px_rgba(56,189,248,0.55)]'
                        : keyLabel === 'OK'
                          ? 'bg-emerald-500/25 text-emerald-200 ring-1 ring-emerald-400/40 hover:bg-emerald-500/35'
                          : keyLabel === 'CLEAR' || keyLabel === '⌫'
                            ? 'bg-rose-500/18 text-rose-200 ring-1 ring-rose-400/30 hover:bg-rose-500/28'
                            : 'bg-white/8 text-slate-200 ring-1 ring-white/10 hover:bg-white/15'
                    }`}
                  >
                    {keyLabel === '⌫' ? (
                      <Delete className="h-3.5 w-3.5" />
                    ) : keyLabel === 'OK' ? (
                      <span className="flex items-center gap-1 text-[10px]">
                        <CornerDownLeft className="h-3 w-3" />
                        {display}
                      </span>
                    ) : (
                      <span className={keyLabel.length > 1 ? 'text-[10px]' : ''}>{display}</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400 font-mono-hud">
          <span>[D-Pad] Phím · [A] Nhập · [X] Xóa · [Y] Xóa hết</span>
          <span>[L1/R1] Chọn sách · [Start]/Mở: Đọc · [B] Đóng</span>
        </div>
      </div>
    </div>
  );
};
