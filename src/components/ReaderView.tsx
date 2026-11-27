import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Bookmark,
  BookCopy,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Columns2,
  EyeOff,
  Library,
  List,
  Palette,
  RotateCw,
  SlidersHorizontal,
  Sun,
  Sunset,
  Trash2,
  Type,
  ZoomIn,
} from 'lucide-react';
import {
  AppSettings,
  BookItem,
  PageTurnMode,
  ReaderTheme,
} from '../data/books';
import { getBookChapters, getCurrentChapterInfo } from '../utils/bookStats';
import { renderSpreadSnapshot } from '../utils/pageSnapshot';
import { BatteryBadge } from './BatteryBadge';

export type TocTab = 'chapters' | 'bookmarks';

interface ReaderViewProps {
  book: BookItem;
  settings: AppSettings;
  showHud: boolean;
  quickMenuOpen: boolean;
  quickMenuIndex: number;
  tocOpen: boolean;
  tocTab: TocTab;
  tocIndex: number;
  zoomLevel: number;
  panOffset: { x: number; y: number };
  turnAnimKey: number;
  turnDirection: 'next' | 'prev';
  turnFromPage: number;
  clockText: string;
  batteryInfo?: { level: number; charging: boolean };
  toastText: string | null;
  onToggleHud: () => void;
  onRotateScreen: () => void;
  onTurnPage: (dir: 'next' | 'prev') => void;
  onJumpToPage: (pageIdx: number) => void;
  onToggleBookmark: () => void;
  onRemoveBookmark: (pageIdx: number) => void;
  onToggleTwoPage: () => void;
  onToggleQuickMenu: () => void;
  onToggleToc: () => void;
  onChangeTocTab: (tab: TocTab) => void;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  onToggleZoom: () => void;
  onCloseBook: () => void;
}

const THEME_STYLES: Record<
  ReaderTheme,
  { name: string; bg: string; pageBg: string; text: string; muted: string; gutter: string; curlBack: string }
> = {
  sepia: {
    name: 'Giấy cũ',
    bg: '#e5dac3',
    pageBg: '#f6eedb',
    text: '#36291b',
    muted: '#7c6852',
    gutter: 'rgba(85, 60, 35, 0.14)',
    curlBack: '#efe2c6',
  },
  paper: {
    name: 'Trắng sáng',
    bg: '#e8eaee',
    pageBg: '#fbfbfc',
    text: '#181c23',
    muted: '#64748b',
    gutter: 'rgba(15, 23, 42, 0.10)',
    curlBack: '#f1f5f9',
  },
  slate: {
    name: 'Ban đêm',
    bg: '#151a23',
    pageBg: '#1c222e',
    text: '#dbe2ec',
    muted: '#8896ab',
    gutter: 'rgba(0, 0, 0, 0.38)',
    curlBack: '#262f40',
  },
  midnight: {
    name: 'Đen tuyền',
    bg: '#040508',
    pageBg: '#090b10',
    text: '#c8d0dc',
    muted: '#697586',
    gutter: 'rgba(255, 255, 255, 0.06)',
    curlBack: '#151923',
  },
  matcha: {
    name: 'Rừng thông',
    bg: '#d7e4d4',
    pageBg: '#e8f1e5',
    text: '#1f3121',
    muted: '#577059',
    gutter: 'rgba(25, 50, 30, 0.12)',
    curlBack: '#dcead8',
  },
};

const PAGE_TURN_LABELS: { id: PageTurnMode; label: string }[] = [
  { id: 'curl', label: 'Cong 3D' },
  { id: 'fade', label: 'Mờ dần' },
  { id: 'slide', label: 'Trượt mượt' },
  { id: 'instant', label: 'Tức thì' },
];

// Base stationary page renderer using the exact same snapshot engine as PageCurlCanvas
// Guarantees 0px shift between resting view and 3D page-turn animation
const SpreadCanvas: React.FC<{
  book: BookItem;
  pageIdx: number;
  settings: AppSettings;
  theme: { bg: string; pageBg: string; text: string; muted: string; gutter: string };
  isPortrait: boolean;
  showHud: boolean;
  isComic: boolean;
}> = ({ book, pageIdx, settings, theme, isPortrait, showHud, isComic }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [sizeTick, setSizeTick] = useState(0);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSizeTick((t) => t + 1);
    });
    ro.observe(el);
    let mounted = true;
    document.fonts?.ready.then(() => {
      if (mounted) setSizeTick((t) => t + 1);
    });
    return () => {
      mounted = false;
      ro.disconnect();
    };
  }, []);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = Math.max(1, Math.round(canvas.clientWidth || canvas.offsetWidth));
    const h = Math.max(1, Math.round(canvas.clientHeight || canvas.offsetHeight));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const snap = renderSpreadSnapshot(book, pageIdx, w, h, dpr, settings, theme, {
      isPortrait,
      showHud,
      isComic,
      onImageReady: () => setSizeTick((t) => t + 1),
    });
    ctx.drawImage(snap, 0, 0, w, h);
  }, [book, pageIdx, settings, theme, isPortrait, showHud, isComic, sizeTick]);

  return <canvas ref={canvasRef} className="block h-full w-full" />;
};

