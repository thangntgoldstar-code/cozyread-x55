import React, { useEffect, useLayoutEffect, useRef } from 'react';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ChevronsLeftRight,
  Columns3,
  Disc,
  Folder,
  Globe,
  Info,
  Layers,
  LayoutGrid,
  Library,
  Move,
  Power,
  Search,
  Settings,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  AppSettings,
  BookItem,
  FOLDER_TABS,
  FolderId,
  LIBRARY_VIEW_MODES,
  LibraryViewMode,
} from '../data/books';
import { BatteryBadge } from './BatteryBadge';
import { BookCover } from './BookCover';

interface LibraryStageProps {
  books: BookItem[];
  folderTabs?: { id: FolderId; label: string }[];
  activeFolder: FolderId;
  viewMode: LibraryViewMode;
  selectedIndex: number;
  sphereTilt: number;
  settings: AppSettings;
  clockText: string;
  batteryInfo?: { level: number; charging: boolean };
  toastText: string | null;
  onSelectFolder: (folder: FolderId) => void;
  onSelectViewMode: (mode: LibraryViewMode) => void;
  onSelectIndex: (idx: number) => void;
  onOpenBook: (book: BookItem) => void;
  onOpenInfo: (book: BookItem) => void;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
  onRequestExit: () => void;
}

const VIEW_ICONS: Record<LibraryViewMode, React.ReactNode> = {
  coverflow: <Columns3 className="h-3.5 w-3.5" />,
  ring: <Disc className="h-3.5 w-3.5" />,
  cascade: <Layers className="h-3.5 w-3.5" />,
  sphere: <Globe className="h-3.5 w-3.5" />,
  fandeck: <Sparkles className="h-3.5 w-3.5" />,
  spotlight: <Columns3 className="h-3.5 w-3.5 rotate-90" />,
  bookshelf: <Library className="h-3.5 w-3.5" />,
  grid: <LayoutGrid className="h-3.5 w-3.5" />,
};

const RING_PATHS = (() => {
  const N = 120;
  const cx = 350;
  const cy = 62;
  const Rx = 285;
  const Rz = 160;
  const D = 760;
  const tiltY = 0.25;

  const buildClosedPath = (scaleFactor: number) => {
    const cmds: string[] = [];
    for (let i = 0; i < N; i++) {
      const theta = (i / N) * Math.PI * 2;
      const z = Rz * scaleFactor * Math.cos(theta);
      const persp = D / (D - z);
      const x = (cx + Rx * scaleFactor * Math.sin(theta) * persp).toFixed(2);
      const y = (cy + z * tiltY * persp).toFixed(2);
      cmds.push(`${i === 0 ? 'M' : 'L'}${x} ${y}`);
    }
    cmds.push('Z');
    return cmds.join(' ');
  };

  return {
    outer: buildClosedPath(1),
    inner: buildClosedPath(0.86),
  };
})();

export const LibraryStage: React.FC<LibraryStageProps> = ({
  books,
  folderTabs = FOLDER_TABS,
  activeFolder,
  viewMode,
  selectedIndex,
  sphereTilt,
  settings,
  clockText,
  batteryInfo = { level: 88, charging: true },
  toastText,
  onSelectFolder,
  onSelectViewMode,
  onSelectIndex,
  onOpenBook,
  onOpenInfo,
  onOpenSearch,
  onOpenSettings,
  onRequestExit,
}) => {
  const safeIdx = books.length > 0 ? Math.min(selectedIndex, books.length - 1) : 0;
  const activeBook = books[safeIdx];
  const isBookshelf = viewMode === 'bookshelf';
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const selectedItemRef = useRef<HTMLElement | null>(null);

  const totalFolders = folderTabs.length;
  const activeFolderIdx = Math.max(
    0,
    folderTabs.findIndex((t) => t.id === activeFolder)
  );
  const prevFolderIdxRef = useRef<number>(activeFolderIdx);
  const prevFolderCountRef = useRef<number>(totalFolders);
  const folderTrackRef = useRef<HTMLDivElement | null>(null);
  const folderSlotRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  useLayoutEffect(() => {
    const track = folderTrackRef.current;
    const prevIdx = prevFolderIdxRef.current;
    const prevCount = prevFolderCountRef.current;
    prevFolderIdxRef.current = activeFolderIdx;
    prevFolderCountRef.current = totalFolders;

    if (!track || totalFolders <= 1 || prevCount !== totalFolders || prevIdx === activeFolderIdx) {
      return;
    }

    let stepDelta = activeFolderIdx - prevIdx;
    if (stepDelta > totalFolders / 2) stepDelta -= totalFolders;
    if (stepDelta < -totalFolders / 2) stepDelta += totalFolders;

    const centerEl = folderSlotRefs.current.get(0);
    const oldEl = folderSlotRefs.current.get(-stepDelta);
    if (!centerEl || !oldEl) return;

    const computed = window.getComputedStyle(track).transform;
    let liveTx = 0;
    if (computed && computed !== 'none') {
      try {
        liveTx = new DOMMatrix(computed).m41 || 0;
      } catch {
        liveTx = 0;
      }
    }

    track.style.transition = 'none';
    track.style.transform = 'translateX(0px)';

    const centerRect = centerEl.getBoundingClientRect();
    const oldRect = oldEl.getBoundingClientRect();
    const deltaPx =
      centerRect.left + centerRect.width / 2 - (oldRect.left + oldRect.width / 2);

    if (Math.abs(deltaPx) < 0.5) return;

    track.style.transform = `translateX(${(deltaPx + liveTx).toFixed(2)}px)`;
    void track.offsetWidth;
    track.style.transition = 'transform 380ms cubic-bezier(0.22, 1, 0.36, 1)';
    track.style.transform = 'translateX(0px)';
  }, [activeFolderIdx, totalFolders]);

  useEffect(() => {
    if (viewMode !== 'grid' && viewMode !== 'bookshelf') return;
    const container = scrollContainerRef.current;
    if (!container) return;

    const totalRows = Math.max(1, Math.ceil(books.length / 5));
    const currentRow = Math.floor(safeIdx / 5);

    if (currentRow === 0) {
      container.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (currentRow >= totalRows - 1) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    } else {
      selectedItemRef.current?.scrollIntoView({
        block: 'center',
        behavior: 'smooth',
      });
    }
  }, [safeIdx, books.length, viewMode, activeFolder]);

  const cycleView = (dir: -1 | 1) => {
    const idx = LIBRARY_VIEW_MODES.findIndex((v) => v.id === viewMode);
    const next = (idx + dir + LIBRARY_VIEW_MODES.length) % LIBRARY_VIEW_MODES.length;
    onSelectViewMode(LIBRARY_VIEW_MODES[next].id);
  };

  const renderCardReflection = (
    book: BookItem,
    width: number,
    height: number,
    roundedClass: string,
    extraOpacity = 0.88
  ) => (
    <div
      className="floor-reflection pointer-events-none absolute left-0 w-full overflow-hidden"
      style={{
        top: height + 5,
        height: Math.round(height * 0.48),
        opacity: extraOpacity,
      }}
    >
      <div
        style={{
          width,
          height,
          transform: 'scaleY(-1)',
          transformOrigin: 'center center',
        }}
      >
        <BookCover
          book={book}
          showProgress={false}
          isReflection
          className={`h-full w-full ${roundedClass}`}
        />
      </div>
    </div>
  );

  const renderGridCaptionBelow = (book: BookItem, isSelected: boolean) => {
    const pct = Math.round(((book.currentPage + 1) / Math.max(1, book.totalPages)) * 100);
    return (
      <div
        className={`mt-1.5 rounded-md px-2 py-1 transition-colors border ${
          isSelected
            ? 'bg-slate-900/95 border-sky-400/55'
            : 'bg-[#0e131c]/90 border-white/8'
        }`}
      >
        <div className="truncate text-[10px] font-semibold text-white leading-tight">
          {book.title}
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-1 text-[9px] text-slate-400">
          <span className="truncate">{book.author}</span>
          <span className="font-mono-hud shrink-0 text-sky-300/90">{book.format}</span>
        </div>
        <div className="mt-1 flex items-center justify-between gap-1.5 font-mono-hud text-[8.5px] text-slate-300">
          <span>
            {book.currentPage + 1}/{book.totalPages}
          </span>
          <span>{pct}%</span>
        </div>
      </div>
    );
  };

  const shelfRows = [];
  for (let i = 0; i < books.length; i += 5) {
    shelfRows.push(books.slice(i, i + 5));
  }

  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden select-none transition-colors duration-500"
      style={{
        background: isBookshelf
          ? 'linear-gradient(180deg, #161311 0%, #1d1713 55%, #120e0c 100%)'
          : 'radial-gradient(ellipse at 50% 35%, #121e36 0%, #070b14 68%, #04060b 100%)',
      }}
    >
      {/* Dynamic Ambient Color Wash */}
      {activeBook && (
        <div
          className="pointer-events-none absolute inset-0 transition-all duration-700"
          style={{
            background: `radial-gradient(circle at 50% 45%, ${activeBook.ambientColor} 0%, transparent 66%)`,
          }}
        />
      )}

      {/* UNIFIED TOP BAR — Centered circular folder ribbon with faded edges */}
      <header className="relative z-20 flex h-10 shrink-0 items-center justify-between gap-2 border-b border-white/8 bg-black/40 px-4 backdrop-blur-md">
        <div className="flex min-w-[128px] items-center gap-2 shrink-0">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-sky-500/15 text-sky-300 ring-1 ring-sky-400/30">
            <Library className="h-3.5 w-3.5" />
          </div>
          <span className="font-display text-sm font-semibold tracking-tight text-white whitespace-nowrap">
            CozyRead
          </span>
        </div>

        <nav
          aria-label="Thư mục sách"
          className="relative flex h-full min-w-0 flex-1 items-center justify-center overflow-hidden"
          style={{
            WebkitMaskImage:
              'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.55) 8%, black 20%, black 80%, rgba(0,0,0,0.55) 92%, transparent 100%)',
            maskImage:
              'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.55) 8%, black 20%, black 80%, rgba(0,0,0,0.55) 92%, transparent 100%)',
          }}
        >
          {totalFolders > 0 && (() => {
            const halfSpan = totalFolders <= 1 ? 0 : totalFolders <= 3 ? 1 : 6;
            const leftOffsets: number[] = [];
            const rightOffsets: number[] = [];
            for (let off = -halfSpan; off <= -1; off++) leftOffsets.push(off);
            for (let off = 1; off <= halfSpan; off++) rightOffsets.push(off);

            const renderTabButton = (offset: number) => {
              const tabIdx = ((activeFolderIdx + offset) % totalFolders + totalFolders) % totalFolders;
              const tab = folderTabs[tabIdx];
              const isCenter = offset === 0;
              const absOff = Math.abs(offset);
              const distanceTone = isCenter
                ? 'bg-sky-500/20 text-sky-200 ring-1 ring-sky-400/50 shadow-sm'
                : absOff === 1
                  ? 'text-slate-300/90 hover:bg-white/5 hover:text-white'
                  : absOff === 2
                    ? 'text-slate-400/75 hover:bg-white/5 hover:text-slate-200'
                    : 'text-slate-400/50 hover:bg-white/5 hover:text-slate-300';

              return (
                <button
                  key={offset}
                  ref={(el) => {
                    if (el) folderSlotRefs.current.set(offset, el);
                    else folderSlotRefs.current.delete(offset);
                  }}
                  type="button"
                  onClick={() => onSelectFolder(tab.id)}
                  className={`whitespace-nowrap shrink-0 rounded-md px-2.5 py-1 text-[10.5px] font-medium transition-colors duration-300 ${distanceTone}`}
                >
                  {tab.label}
                </button>
              );
            };

            return (
              <div
                ref={folderTrackRef}
                className="grid w-full grid-cols-[1fr_auto_1fr] items-center will-change-transform"
              >
                <div className="flex min-w-0 items-center justify-end gap-1.5 pr-1.5">
                  {leftOffsets.map((off) => renderTabButton(off))}
                </div>
                <div className="flex shrink-0 items-center justify-center">
                  {renderTabButton(0)}
                </div>
                <div className="flex min-w-0 items-center justify-start gap-1.5 pl-1.5">
                  {rightOffsets.map((off) => renderTabButton(off))}
                </div>
              </div>
            );
          })()}
        </nav>

        <div className="flex min-w-[128px] items-center justify-end gap-3 shrink-0 font-mono-hud text-[11px] text-slate-300">
          <button
            type="button"
            onClick={onOpenSettings}
            title="Âm thanh & Cài đặt"
            className="flex items-center rounded px-1 py-0.5 text-slate-400 hover:bg-white/8 hover:text-white transition-colors"
          >
            {settings.sfxEnabled ? (
              <Volume2 className="h-3.5 w-3.5 text-sky-300" />
            ) : (
              <VolumeX className="h-3.5 w-3.5 text-slate-500" />
            )}
          </button>
          <span className="text-slate-200">{clockText}</span>
          <BatteryBadge level={batteryInfo.level} charging={batteryInfo.charging} />
        </div>
      </header>

      {/* UNIFIED COMPACT VIEW SWITCHER BAR */}
      <div className="relative z-20 flex shrink-0 items-center justify-center gap-2 pt-2 pb-1">
        <button
          type="button"
          onClick={() => cycleView(-1)}
          className="flex h-6 w-6 items-center justify-center rounded-full bg-white/8 text-slate-300 hover:bg-white/15 hover:text-white transition-colors"
          aria-label="Kiểu thư viện trước"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>

        <div className="flex items-center gap-0.5 rounded-lg bg-white/6 p-0.5 ring-1 ring-white/10 backdrop-blur-md transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]">
          {LIBRARY_VIEW_MODES.map((m) => {
            const active = m.id === viewMode;
            return (
              <button
                key={m.id}
                type="button"
                title={m.label}
                aria-label={m.label}
                onClick={() => onSelectViewMode(m.id)}
                className={`flex items-center justify-center rounded-md py-1 text-[10px] font-medium whitespace-nowrap shrink-0 transition-[padding,background-color,color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  active
                    ? 'bg-sky-500 px-2.5 text-slate-950 shadow-sm font-semibold'
                    : 'px-2 text-slate-300/75 hover:bg-white/8 hover:text-white'
                }`}
              >
                {VIEW_ICONS[m.id]}
                <span
                  className={`overflow-hidden whitespace-nowrap transition-[max-width,opacity,margin] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                    active ? 'max-w-[78px] opacity-100 ml-1' : 'max-w-0 opacity-0 ml-0'
                  }`}
                >
                  {m.short}
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => cycleView(1)}
          className="flex h-6 w-6 items-center justify-center rounded-full bg-white/8 text-slate-300 hover:bg-white/15 hover:text-white transition-colors"
          aria-label="Kiểu thư viện tiếp"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* MAIN STAGE AREA */}
      <main className="relative min-h-0 flex-1 overflow-hidden">
        {toastText && (
          <div className="pointer-events-none absolute top-3 right-4 z-40 rounded-lg bg-slate-950/62 px-3 py-1.5 font-mono-hud text-[11px] text-sky-100 ring-1 ring-sky-400/35 backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.45)] animate-toast-in">
            {toastText}
          </div>
        )}

        <div key={`${viewMode}-${activeFolder}`} className="h-full w-full animate-library-view">
          {books.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-slate-400 px-6 text-center">
            <Library className="mb-2 h-9 w-9 opacity-40" />
            <p className="text-sm font-medium text-slate-300">
              {activeFolder === 'favorites'
                ? 'Chưa có sách Yêu thích nào'
                : activeFolder === 'all'
                  ? 'Thư mục /storage/roms/books/ đang trống'
                  : 'Thư mục này chưa có cuốn sách nào'}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {activeFolder === 'favorites'
                ? 'Chọn một cuốn sách rồi bấm [X] → [Y] để thêm vào Yêu thích'
                : activeFolder === 'all'
                  ? 'Hãy chép file .epub, .cbz, .pdf hoặc .txt vào thẻ nhớ (roms/books/) rồi bấm [Start] → Quét lại'
                  : 'Bấm L1 / R1 để chuyển sang thư mục khác'}
            </p>
          </div>
        ) : (
          <>
            {/* 1. 3D COVER FLOW */}
            {viewMode === 'coverflow' && (
              <div className="perspective-1400 relative flex h-full w-full items-center justify-center">
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[40%] bg-gradient-to-b from-sky-950/25 via-slate-950/75 to-black/95 border-t border-white/12" />

                <div className="preserve-3d relative flex h-52 w-full items-center justify-center -mt-12">
                  {books.map((book, idx) => {
                    const offset = idx - safeIdx;
                    if (Math.abs(offset) > 4) return null;
                    const isCenter = offset === 0;
                    const abs = Math.abs(offset);
                    const sign = offset < 0 ? -1 : 1;
                    const translateX = isCenter ? 0 : sign * (130 + (abs - 1) * 74);
                    const translateZ = isCenter ? 70 : -85 - abs * 35;
                    const rotateY = isCenter ? 0 : sign * -45;
                    const scale = isCenter ? 1.06 : Math.max(0.68, 0.88 - abs * 0.08);
                    const opacity = isCenter ? 1 : Math.max(0.38, 0.88 - abs * 0.15);
                    const cardW = 132;
                    const cardH = 176;

                    return (
                      <div
                        key={book.id}
                        onClick={() => (isCenter ? onOpenBook(book) : onSelectIndex(idx))}
                        className="absolute cursor-pointer transition-all duration-300 ease-out"
                        style={{
                          width: cardW,
                          height: cardH,
                          zIndex: 30 - abs,
                          opacity,
                          transform: `translate3d(${translateX}px, 0px, ${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`,
                        }}
                      >
                        <BookCover
                          book={book}
                          isSelected={isCenter}
                          className={`h-full w-full rounded-lg transition-shadow duration-300 ${
                            isCenter
                              ? 'ring-2 ring-sky-400 shadow-[0_0_28px_rgba(56,189,248,0.5)]'
                              : 'ring-1 ring-white/25 shadow-xl'
                          }`}
                        />
                        {renderCardReflection(book, cardW, cardH, 'rounded-lg', 0.9)}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 2. 3D ORBITAL RING */}
            {viewMode === 'ring' && (
              <div className="perspective-1400 relative flex h-full w-full items-center justify-center">
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[40%] bg-gradient-to-b from-sky-950/20 via-slate-950/80 to-black border-t border-white/10" />
                <div className="relative flex h-52 w-full items-center justify-center -mt-11">
                  {/* True 3D perspective tilted circle (~30° elevation) parallel to floor plane */}
                  <svg
                    viewBox="0 0 700 140"
                    className="pointer-events-none absolute left-1/2 overflow-visible"
                    style={{
                      top: 'calc(50% + 56px)',
                      width: 700,
                      height: 140,
                      transform: 'translate(-50%, -62px)',
                      zIndex: 0,
                    }}
                  >
                    <defs>
                      <radialGradient id="ringFloorGlow" cx="50%" cy="54%" r="50%">
                        <stop offset="0%" stopColor="rgba(56, 189, 248, 0.12)" />
                        <stop offset="70%" stopColor="rgba(56, 189, 248, 0.04)" />
                        <stop offset="100%" stopColor="rgba(56, 189, 248, 0)" />
                      </radialGradient>
                      <linearGradient id="ringDepthGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.16" />
                        <stop offset="48%" stopColor="#38bdf8" stopOpacity="0.42" />
                        <stop offset="100%" stopColor="#7dd3fc" stopOpacity="0.78" />
                      </linearGradient>
                      <linearGradient id="ringInnerGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.06" />
                        <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.28" />
                      </linearGradient>
                    </defs>
                    <ellipse cx="350" cy="64" rx="280" ry="44" fill="url(#ringFloorGlow)" />
                    <path
                      d={RING_PATHS.inner}
                      fill="none"
                      stroke="url(#ringInnerGrad)"
                      strokeWidth="0.85"
                    />
                    <path
                      d={RING_PATHS.outer}
                      fill="none"
                      stroke="url(#ringDepthGrad)"
                      strokeWidth="1.25"
                    />
                  </svg>
                  {books.map((book, idx) => {
                    const count = books.length;
                    let rel = idx - safeIdx;
                    if (rel > count / 2) rel -= count;
                    if (rel < -count / 2) rel += count;
                    const angle = (rel / Math.max(1, count)) * Math.PI * 2;
                    const radiusX = 245;
                    const radiusZ = 140;
                    const x = Math.sin(angle) * radiusX;
                    const z = Math.cos(angle) * radiusZ;
                    const depthNorm = (z + radiusZ) / (2 * radiusZ);
                    const isCenter = idx === safeIdx;
                    const scale = 0.54 + depthNorm * 0.54;
                    const y = (1 - depthNorm) * -18;
                    const opacity = 0.36 + depthNorm * 0.64;
                    const rotateY = -Math.sin(angle) * 32;
                    const cardW = 122;
                    const cardH = 164;

                    return (
                      <div
                        key={book.id}
                        onClick={() => (isCenter ? onOpenBook(book) : onSelectIndex(idx))}
                        className="absolute cursor-pointer transition-all duration-350 ease-out"
                        style={{
                          width: cardW,
                          height: cardH,
                          zIndex: Math.round(depthNorm * 50),
                          opacity,
                          transform: `translate3d(${x}px, ${y}px, 0px) rotateY(${rotateY}deg) scale(${scale})`,
                        }}
                      >
                        <BookCover
                          book={book}
                          isSelected={isCenter}
                          className={`h-full w-full rounded-lg ${
                            isCenter
                              ? 'ring-2 ring-sky-300 shadow-[0_0_28px_rgba(56,189,248,0.6)]'
                              : 'ring-1 ring-white/25'
                          }`}
                        />
                        {depthNorm > 0.45 && renderCardReflection(book, cardW, cardH, 'rounded-lg', 0.88)}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 3. 3D CASCADE STACK */}
            {viewMode === 'cascade' && (
              <div className="perspective-1400 relative flex h-full w-full items-center justify-center">
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[40%] bg-gradient-to-b from-slate-900/25 via-slate-950/85 to-black border-t border-white/12" />
                <div className="preserve-3d relative flex h-52 w-full items-center justify-center -mt-11">
                  {books.map((book, idx) => {
                    const count = books.length;
                    const offset = (idx - safeIdx + count) % count;
                    if (offset > 5) return null;
                    const isFront = offset === 0;
                    const translateX = -115 + offset * 76;
                    const translateZ = 90 - offset * 55;
                    const scale = isFront ? 1.05 : Math.max(0.7, 0.92 - offset * 0.06);
                    const opacity = Math.max(0.35, 1 - offset * 0.13);
                    const cardW = 138;
                    const cardH = 184;

                    return (
                      <div
                        key={book.id}
                        onClick={() => (isFront ? onOpenBook(book) : onSelectIndex(idx))}
                        className="absolute cursor-pointer transition-all duration-300 ease-out"
                        style={{
                          width: cardW,
                          height: cardH,
                          zIndex: 40 - offset,
                          opacity,
                          transform: `translate3d(${translateX}px, ${offset * 2}px, ${translateZ}px) rotateY(16deg) scale(${scale})`,
                        }}
                      >
                        <BookCover
                          book={book}
                          isSelected={isFront}
                          className={`h-full w-full rounded-xl ${
                            isFront
                              ? 'ring-2 ring-sky-400 shadow-[0_0_30px_rgba(56,189,248,0.52)]'
                              : 'ring-1 ring-white/25 shadow-2xl'
                          }`}
                        />
                        {renderCardReflection(book, cardW, cardH, 'rounded-xl', 0.9)}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 4. 3D ORBITAL SPHERE */}
            {viewMode === 'sphere' && (
              <div className="perspective-1400 relative flex h-full w-full items-center justify-center">
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[36%] bg-gradient-to-b from-sky-950/15 via-slate-950/80 to-black border-t border-white/10" />
                <svg
                  viewBox="0 0 600 320"
                  className="pointer-events-none absolute inset-0 m-auto h-72 w-[540px] opacity-55"
                >
                  <ellipse cx="300" cy="160" rx="250" ry="96" fill="none" stroke="#38bdf8" strokeWidth="1" />
                  <ellipse
                    cx="300"
                    cy="160"
                    rx="230"
                    ry="72"
                    fill="none"
                    stroke="#60a5fa"
                    strokeWidth="0.9"
                    transform="rotate(-14 300 160)"
                  />
                  <ellipse
                    cx="300"
                    cy="160"
                    rx="230"
                    ry="72"
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="0.9"
                    transform="rotate(14 300 160)"
                  />
                </svg>

                <div className="relative flex h-56 w-full items-center justify-center -mt-9">
                  {books.map((book, idx) => {
                    const count = books.length;
                    let rel = idx - safeIdx;
                    if (rel > count / 2) rel -= count;
                    if (rel < -count / 2) rel += count;
                    const isCenter = idx === safeIdx;
                    const theta = (rel / Math.max(1, count)) * Math.PI * 2;
                    const lat = isCenter ? 0 : Math.sin(idx * 1.9 + sphereTilt * 0.5) * 0.65;
                    const R_x = 236;
                    const R_y = 84;
                    const x = isCenter ? 0 : Math.sin(theta) * Math.cos(lat) * R_x;
                    const y = isCenter ? -6 : Math.sin(lat) * R_y;
                    const z = isCenter ? 1 : Math.cos(theta) * Math.cos(lat);
                    const depthNorm = (z + 1) / 2;
                    const scale = isCenter ? 1.06 : 0.45 + depthNorm * 0.42;
                    const opacity = isCenter ? 1 : 0.34 + depthNorm * 0.62;
                    const cardW = 114;
                    const cardH = 154;

                    return (
                      <div
                        key={book.id}
                        onClick={() => (isCenter ? onOpenBook(book) : onSelectIndex(idx))}
                        className="absolute cursor-pointer transition-all duration-350 ease-out"
                        style={{
                          width: cardW,
                          height: cardH,
                          zIndex: isCenter ? 60 : Math.round(depthNorm * 45),
                          opacity,
                          transform: `translate3d(${x}px, ${y}px, 0px) scale(${scale})`,
                        }}
                      >
                        <BookCover
                          book={book}
                          isSelected={isCenter}
                          className={`h-full w-full rounded-lg ${
                            isCenter
                              ? 'ring-2 ring-sky-300 shadow-[0_0_32px_rgba(56,189,248,0.65)]'
                              : 'ring-1 ring-sky-300/35 shadow-lg'
                          }`}
                        />
                        {(isCenter || depthNorm > 0.65) &&
                          renderCardReflection(book, cardW, cardH, 'rounded-lg', isCenter ? 0.92 : 0.55)}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 5. 3D FAN DECK */}
            {viewMode === 'fandeck' && (
              <div className="relative flex h-full w-full flex-col items-center justify-center">
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[38%] bg-gradient-to-b from-slate-900/20 via-slate-950/80 to-black border-t border-white/10" />
                <div className="relative flex h-52 w-full items-center justify-center -mt-10">
                  {books.map((book, idx) => {
                    const offset = idx - safeIdx;
                    if (Math.abs(offset) > 3) return null;
                    const isCenter = offset === 0;
                    const abs = Math.abs(offset);
                    const translateX = offset * 76;
                    const translateY = abs * abs * 7;
                    const rotateZ = offset * 7.5;
                    const scale = isCenter ? 1.05 : Math.max(0.76, 0.94 - abs * 0.06);
                    const opacity = isCenter ? 1 : Math.max(0.54, 0.92 - abs * 0.13);
                    const cardW = 130;
                    const cardH = 176;

                    return (
                      <div
                        key={book.id}
                        onClick={() => (isCenter ? onOpenBook(book) : onSelectIndex(idx))}
                        className="absolute cursor-pointer transition-all duration-300 ease-out"
                        style={{
                          width: cardW,
                          height: cardH,
                          zIndex: 30 - abs,
                          opacity,
                          transform: `translate(${translateX}px, ${translateY}px) rotate(${rotateZ}deg) scale(${scale})`,
                        }}
                      >
                        <BookCover
                          book={book}
                          isSelected={isCenter}
                          className={`h-full w-full rounded-2xl ${
                            isCenter
                              ? 'ring-2 ring-white/85 shadow-[0_20px_40px_rgba(0,0,0,0.85)]'
                              : 'ring-1 ring-white/20 shadow-2xl'
                          }`}
                        />
                        {abs <= 1 && renderCardReflection(book, cardW, cardH, 'rounded-2xl', isCenter ? 0.85 : 0.5)}
                      </div>
                    );
                  })}
                </div>

                <div className="relative z-20 mt-8 flex items-center gap-1.5 rounded-full bg-white/8 px-3 py-1 backdrop-blur-xs">
                  {books.map((b, idx) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => onSelectIndex(idx)}
                      className={`h-1.5 rounded-full transition-all ${
                        idx === safeIdx ? 'w-4 bg-white' : 'w-1.5 bg-white/30 hover:bg-white/60'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 6. 3D SPOTLIGHT DEPTH */}
            {viewMode === 'spotlight' && (
              <div className="relative flex h-full w-full flex-col items-center justify-center">
                <div
                  className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-b from-slate-900/22 via-slate-950/82 to-black border-t border-white/12"
                  style={{ top: 'calc(50% + 12px)' }}
                />
                <div className="relative flex h-52 w-full items-center justify-center -mt-10">
                  {books.map((book, idx) => {
                    const offset = idx - safeIdx;
                    if (Math.abs(offset) > 3) return null;
                    const isCenter = offset === 0;
                    const abs = Math.abs(offset);
                    const translateX = offset * 124;
                    const scale = isCenter ? 1.07 : Math.max(0.64, 0.88 - abs * 0.12);
                    const brightness = isCenter ? 1 : Math.max(0.36, 0.72 - abs * 0.16);
                    const cardW = 132;
                    const cardH = 178;

                    return (
                      <div
                        key={book.id}
                        onClick={() => (isCenter ? onOpenBook(book) : onSelectIndex(idx))}
                        className="absolute cursor-pointer transition-all duration-300 ease-out"
                        style={{
                          width: cardW,
                          height: cardH,
                          zIndex: 30 - abs,
                          filter: `brightness(${brightness})`,
                          transform: `translateX(${translateX}px) scale(${scale})`,
                        }}
                      >
                        <BookCover
                          book={book}
                          isSelected={isCenter}
                          className={`h-full w-full rounded-xl ${
                            isCenter
                              ? 'ring-2 ring-white/55 shadow-[0_24px_50px_rgba(0,0,0,0.9)]'
                              : 'ring-1 ring-white/15'
                          }`}
                        />
                        {renderCardReflection(book, cardW, cardH, 'rounded-xl', isCenter ? 0.9 : 0.55)}
                      </div>
                    );
                  })}
                </div>

                <div className="relative z-20 mt-8 flex items-center gap-1.5 rounded-full bg-white/8 px-3 py-1 backdrop-blur-xs">
                  {books.map((b, idx) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => onSelectIndex(idx)}
                      className={`h-1.5 rounded-full transition-all ${
                        idx === safeIdx ? 'w-5 bg-white' : 'w-1.5 bg-white/30 hover:bg-white/60'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 7. BOOKSHELF MODE */}
            {viewMode === 'bookshelf' && (
              <div
                ref={scrollContainerRef}
                className="flex h-full flex-col justify-start gap-4 overflow-y-auto px-6 pt-5 pb-6 no-scrollbar"
              >
                {shelfRows.map((rowBooks, rowIdx) => {
                  const rowContainsSelected = Math.floor(safeIdx / 5) === rowIdx;
                  return (
                    <div
                      key={rowIdx}
                      ref={rowContainsSelected ? (el) => { selectedItemRef.current = el; } : null}
                      className="relative flex flex-col shrink-0"
                    >
                      <div className="grid grid-cols-5 items-end gap-4 px-4 pb-1">
                        {rowBooks.map((book, localIdx) => {
                          const globalIdx = rowIdx * 5 + localIdx;
                          const isSelected = globalIdx === safeIdx;
                          return (
                            <button
                              key={book.id}
                              type="button"
                              onClick={() =>
                                isSelected ? onOpenBook(book) : onSelectIndex(globalIdx)
                              }
                              className={`group mx-auto w-[96px] aspect-[3/4] transition-all duration-200 ${
                                isSelected
                                  ? '-translate-y-2 scale-[1.06] z-10'
                                  : 'opacity-90 hover:-translate-y-1 hover:opacity-100'
                              }`}
                            >
                              <BookCover
                                book={book}
                                isSelected={isSelected}
                                className={`h-full w-full rounded-md ${
                                  isSelected
                                    ? 'ring-2 ring-amber-300 shadow-[0_12px_24px_rgba(0,0,0,0.9),0_0_16px_rgba(251,191,36,0.38)]'
                                    : 'shadow-[0_6px_14px_rgba(0,0,0,0.7)]'
                                }`}
                              />
                            </button>
                          );
                        })}
                      </div>
                      <div className="h-3 w-full rounded-sm bg-gradient-to-b from-[#664632] via-[#432b1d] to-[#23150d] shadow-[0_8px_18px_rgba(0,0,0,0.8)] ring-1 ring-amber-200/12" />
                    </div>
                  );
                })}
              </div>
            )}

            {/* 8. CLEAN GRID MODE */}
            {viewMode === 'grid' && (
              <div
                ref={scrollContainerRef}
                className="grid h-full grid-cols-5 gap-3.5 overflow-y-auto px-6 pt-4 pb-6 no-scrollbar"
              >
                {books.map((book, idx) => {
                  const isSelected = idx === safeIdx;
                  return (
                    <button
                      key={book.id}
                      ref={isSelected ? (el) => { selectedItemRef.current = el; } : null}
                      type="button"
                      onClick={() => (isSelected ? onOpenBook(book) : onSelectIndex(idx))}
                      className={`flex flex-col text-left transition-all duration-200 ${
                        isSelected ? 'scale-[1.02]' : 'opacity-85 hover:opacity-100'
                      }`}
                    >
                      <div className="mx-auto w-full max-w-[118px] aspect-[3/4]">
                        <BookCover
                          book={book}
                          isSelected={isSelected}
                          className={`h-full w-full rounded-lg ${
                            isSelected
                              ? 'ring-2 ring-sky-400 shadow-[0_0_20px_rgba(56,189,248,0.45)]'
                              : 'ring-1 ring-white/15'
                          }`}
                        />
                      </div>
                      {renderGridCaptionBelow(book, isSelected)}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
        </div>
      </main>

      {/* ACTIVE BOOK CAPTION BAR */}
      {activeBook && (
        <div className="relative z-20 flex shrink-0 items-center justify-between px-5 py-1.5 text-xs bg-[#0b0f17]/95 border-t border-white/10">
          <div className="flex items-center gap-2 min-w-0">
            <span className="truncate font-semibold text-white">{activeBook.title}</span>
            <span className="text-slate-500">·</span>
            <span className="truncate text-slate-300">{activeBook.author}</span>
            <span className="text-slate-500">·</span>
            <span className="text-sky-300/90 whitespace-nowrap">{activeBook.folderName}</span>
          </div>
          <div className="flex items-center gap-3 shrink-0 font-mono-hud text-[11px] text-slate-300">
            <span>{activeBook.format}</span>
            <span className="text-slate-500">·</span>
            <span>
              Trang {activeBook.currentPage + 1}/{activeBook.totalPages} (
              {Math.round(((activeBook.currentPage + 1) / Math.max(1, activeBook.totalPages)) * 100)}%)
            </span>
          </div>
        </div>
      )}

      {/* UNIFIED BOTTOM BUTTON HINTS BAR — Subtle muted [key] + icon format */}
      {settings.showHints && (
        <footer className="relative z-20 flex h-8 shrink-0 items-center justify-between bg-black/55 px-4 text-[10px] text-slate-400/55 border-t border-white/6 opacity-60 hover:opacity-95 transition-opacity">
          <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
            <span
              title="Chọn sách [D-Pad]"
              className="flex items-center gap-1 whitespace-nowrap"
            >
              <strong className="text-slate-300/80 font-mono-hud">[D-Pad]</strong>
              <Move className="h-3 w-3 text-slate-400/75" />
            </span>
            <span
              title="Chuyển thư mục [L1/R1]"
              className="flex items-center gap-1 whitespace-nowrap"
            >
              <strong className="text-slate-300/80 font-mono-hud">[L1/R1]</strong>
              <Folder className="h-3 w-3 text-slate-400/75" />
            </span>
            <span
              title="Nhảy ±10 cuốn [L2/R2]"
              className="flex items-center gap-1 whitespace-nowrap"
            >
              <strong className="text-slate-300/80 font-mono-hud">[L2/R2]</strong>
              <ChevronsLeftRight className="h-3.5 w-3.5 text-slate-400/75" />
            </span>
            <button
              type="button"
              onClick={() => activeBook && onOpenBook(activeBook)}
              title="Đọc sách [A]"
              className="flex items-center gap-1 whitespace-nowrap hover:text-emerald-200 transition-colors"
            >
              <strong className="text-emerald-300/75 font-mono-hud">[A]</strong>
              <BookOpen className="h-3 w-3 text-emerald-300/75" />
            </button>
            <button
              type="button"
              onClick={onOpenSearch}
              title="Tìm sách [B]"
              className="flex items-center gap-1 whitespace-nowrap hover:text-rose-200 transition-colors"
            >
              <strong className="text-rose-300/75 font-mono-hud">[B]</strong>
              <Search className="h-3 w-3 text-rose-300/75" />
            </button>
            <button
              type="button"
              onClick={() => cycleView(1)}
              title="Đổi kiểu thư viện 3D [Y]"
              className="flex items-center gap-1 whitespace-nowrap hover:text-amber-200 transition-colors"
            >
              <strong className="text-amber-300/75 font-mono-hud">[Y]</strong>
              <Layers className="h-3 w-3 text-amber-300/75" />
            </button>
            <button
              type="button"
              onClick={() => activeBook && onOpenInfo(activeBook)}
              title="Chi tiết sách [X]"
              className="flex items-center gap-1 whitespace-nowrap hover:text-sky-200 transition-colors"
            >
              <strong className="text-sky-300/75 font-mono-hud">[X]</strong>
              <Info className="h-3 w-3 text-sky-300/75" />
            </button>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onOpenSettings}
              title="Cài đặt [Start]"
              className="flex items-center gap-1 text-slate-300/75 hover:text-sky-300 transition-colors"
            >
              <strong className="font-mono-hud">[Start]</strong>
              <Settings className="h-3.5 w-3.5 text-sky-300/75" />
            </button>
            <button
              type="button"
              onClick={onRequestExit}
              title="Thoát ứng dụng [Select]"
              className="flex items-center gap-1 text-slate-300/75 hover:text-rose-300 transition-colors"
            >
              <strong className="font-mono-hud">[Select]</strong>
              <Power className="h-3.5 w-3.5 text-rose-400/75" />
            </button>
          </div>
        </footer>
      )}
    </div>
  );
};