// Realistic 60fps Canvas 3D Page Flip using actual before/after spread snapshots:
// - Uses useLayoutEffect so frame 0 renders before paint (zero 1-frame flash)
// - Shares exact pixel output with SpreadCanvas (zero vertical/horizontal jump)
const PageCurlCanvas: React.FC<{
  animKey: number;
  direction: 'next' | 'prev';
  isTwoPageSpread: boolean;
  paperColor: string;
  isDark: boolean;
  book: BookItem;
  fromPageIdx: number;
  toPageIdx: number;
  settings: AppSettings;
  theme: { bg: string; pageBg: string; text: string; muted: string; gutter: string };
  isPortrait: boolean;
  showHud: boolean;
  isComic: boolean;
  onComplete: () => void;
}> = ({
  animKey,
  direction,
  isTwoPageSpread,
  paperColor,
  isDark,
  book,
  fromPageIdx,
  toPageIdx,
  settings,
  theme,
  isPortrait,
  showHud,
  isComic,
  onComplete,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const configRef = useRef({
    direction,
    isTwoPageSpread,
    paperColor,
    isDark,
    book,
    fromPageIdx,
    toPageIdx,
    settings,
    theme,
    isPortrait,
    showHud,
    isComic,
  });
  configRef.current = {
    direction,
    isTwoPageSpread,
    paperColor,
    isDark,
    book,
    fromPageIdx,
    toPageIdx,
    settings,
    theme,
    isPortrait,
    showHud,
    isComic,
  };

  useLayoutEffect(() => {
    if (animKey <= 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const {
      direction: dir,
      isTwoPageSpread: twoPage,
      paperColor: sheetColor,
      isDark: darkMode,
      book: curBook,
      fromPageIdx: oldIdx,
      toPageIdx: newIdx,
      settings: curSettings,
      theme: curTheme,
      isPortrait: portrait,
      showHud: hudVisible,
      isComic: comicMode,
    } = configRef.current;

    const w = Math.max(1, Math.round(canvas.clientWidth || canvas.offsetWidth));
    const h = Math.max(1, Math.round(canvas.clientHeight || canvas.offsetHeight));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Capture crisp offscreen snapshots of BOTH old and new spreads once per turn
    const oldSnap = renderSpreadSnapshot(curBook, oldIdx, w, h, dpr, curSettings, curTheme, {
      isPortrait: portrait,
      showHud: hudVisible,
      isComic: comicMode,
    });
    const newSnap = renderSpreadSnapshot(curBook, newIdx, w, h, dpr, curSettings, curTheme, {
      isPortrait: portrait,
      showHud: hudVisible,
      isComic: comicMode,
    });

    const duration = 450;
    let startTime: number | null = null;
    let rafId = 0;

    const easeInOutSine = (x: number) => 0.5 - 0.5 * Math.cos(Math.PI * x);
    const quadPt = (
      p0: { x: number; y: number },
      c: { x: number; y: number },
      p1: { x: number; y: number },
      t: number
    ) => {
      const inv = 1 - t;
      return {
        x: inv * inv * p0.x + 2 * inv * t * c.x + t * t * p1.x,
        y: inv * inv * p0.y + 2 * inv * t * c.y + t * t * p1.y,
      };
    };

    // Map canonical left-turning ('next') X coordinate onto actual direction without mirroring text
    const mx = (x: number) => (dir === 'next' ? x : w - x);

    const drawFrame = (now: number) => {
      if (startTime === null) startTime = now;
      const rawT = Math.min(1, (now - startTime) / duration);
      const p = easeInOutSine(rawT);

      ctx.clearRect(0, 0, w, h);

      // 1. Base Layer: OLD page snapshot
      ctx.drawImage(oldSnap, 0, 0, w, h);

      if (p > 0.002) {
        // Bottom corner initiates turn; top corner follows diagonally
        const pBot = Math.min(1, p + 0.34 * Math.sin(Math.PI * p));
        const pTop = Math.max(0, p - 0.22 * Math.sin(Math.PI * p));

        const tipBotX = twoPage ? w * (1 - pBot) : w * (1 - pBot * 2);
        const tipTopX = twoPage ? w * (1 - pTop) : w * (1 - pTop * 2);

        const crestBotX = Math.max(twoPage ? w * 0.5 : 0, (w + tipBotX) * 0.5);
        const crestTopX = Math.max(twoPage ? w * 0.5 : 0, (w + tipTopX) * 0.5);

        const liftBot = Math.sin(pBot * Math.PI) * (h * 0.125);
        const liftTop = Math.sin(pTop * Math.PI) * (h * 0.04);

        const tipBotY = h - liftBot;
        const tipTopY = liftTop;

        const fTop = { x: mx(crestTopX), y: 0 };
        const fBot = { x: mx(crestBotX), y: h };
        const tTop = { x: mx(tipTopX), y: tipTopY };
        const tBot = { x: mx(tipBotX), y: tipBotY };

        const foldMidX = (fTop.x + fBot.x) * 0.5;
        const foldMidY = h * 0.52;
        const foldCtrlX = foldMidX + (dir === 'next' ? -1 : 1) * Math.sin(p * Math.PI) * 10;

        const topArchCtrl = {
          x: mx((crestTopX + tipTopX) * 0.5),
          y: Math.max(1, tipTopY * 0.15 - Math.sin(p * Math.PI) * 4),
        };
        const outerCtrl = {
          x: mx((tipTopX + tipBotX) * 0.5 - Math.sin(p * Math.PI) * 12),
          y: (tipTopY + tipBotY) * 0.5,
        };
        const botArchCtrl = {
          x: mx((tipBotX + crestBotX) * 0.5 - 6),
          y: Math.min(h - 1, h - liftBot * 0.2),
        };

        // 2. Uncovered NEW page snapshot strictly behind where the fold crease has passed
        ctx.save();
        ctx.beginPath();
        if (dir === 'next') {
          ctx.moveTo(fTop.x, 0);
          ctx.lineTo(w, 0);
          ctx.lineTo(w, h);
          ctx.lineTo(fBot.x, h);
          ctx.quadraticCurveTo(foldCtrlX, foldMidY, fTop.x, 0);
        } else {
          ctx.moveTo(0, 0);
          ctx.lineTo(fTop.x, 0);
          ctx.quadraticCurveTo(foldCtrlX, foldMidY, fBot.x, h);
          ctx.lineTo(0, h);
        }
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(newSnap, 0, 0, w, h);

        // Soft crease shadow cast onto the newly revealed page
        const fxAvg = (fTop.x + fBot.x) * 0.5;
        const sheenFade = rawT > 0.85 ? Math.max(0, 1 - (rawT - 0.85) / 0.15) : 1;
        if (sheenFade > 0.01) {
          const sSpan = dir === 'next' ? 42 : -42;
          const revealShadow = ctx.createLinearGradient(
            fxAvg - (dir === 'next' ? 4 : -4),
            h * 0.5,
            fxAvg + sSpan,
            h * 0.5
          );
          revealShadow.addColorStop(
            0,
            darkMode
              ? `rgba(0, 0, 0, ${0.26 * sheenFade})`
              : `rgba(40, 28, 12, ${0.11 * sheenFade})`
          );
          revealShadow.addColorStop(
            0.45,
            darkMode
              ? `rgba(0, 0, 0, ${0.08 * sheenFade})`
              : `rgba(40, 28, 12, ${0.035 * sheenFade})`
          );
          revealShadow.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = revealShadow;
          ctx.fillRect(0, 0, w, h);
        }
        ctx.restore();

        // In 1-page mode, fade the turning flap softly near the exit edge; in 2-page mode it lands cleanly onto newSnap
        const singleFade =
          !twoPage && rawT > 0.82 ? Math.max(0, 1 - (rawT - 0.82) / 0.18) : 1;

        if (singleFade > 0.01) {
          const shadowDx = dir === 'next' ? -1 : 1;

          // 3. Soft airborne drop shadow onto the old page beneath the lifted flap
          if (sheenFade > 0.01) {
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(fTop.x, fTop.y);
            ctx.quadraticCurveTo(
              topArchCtrl.x + shadowDx * 10,
              topArchCtrl.y + 6,
              tTop.x + shadowDx * 14,
              tTop.y + 10
            );
            ctx.quadraticCurveTo(
              outerCtrl.x + shadowDx * 18,
              outerCtrl.y + 12,
              tBot.x + shadowDx * 14,
              tBot.y + 12
            );
            ctx.quadraticCurveTo(
              botArchCtrl.x + shadowDx * 10,
              botArchCtrl.y + 6,
              fBot.x,
              fBot.y
            );
            ctx.quadraticCurveTo(foldCtrlX, foldMidY, fTop.x, fTop.y);
            ctx.closePath();

            const tipMidX = (tTop.x + tBot.x) * 0.5;
            const tipMidY = (tTop.y + tBot.y) * 0.5;
            const dropGrad = ctx.createLinearGradient(
              tipMidX + shadowDx * 18,
              tipMidY + 10,
              foldCtrlX,
              foldMidY
            );
            dropGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
            dropGrad.addColorStop(
              0.35,
              darkMode
                ? `rgba(0, 0, 0, ${0.2 * sheenFade * singleFade})`
                : `rgba(30, 20, 10, ${0.07 * sheenFade * singleFade})`
            );
            dropGrad.addColorStop(
              1,
              darkMode
                ? `rgba(0, 0, 0, ${0.32 * sheenFade * singleFade})`
                : `rgba(30, 20, 10, ${0.13 * sheenFade * singleFade})`
            );
            ctx.fillStyle = dropGrad;
            ctx.fill();
            ctx.restore();
          }

          // 4. Curved 3D Turning Page Sheet with captured page texture
          const traceTurningSheet = () => {
            ctx.beginPath();
            ctx.moveTo(fTop.x, fTop.y);
            ctx.quadraticCurveTo(topArchCtrl.x, topArchCtrl.y, tTop.x, tTop.y);
            ctx.quadraticCurveTo(outerCtrl.x, outerCtrl.y, tBot.x, tBot.y);
            ctx.quadraticCurveTo(botArchCtrl.x, botArchCtrl.y, fBot.x, fBot.y);
            ctx.quadraticCurveTo(foldCtrlX, foldMidY, fTop.x, fTop.y);
            ctx.closePath();
          };

          ctx.save();
          ctx.globalAlpha = singleFade;
          traceTurningSheet();
          ctx.fillStyle = sheetColor;
          ctx.fill();
          ctx.clip();

          // Strip-map the actual turning page image onto the curved sheet
          if (twoPage) {
            const halfW = w * 0.5;
            const strips = 22;
            const texAlpha = Math.min(1, 0.25 + p * 0.75);
            ctx.globalAlpha = singleFade * texAlpha;

            for (let i = 0; i < strips; i++) {
              const s0 = i / strips;
              const s1 = (i + 1) / strips;
              const top0 = quadPt(fTop, topArchCtrl, tTop, s0);
              const top1 = quadPt(fTop, topArchCtrl, tTop, s1);
              const bot0 = quadPt(fBot, botArchCtrl, tBot, s0);
              const bot1 = quadPt(fBot, botArchCtrl, tBot, s1);

              const dstX = Math.min(top0.x, top1.x, bot0.x, bot1.x);
              const dstMaxX = Math.max(top0.x, top1.x, bot0.x, bot1.x);
              const dstY = Math.min(top0.y, top1.y);
              const dstMaxY = Math.max(bot0.y, bot1.y);
              const dstW = dstMaxX - dstX;
              const dstH = dstMaxY - dstY;

              // Destination page half on newSnap: left half [0..halfW] for 'next', right half [halfW..w] for 'prev'
              const srcX =
                dir === 'next' ? halfW * (1 - s1) : halfW + halfW * s0;
              const srcW = halfW * (s1 - s0);

              if (dstW >= 0.35 && dstH >= 1 && srcW >= 0.35) {
                ctx.save();
                ctx.beginPath();
                ctx.moveTo(top0.x, top0.y);
                ctx.lineTo(top1.x, top1.y);
                ctx.lineTo(bot1.x, bot1.y);
                ctx.lineTo(bot0.x, bot0.y);
                ctx.closePath();
                ctx.clip();
                ctx.drawImage(
                  newSnap,
                  srcX * dpr,
                  0,
                  srcW * dpr,
                  h * dpr,
                  dstX - 0.5,
                  dstY,
                  dstW + 1,
                  dstH
                );
                ctx.restore();
              }
            }
          } else {
            // 1-page mode: back of paper carries a faint translucent bleed-through of oldSnap
            const strips = 16;
            ctx.globalAlpha = singleFade * 0.09;
            for (let i = 0; i < strips; i++) {
              const s0 = i / strips;
              const s1 = (i + 1) / strips;
              const top0 = quadPt(fTop, topArchCtrl, tTop, s0);
              const top1 = quadPt(fTop, topArchCtrl, tTop, s1);
              const bot0 = quadPt(fBot, botArchCtrl, tBot, s0);
              const bot1 = quadPt(fBot, botArchCtrl, tBot, s1);

              const dstX = Math.min(top0.x, top1.x, bot0.x, bot1.x);
              const dstMaxX = Math.max(top0.x, top1.x, bot0.x, bot1.x);
              const dstY = Math.min(top0.y, top1.y);
              const dstMaxY = Math.max(bot0.y, bot1.y);
              const dstW = dstMaxX - dstX;
              const dstH = dstMaxY - dstY;

              const srcX = dir === 'next' ? w * (1 - s1) : w * s0;
              const srcW = w * (s1 - s0);
              if (dstW >= 0.5 && dstH >= 1 && srcW >= 0.5) {
                ctx.drawImage(
                  oldSnap,
                  srcX * dpr,
                  0,
                  srcW * dpr,
                  h * dpr,
                  dstX - 0.4,
                  dstY,
                  dstW + 0.8,
                  dstH
                );
              }
            }
          }

          // Cylindrical highlight & bend shading smoothly settling to 0 on landing
          if (sheenFade > 0.01) {
            ctx.globalAlpha = singleFade * sheenFade * 0.78;
            const tipMidX = (tTop.x + tBot.x) * 0.5;
            const tipMidY = (tTop.y + tBot.y) * 0.5;
            const sheenGrad = ctx.createLinearGradient(tipMidX, tipMidY, foldCtrlX, foldMidY);
            sheenGrad.addColorStop(
              0,
              darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.08)'
            );
            sheenGrad.addColorStop(
              0.38,
              darkMode ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.38)'
            );
            sheenGrad.addColorStop(0.76, 'rgba(0,0,0,0)');
            sheenGrad.addColorStop(
              1,
              darkMode ? 'rgba(0,0,0,0.28)' : 'rgba(60,42,20,0.12)'
            );
            ctx.fillStyle = sheenGrad;
            ctx.fillRect(0, 0, w, h);
          }
          ctx.restore();

          // Delicate paper edge stroke while airborne
          if (sheenFade > 0.01) {
            ctx.save();
            ctx.globalAlpha = singleFade * sheenFade * 0.85;
            traceTurningSheet();
            ctx.strokeStyle = darkMode
              ? 'rgba(255,255,255,0.14)'
              : 'rgba(110,85,55,0.16)';
            ctx.lineWidth = 0.9;
            ctx.stroke();
            ctx.restore();
          }

          // Subtle spine gutter shadow in 2-page spread
          if (twoPage && sheenFade > 0.01) {
            ctx.save();
            ctx.globalAlpha = sheenFade * 0.8;
            const spineGrad = ctx.createLinearGradient(w * 0.5 - 12, 0, w * 0.5 + 12, 0);
            spineGrad.addColorStop(0, 'rgba(0,0,0,0)');
            spineGrad.addColorStop(
              0.5,
              darkMode ? 'rgba(0,0,0,0.28)' : 'rgba(60,42,20,0.11)'
            );
            spineGrad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = spineGrad;
            ctx.fillRect(w * 0.5 - 12, 0, 24, h);
            ctx.restore();
          }
        }
      }

      if (rawT < 1) {
        rafId = window.requestAnimationFrame(drawFrame);
      } else {
        // Keep the landed newSnap painted cleanly through unmount so SpreadCanvas takes over seamlessly
        ctx.drawImage(newSnap, 0, 0, w, h);
        onCompleteRef.current();
      }
    };

    // Paint initial frame synchronously so the canvas matches oldSnap without a 1-frame flash
    drawFrame(performance.now());
    rafId = window.requestAnimationFrame(drawFrame);

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [animKey]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-25 h-full w-full"
    />
  );
};

export const ReaderView: React.FC<ReaderViewProps> = ({
  book,
  settings,
  showHud,
  quickMenuOpen,
  quickMenuIndex,
  tocOpen,
  tocTab,
  tocIndex,
  zoomLevel,
  panOffset,
  turnAnimKey,
  turnDirection,
  turnFromPage,
  clockText,
  batteryInfo = { level: 88, charging: true },
  toastText,
  onToggleHud,
  onRotateScreen,
  onTurnPage,
  onJumpToPage,
  onToggleBookmark,
  onRemoveBookmark,
  onToggleTwoPage,
  onToggleQuickMenu,
  onToggleToc,
  onChangeTocTab,
  onUpdateSettings,
  onToggleZoom,
  onCloseBook,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const tocScrollRef = useRef<HTMLDivElement | null>(null);
  const tocItemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [boxSize, setBoxSize] = useState({ width: 860, height: 484 });
  const [completedAnimKey, setCompletedAnimKey] = useState(0);
  const [tocScrollBar, setTocScrollBar] = useState<{ topPct: number; heightPct: number }>({
    topPct: 0,
    heightPct: 100,
  });

  const chaptersList = useMemo(() => getBookChapters(book), [book]);
  const activeChapterInfo = useMemo(() => getCurrentChapterInfo(book), [book]);
  const bookmarksList = useMemo(
    () =>
      [...book.bookmarks]
        .sort((a, b) => a - b)
        .map((pageIdx) => {
          const p = book.pages[pageIdx];
          const snippet =
            p?.heading ||
            p?.paragraphs?.[0] ||
            p?.comicScene?.caption ||
            p?.comicScene?.panelTitle ||
            `Trang ${pageIdx + 1}/${book.totalPages}`;
          return {
            pageIdx,
            chapter: p?.chapter || `Trang ${pageIdx + 1}`,
            snippet,
            pct: Math.round(((pageIdx + 1) / Math.max(1, book.totalPages)) * 100),
          };
        }),
    [book.bookmarks, book.pages, book.totalPages]
  );

  const syncTocScrollBar = useCallback(() => {
    const el = tocScrollRef.current;
    if (!el || el.scrollHeight <= el.clientHeight + 2) {
      setTocScrollBar({ topPct: 0, heightPct: 100 });
      return;
    }
    const heightPct = Math.max(16, Math.round((el.clientHeight / el.scrollHeight) * 100));
    const maxTop = 100 - heightPct;
    const progress = el.scrollTop / Math.max(1, el.scrollHeight - el.clientHeight);
    setTocScrollBar({
      topPct: Math.max(0, Math.min(maxTop, progress * maxTop)),
      heightPct,
    });
  }, []);

  useEffect(() => {
    if (!tocOpen) return;
    const activeEl = tocItemRefs.current[tocIndex];
    activeEl?.scrollIntoView({ block: 'nearest' });
    const raf = window.requestAnimationFrame(syncTocScrollBar);
    return () => window.cancelAnimationFrame(raf);
  }, [tocOpen, tocTab, tocIndex, chaptersList.length, bookmarksList.length, syncTocScrollBar]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setBoxSize({ width: rect.width, height: rect.height });
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const isPortrait = settings.rotation === 90 || settings.rotation === 270;
  const virtualWidth = isPortrait ? boxSize.height : boxSize.width;
  const virtualHeight = isPortrait ? boxSize.width : boxSize.height;

  const theme = THEME_STYLES[settings.readerTheme];
  const currentPageIdx = Math.min(book.currentPage, Math.max(0, book.pages.length - 1));
  const safeFromPageIdx = Math.min(turnFromPage, Math.max(0, book.pages.length - 1));
  const curlActive =
    turnAnimKey > 0 &&
    settings.pageTurnMode === 'curl' &&
    completedAnimKey !== turnAnimKey &&
    safeFromPageIdx !== currentPageIdx;
  const pageData = book.pages[currentPageIdx] || book.pages[0] || {
    chapter: book.title,
    paragraphs: ['Đang mở sách...'],
  };
  const nextPageData = book.pages[currentPageIdx + 1];
  const isComic = Boolean(pageData?.comicScene || (pageData?.imageUrl && book.format === 'CBZ'));
  const isBookmarked = book.bookmarks.includes(book.currentPage);
  const progressPct = Math.round(((book.currentPage + 1) / Math.max(1, book.totalPages)) * 100);

  const getAnimClass = () => {
    if (turnAnimKey === 0) return '';
    if (settings.pageTurnMode === 'fade') return 'animate-page-fade';
    if (settings.pageTurnMode === 'slide') {
      return turnDirection === 'next' ? 'animate-page-slide-next' : 'animate-page-slide-prev';
    }
    return '';
  };

  const brightness = Math.max(20, Math.min(100, settings.brightness ?? 100));
  const dimOpacity = Number((((100 - brightness) / 100) * 0.82).toFixed(3));

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden select-none"
      style={{ backgroundColor: isComic ? '#090b10' : theme.bg }}
    >
      {/* VIRTUAL ROTATED VIEWPORT */}
      <div
        className="absolute top-1/2 left-1/2 overflow-hidden transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{
          width: virtualWidth,
          height: virtualHeight,
          transform: `translate(-50%, -50%) rotate(${settings.rotation}deg)`,
          backgroundColor: isComic ? '#090b10' : theme.bg,
        }}
      >
        {/* IN-APP BRIGHTNESS DIMMING OVERLAY */}
        {brightness < 100 && (
          <div
            className="pointer-events-none absolute inset-0 z-40 transition-opacity duration-150"
            style={{ backgroundColor: `rgba(0, 0, 0, ${dimOpacity})` }}
          />
        )}

        {/* BLUE LIGHT / WARMTH SHADER FILTER */}
        {settings.warmth > 0 && (
          <div
            className="pointer-events-none absolute inset-0 z-40 transition-opacity duration-200"
            style={{
              backgroundColor: `rgba(255, 148, 38, ${settings.warmth * 0.0042})`,
              mixBlendMode: 'multiply',
            }}
          />
        )}

        {/* OSD TOAST */}
        {toastText && (
          <div className="pointer-events-none absolute top-12 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-slate-950/62 px-3.5 py-1.5 font-mono-hud text-[11px] text-sky-100 ring-1 ring-sky-400/35 backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.45)] animate-toast-in whitespace-nowrap">
            {toastText}
          </div>
        )}

        {/* BOOK READING AREA — Auto-fits remaining space when Select HUD opens; supports Zoom + Pan */}
        <div
          className="absolute inset-x-0 overflow-hidden transition-all duration-250 ease-[cubic-bezier(0.16,1,0.3,1)]"
          style={{
            top: showHud ? 40 : 0,
            bottom: showHud ? 44 : 0,
          }}
        >
          <div
            className="h-full w-full transition-transform duration-150 ease-out"
            style={{
              transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
              transformOrigin: 'center center',
            }}
          >
            <div
              key={
                settings.pageTurnMode === 'fade' || settings.pageTurnMode === 'slide'
                  ? turnAnimKey
                  : 'static-page-container'
              }
              className={`relative h-full w-full overflow-hidden ${getAnimClass()}`}
              style={{
                backgroundColor: isComic ? '#090b10' : theme.pageBg,
              }}
            >
              {/* Unified Snapshot-based Page Spread (pixel-identical to 3D curl animation) */}
              <div className="relative h-full w-full">
                <SpreadCanvas
                  book={book}
                  pageIdx={currentPageIdx}
                  settings={settings}
                  theme={theme}
                  isPortrait={isPortrait}
                  showHud={showHud}
                  isComic={isComic}
                />
              </div>

              {/* Smooth 60fps 3D Page Curl Canvas driven by captured old/new page snapshots */}
              {curlActive && (
                <PageCurlCanvas
                  animKey={turnAnimKey}
                  direction={turnDirection}
                  isTwoPageSpread={Boolean(
                    settings.twoPageSpread &&
                      (nextPageData || book.pages[safeFromPageIdx + 1]) &&
                      !isPortrait
                  )}
                  paperColor={isComic ? '#131822' : theme.pageBg}
                  isDark={
                    isComic ||
                    settings.readerTheme === 'slate' ||
                    settings.readerTheme === 'midnight'
                  }
                  book={book}
                  fromPageIdx={safeFromPageIdx}
                  toPageIdx={currentPageIdx}
                  settings={settings}
                  theme={theme}
                  isPortrait={isPortrait}
                  showHud={showHud}
                  isComic={isComic}
                  onComplete={() => setCompletedAnimKey(turnAnimKey)}
                />
              )}

              {/* Animated Bookmark Silk Ribbon */}
              {isBookmarked && (
                <div className="pointer-events-none absolute top-0 right-5 z-20 flex flex-col items-center">
                  <div className="h-8 w-4 bg-gradient-to-b from-rose-600 to-rose-700 shadow-md" />
                  <div className="h-0 w-0 border-x-[8px] border-t-[6px] border-x-transparent border-t-rose-700" />
                </div>
              )}

              {/* Clickable Left / Right page turn edges */}
              <button
                type="button"
                onClick={() => onTurnPage('prev')}
                aria-label="Trang trước"
                className="absolute inset-y-0 left-0 z-10 flex w-[14%] cursor-pointer items-center justify-start pl-2 opacity-0 hover:opacity-100 transition-opacity"
              >
                <span className="rounded-full bg-black/35 p-1.5 text-white/85 backdrop-blur-xs">
                  <ChevronLeft className="h-4 w-4" />
                </span>
              </button>
              <button
                type="button"
                onClick={() => onTurnPage('next')}
                aria-label="Trang sau"
                className="absolute inset-y-0 right-0 z-10 flex w-[14%] cursor-pointer items-center justify-end pr-2 opacity-0 hover:opacity-100 transition-opacity"
              >
                <span className="rounded-full bg-black/35 p-1.5 text-white/85 backdrop-blur-xs">
                  <ChevronRight className="h-4 w-4" />
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* TOP STATUS BAR */}
        <div
          className={`absolute inset-x-0 top-0 z-30 flex h-10 items-center justify-between gap-2 bg-slate-950/90 px-3 text-xs text-slate-200 backdrop-blur-md border-b border-white/10 transition-all duration-250 ${
            showHud ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0 pointer-events-none'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={onCloseBook}
              title="Về Thư viện [B]"
              className="flex items-center gap-1 rounded bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-white/20 transition-colors shrink-0"
            >
              <strong className="font-mono-hud text-slate-200">[B]</strong>
              <Library className="h-3 w-3 text-sky-300" />
            </button>
            <span className="truncate font-semibold text-white">{book.title}</span>
            <span className="shrink-0 font-mono-hud text-[9.5px] font-medium text-slate-400/70">
              {book.format}
            </span>
            {!isPortrait && (
              <>
                <span className="text-slate-500">·</span>
                <span className="truncate text-slate-300">{pageData.chapter}</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0 font-mono-hud text-[10px]">
            <button
              type="button"
              onClick={onRotateScreen}
              className="flex items-center gap-1 rounded bg-white/10 px-1.5 py-0.5 text-amber-300 hover:bg-white/20"
              title="Xoay 90° (Phím A)"
            >
              <RotateCw className="h-3 w-3" />
              <span>[A] {settings.rotation}°</span>
            </button>
            <button
              type="button"
              onClick={onToggleTwoPage}
              title="Đổi bố cục 1 trang / 2 trang [X]"
              className={`flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors ${
                settings.twoPageSpread
                  ? 'text-emerald-300 bg-emerald-500/15'
                  : 'text-slate-300 hover:bg-white/10'
              }`}
            >
              <BookOpen className="h-3 w-3" />
              <span>[X] {settings.twoPageSpread ? '2P' : '1P'}</span>
            </button>
            <button
              type="button"
              onClick={onToggleBookmark}
              title="Đánh dấu trang [L2+R2]"
              className={`flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors ${
                isBookmarked ? 'text-rose-400 bg-rose-500/15' : 'text-slate-300 hover:bg-white/10'
              }`}
            >
              <Bookmark className="h-3 w-3" />
              <span>[L2+R2]</span>
            </button>
            <span className="text-slate-200">{clockText}</span>
            <BatteryBadge level={batteryInfo.level} charging={batteryInfo.charging} />
          </div>
        </div>

        {/* BOTTOM STATUS BAR */}
        <div
          className={`absolute inset-x-0 bottom-0 z-30 flex h-11 items-center justify-between gap-2.5 bg-slate-950/92 px-3 text-[10.5px] text-slate-300 backdrop-blur-md border-t border-white/10 transition-all duration-250 ${
            showHud ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'
          }`}
        >
          <div className="flex items-center gap-1.5 font-mono-hud shrink-0">
            <span>
              <strong className="text-white">{book.currentPage + 1}</strong>/{book.totalPages}
            </span>
            <span className="text-sky-300">({progressPct}%)</span>
          </div>

          <input
            type="range"
            min={0}
            max={Math.max(0, book.totalPages - 1)}
            value={book.currentPage}
            onChange={(e) => onJumpToPage(Number(e.target.value))}
            className="h-1.5 min-w-[60px] flex-1 cursor-pointer accent-sky-400"
            aria-label="Thanh tiến độ trang"
          />

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onToggleZoom}
              className="flex items-center gap-1 rounded bg-white/8 px-1.5 py-0.5 hover:bg-white/15 transition-colors"
              title="Phóng to 100-300% [R3]"
            >
              <strong className="font-mono-hud text-slate-200">[R3]</strong>
              <ZoomIn className="h-3 w-3 text-sky-300" />
              {zoomLevel > 1 && (
                <span className="font-mono-hud text-[9.5px] text-sky-200">
                  {Math.round(zoomLevel * 100)}%
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={onToggleToc}
              title="Mục lục & Chọn chương [Y]"
              className="flex items-center gap-1 rounded bg-white/8 px-1.5 py-0.5 hover:bg-white/15 transition-colors"
            >
              <strong className="font-mono-hud text-slate-200">[Y]</strong>
              <List className="h-3 w-3 text-emerald-300" />
            </button>
            <button
              type="button"
              onClick={onToggleQuickMenu}
              title="Tùy chỉnh giao diện [Start]"
              className="flex items-center gap-1 rounded bg-white/8 px-1.5 py-0.5 hover:bg-white/15 transition-colors"
            >
              <strong className="font-mono-hud text-slate-200">[Start]</strong>
              <SlidersHorizontal className="h-3 w-3 text-amber-300" />
            </button>
            <button
              type="button"
              onClick={onToggleHud}
              title="Ẩn thanh trạng thái [Select]"
              className="flex items-center gap-1 rounded bg-sky-500/20 px-1.5 py-0.5 text-sky-200 ring-1 ring-sky-400/40 hover:bg-sky-500/30 transition-colors"
            >
              <strong className="font-mono-hud">[Select]</strong>
              <EyeOff className="h-3 w-3 text-sky-300" />
            </button>
          </div>
        </div>

        {/* QUICK SETTINGS DRAWER ([Start] BUTTON) */}
        {quickMenuOpen && (
          <div className="animate-backdrop-in absolute inset-0 z-50 flex items-center justify-center bg-black/58 p-3 backdrop-blur-xs">
            <div className="animate-modal-pop w-full max-w-[440px] rounded-xl border border-white/15 bg-[#10141d]/96 p-3.5 text-slate-100 shadow-2xl">
              <div className="mb-2.5 flex items-center justify-between border-b border-white/10 pb-2">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4 text-amber-300" />
                  <h3 className="text-xs font-semibold text-white">Tùy chỉnh Nhanh</h3>
                </div>
                <span className="font-mono-hud text-[9.5px] text-slate-400">
                  [▲▼] Chọn · [◀▶] Đổi · [B] Đóng
                </span>
              </div>

              <div className="space-y-1.5 text-[11px]">
                <div
                  className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 transition-all duration-150 ${
                    quickMenuIndex === 0 ? 'bg-sky-500/18 ring-1 ring-sky-400/50' : 'bg-white/4'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Palette className="h-3.5 w-3.5 text-rose-300" />
                    <span className="font-medium text-slate-200">Màu nền</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {(Object.keys(THEME_STYLES) as ReaderTheme[]).map((tKey) => (
                      <button
                        key={tKey}
                        type="button"
                        onClick={() => onUpdateSettings({ readerTheme: tKey })}
                        title={THEME_STYLES[tKey].name}
                        className={`h-4 w-4 rounded-full border transition-transform ${
                          settings.readerTheme === tKey
                            ? 'scale-115 border-sky-400 ring-2 ring-sky-400/40'
                            : 'border-white/25'
                        }`}
                        style={{ backgroundColor: THEME_STYLES[tKey].pageBg }}
                      />
                    ))}
                    <span className="ml-1 w-14 text-right text-[10px] text-sky-300">
                      {theme.name}
                    </span>
                  </div>
                </div>

                <div
                  className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 transition-all duration-150 ${
                    quickMenuIndex === 1 ? 'bg-sky-500/18 ring-1 ring-sky-400/50' : 'bg-white/4'
                  }`}
                >
                  <div className="flex items-center gap-1.5 shrink-0">
                    <BookCopy className="h-3.5 w-3.5 text-emerald-300" />
                    <span className="font-medium text-slate-200">Lật trang</span>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1">
                    {PAGE_TURN_LABELS.map((pt) => (
                      <button
                        key={pt.id}
                        type="button"
                        onClick={() => onUpdateSettings({ pageTurnMode: pt.id })}
                        className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                          settings.pageTurnMode === pt.id
                            ? 'bg-sky-500 text-slate-950 font-semibold'
                            : 'bg-white/8 text-slate-300 hover:bg-white/15'
                        }`}
                      >
                        {pt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div
                  className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 transition-all duration-150 ${
                    quickMenuIndex === 2 ? 'bg-sky-500/18 ring-1 ring-sky-400/50' : 'bg-white/4'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Type className="h-3.5 w-3.5 text-indigo-300" />
                    <span className="font-medium text-slate-200">Cỡ chữ</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateSettings({ fontSize: Math.max(13, settings.fontSize - 1) })
                      }
                      className="rounded bg-white/10 px-2 py-0.5 hover:bg-white/20"
                    >
                      A-
                    </button>
                    <span className="font-mono-hud w-7 text-center text-sky-300">
                      {settings.fontSize}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateSettings({ fontSize: Math.min(24, settings.fontSize + 1) })
                      }
                      className="rounded bg-white/10 px-2 py-0.5 hover:bg-white/20"
                    >
                      A+
                    </button>
                  </div>
                </div>

                {/* Row 3: Brightness (directly above Warmth) */}
                <div
                  className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 transition-all duration-150 ${
                    quickMenuIndex === 3 ? 'bg-sky-500/18 ring-1 ring-sky-400/50' : 'bg-white/4'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Sun className="h-3.5 w-3.5 text-sky-300" />
                    <span className="font-medium text-slate-200">Độ sáng</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={20}
                      max={100}
                      step={5}
                      value={brightness}
                      onChange={(e) => onUpdateSettings({ brightness: Number(e.target.value) })}
                      className="w-24 accent-sky-400"
                    />
                    <span className="font-mono-hud w-8 text-right text-sky-300">
                      {brightness}%
                    </span>
                  </div>
                </div>

                {/* Row 4: Warmth */}
                <div
                  className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 transition-all duration-150 ${
                    quickMenuIndex === 4 ? 'bg-sky-500/18 ring-1 ring-sky-400/50' : 'bg-white/4'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Sunset className="h-3.5 w-3.5 text-amber-300" />
                    <span className="font-medium text-slate-200">Ánh sáng ấm</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={65}
                      step={5}
                      value={settings.warmth}
                      onChange={(e) => onUpdateSettings({ warmth: Number(e.target.value) })}
                      className="w-24 accent-amber-400"
                    />
                    <span className="font-mono-hud w-8 text-right text-amber-300">
                      {settings.warmth}%
                    </span>
                  </div>
                </div>

                {/* Row 5: Layout */}
                <div
                  className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 transition-all duration-150 ${
                    quickMenuIndex === 5 ? 'bg-sky-500/18 ring-1 ring-sky-400/50' : 'bg-white/4'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Columns2 className="h-3.5 w-3.5 text-emerald-300" />
                    <span className="font-medium text-slate-200">Bố cục</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateSettings({ twoPageSpread: !settings.twoPageSpread })
                      }
                      className={`flex items-center gap-1 rounded px-2 py-0.5 text-[10px] ${
                        settings.twoPageSpread
                          ? 'bg-emerald-500/25 text-emerald-200 ring-1 ring-emerald-400/40'
                          : 'bg-white/8 text-slate-300'
                      }`}
                    >
                      <BookOpen className="h-3 w-3" />
                      <span>{settings.twoPageSpread ? '2 Trang' : '1 Trang'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={onRotateScreen}
                      className="flex items-center gap-1 rounded bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-200 ring-1 ring-amber-400/40"
                    >
                      <RotateCw className="h-3 w-3" />
                      <span>Xoay {settings.rotation}°</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TABLE OF CONTENTS & BOOKMARKS MODAL ([Y] BUTTON — SEPARATE TABS) */}
        {tocOpen && (
          <div className="animate-backdrop-in absolute inset-0 z-50 flex items-center justify-center bg-black/62 p-3 backdrop-blur-xs">
            <div className="animate-modal-pop flex max-h-[86%] w-full max-w-[448px] flex-col rounded-xl border border-white/15 bg-[#10141d]/96 p-3.5 text-slate-100 shadow-2xl">
              {/* Tab Bar Header (Moon+ Reader style: Chương | Đánh dấu trang) */}
              <div className="mb-2.5 flex items-center justify-between gap-2 border-b border-white/10 pb-2 shrink-0">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onChangeTocTab('chapters')}
                    className={`inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-medium whitespace-nowrap transition-colors ${
                      tocTab === 'chapters'
                        ? 'bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400/45'
                        : 'text-slate-400 ring-1 ring-transparent hover:bg-white/6 hover:text-white'
                    }`}
                  >
                    <List className="h-3.5 w-3.5 shrink-0" />
                    <span>Chương ({chaptersList.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onChangeTocTab('bookmarks')}
                    className={`inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-medium whitespace-nowrap transition-colors ${
                      tocTab === 'bookmarks'
                        ? 'bg-rose-500/20 text-rose-200 ring-1 ring-rose-400/45'
                        : 'text-slate-400 ring-1 ring-transparent hover:bg-white/6 hover:text-white'
                    }`}
                  >
                    <Bookmark className="h-3.5 w-3.5 shrink-0" />
                    <span>Đánh dấu trang ({bookmarksList.length})</span>
                  </button>
                </div>

                <span className="font-mono-hud text-[9.5px] text-slate-400 whitespace-nowrap">
                  [◀▶] Tab · [A] Tới · [B] Đóng
                </span>
              </div>

              {/* Scrollable List */}
              <div className="relative min-h-0 flex-1">
                <div
                  ref={tocScrollRef}
                  onScroll={syncTocScrollBar}
                  className="no-scrollbar max-h-60 space-y-1.5 overflow-y-auto pr-2.5"
                >
                  {tocTab === 'chapters' ? (
                    chaptersList.map((chap, idx) => {
                      const selected = idx === tocIndex;
                      const isCurrentChapter = idx === activeChapterInfo.chapterIdx;
                      return (
                        <div
                          key={`${chap.pageIdx}-${chap.title}`}
                          ref={(el) => {
                            tocItemRefs.current[idx] = el;
                          }}
                          onClick={() => {
                            onJumpToPage(chap.pageIdx);
                            onToggleToc();
                          }}
                          className={`flex w-full cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 text-left text-[11px] transition-colors ${
                            selected
                              ? 'bg-sky-500/22 text-white ring-1 ring-sky-400/55'
                              : isCurrentChapter
                                ? 'bg-emerald-500/10 text-emerald-100 ring-1 ring-emerald-400/25'
                                : 'bg-white/4 text-slate-300 hover:bg-white/8'
                          }`}
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-1.5 pr-3">
                            <span className="truncate font-medium">{chap.title}</span>
                            {isCurrentChapter && (
                              <Check className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
                            )}
                          </div>
                          <span className="shrink-0 font-mono-hud text-[10.5px] text-slate-400">
                            {chap.pageIdx + 1}
                          </span>
                        </div>
                      );
                    })
                  ) : bookmarksList.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-lg bg-white/4 px-4 py-8 text-center">
                      <Bookmark className="mb-2 h-6 w-6 text-slate-500" />
                      <p className="text-xs font-medium text-slate-300">
                        Chưa có đánh dấu trang nào
                      </p>
                      <p className="mt-1 text-[10.5px] text-slate-400">
                        Khi đang đọc, bấm đồng thời <strong className="font-mono-hud text-slate-200">[L2+R2]</strong> để đánh dấu trang hiện tại.
                      </p>
                    </div>
                  ) : (
                    bookmarksList.map((bm, idx) => {
                      const selected = idx === tocIndex;
                      return (
                        <div
                          key={bm.pageIdx}
                          ref={(el) => {
                            tocItemRefs.current[idx] = el;
                          }}
                          onClick={() => {
                            onJumpToPage(bm.pageIdx);
                            onToggleToc();
                          }}
                          className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] transition-colors ${
                            selected
                              ? 'bg-rose-500/20 text-white ring-1 ring-rose-400/55'
                              : 'bg-white/4 text-slate-300 hover:bg-white/8'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <Bookmark className="h-3 w-3 shrink-0 fill-rose-400 text-rose-400" />
                              <span className="truncate font-medium text-white">
                                {bm.chapter}
                              </span>
                            </div>
                            <div className="mt-0.5 truncate pl-4.5 text-[10px] text-slate-400">
                              {bm.snippet}
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-2">
                            <span className="font-mono-hud text-[10px] text-slate-300">
                              Tr.{bm.pageIdx + 1} ({bm.pct}%)
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onRemoveBookmark(bm.pageIdx);
                              }}
                              title="Xóa đánh dấu [X]"
                              className="rounded p-1 text-slate-400 hover:bg-rose-500/25 hover:text-rose-200"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {tocScrollBar.heightPct < 100 && (
                  <div className="pointer-events-none absolute top-1 bottom-1 right-0.5 w-[2.5px] rounded-full bg-white/8">
                    <div
                      className="absolute inset-x-0 rounded-full bg-white/35 transition-[top] duration-100 ease-out"
                      style={{
                        top: `${tocScrollBar.topPct}%`,
                        height: `${tocScrollBar.heightPct}%`,
                      }}
                    />
                  </div>
                )}
              </div>

              {tocTab === 'bookmarks' && bookmarksList.length > 0 && (
                <div className="mt-2 flex items-center justify-end border-t border-white/10 pt-1.5 font-mono-hud text-[9.5px] text-slate-400">
                  <span>[X] Xóa đánh dấu đang chọn</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
