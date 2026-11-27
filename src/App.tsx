import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LogOut, Power } from 'lucide-react';
import { BookCover } from './components/BookCover';
import { BookInfoModal } from './components/BookInfoModal';
import { HandheldButton, HandheldShell } from './components/HandheldShell';
import { LibraryStage } from './components/LibraryStage';
import { ReaderView, TocTab } from './components/ReaderView';
import { KEYBOARD_ROWS, SearchModal } from './components/SearchModal';
import { GuideSubTab, SettingsModal, SettingsTab } from './components/SettingsModal';
import {
  AppSettings,
  BookItem,
  FOLDER_TABS,
  FolderId,
  INITIAL_BOOKS,
  INITIAL_SETTINGS,
  LIBRARY_SORT_MODES,
  LIBRARY_VIEW_MODES,
  LibraryViewMode,
  PageTurnMode,
  ReaderTheme,
  ScreenRotation,
} from './data/books';
import { getBookChapters, getCurrentChapterInfo } from './utils/bookStats';
import {
  closePdfDocument,
  extractPdfMetaAndThumb,
  openPdfDocument,
  renderPdfPageUrl,
} from './utils/pdfClient';
import { matchesBookSearch } from './utils/search';
import { sfx } from './utils/sfx';

const READER_THEMES: ReaderTheme[] = ['sepia', 'paper', 'slate', 'midnight', 'matcha'];
const PAGE_TURN_MODES: PageTurnMode[] = ['curl', 'fade', 'slide', 'instant'];
const ROTATIONS: ScreenRotation[] = [0, 90, 180, 270];
const ZOOM_LEVELS: number[] = [1, 1.25, 1.5, 2, 3];
const STORAGE_KEY = 'x55_cozyread_state_v1';

interface PersistedBookState {
  currentPage: number;
  hasOpened?: boolean;
  lastOpenedAt?: number;
  readingSeconds?: number;
  favorite: boolean;
  bookmarks: number[];
}

interface PersistedAppState {
  settings?: Partial<AppSettings>;
  activeFolder?: FolderId;
  viewMode?: LibraryViewMode;
  selectedIndex?: number;
  selectedBookId?: string | null;
  activeBookId?: string | null;
  sphereTilt?: number;
  showReaderHud?: boolean;
  books?: Record<string, PersistedBookState>;
}

function loadPersistedState(): PersistedAppState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as PersistedAppState;
  } catch {
    return {};
  }
}

function getPanBounds(zoom: number, rotation: ScreenRotation) {
  const isPortrait = rotation === 90 || rotation === 270;
  const baseW = isPortrait ? 460 : 780;
  const baseH = isPortrait ? 780 : 460;
  return {
    maxX: Math.max(0, Math.round(((zoom - 1) / 2) * baseW)),
    maxY: Math.max(0, Math.round(((zoom - 1) / 2) * baseH)),
  };
}

// Reading-screen D-Pad remapping aligned with visual book orientation on screen
function remapReaderDirection(btn: HandheldButton, rotation: ScreenRotation): HandheldButton {
  if (rotation === 0) return btn;
  if (rotation === 90) {
    if (btn === 'UP') return 'LEFT';
    if (btn === 'DOWN') return 'RIGHT';
    if (btn === 'LEFT') return 'DOWN';
    if (btn === 'RIGHT') return 'UP';
  }
  if (rotation === 180) {
    if (btn === 'UP') return 'DOWN';
    if (btn === 'DOWN') return 'UP';
    if (btn === 'LEFT') return 'RIGHT';
    if (btn === 'RIGHT') return 'LEFT';
  }
  if (rotation === 270) {
    if (btn === 'UP') return 'RIGHT';
    if (btn === 'DOWN') return 'LEFT';
    if (btn === 'LEFT') return 'UP';
    if (btn === 'RIGHT') return 'DOWN';
  }
  return btn;
}

// Visual screen-space inverse of CSS rotate(deg) for Quick Menu & TOC navigation
function remapMenuDirection(btn: HandheldButton, rotation: ScreenRotation): HandheldButton {
  if (rotation === 0) return btn;
  if (rotation === 90) {
    if (btn === 'LEFT') return 'DOWN';
    if (btn === 'RIGHT') return 'UP';
    if (btn === 'UP') return 'LEFT';
    if (btn === 'DOWN') return 'RIGHT';
  }
  if (rotation === 180) {
    if (btn === 'UP') return 'DOWN';
    if (btn === 'DOWN') return 'UP';
    if (btn === 'LEFT') return 'RIGHT';
    if (btn === 'RIGHT') return 'LEFT';
  }
  if (rotation === 270) {
    if (btn === 'RIGHT') return 'DOWN';
    if (btn === 'LEFT') return 'UP';
    if (btn === 'UP') return 'RIGHT';
    if (btn === 'DOWN') return 'LEFT';
  }
  return btn;
}

export default function App() {
  const isNative = Boolean(typeof window !== 'undefined' && window.rocknixNative?.isNative);
  const initialPersisted = useMemo(() => (isNative ? {} : loadPersistedState()), [isNative]);

  const [folderTabs, setFolderTabs] = useState<{ id: FolderId; label: string }[]>(FOLDER_TABS);
  const [batteryInfo, setBatteryInfo] = useState<{ level: number; charging: boolean }>({
    level: 88,
    charging: false,
  });

  const [books, setBooks] = useState<BookItem[]>(() => {
    if (isNative) return [];
    const savedBooks = initialPersisted.books;
    if (!savedBooks) return INITIAL_BOOKS;
    return INITIAL_BOOKS.map((book) => {
      const saved = savedBooks[book.id];
      if (!saved) return book;
      const page = Math.max(0, Math.min(book.totalPages - 1, saved.currentPage ?? book.currentPage));
      return {
        ...book,
        currentPage: page,
        hasOpened: Boolean(saved.hasOpened ?? (page > 0 || book.hasOpened)),
        lastOpenedAt: typeof saved.lastOpenedAt === 'number' ? saved.lastOpenedAt : book.lastOpenedAt,
        readingSeconds:
          typeof saved.readingSeconds === 'number'
            ? Math.max(0, saved.readingSeconds)
            : book.readingSeconds ?? 0,
        favorite: typeof saved.favorite === 'boolean' ? saved.favorite : book.favorite,
        bookmarks: Array.isArray(saved.bookmarks)
          ? saved.bookmarks.filter((p) => p >= 0 && p < book.totalPages)
          : book.bookmarks,
      };
    });
  });

  const [settings, setSettings] = useState<AppSettings>(() => ({
    ...INITIAL_SETTINGS,
    ...(initialPersisted.settings ?? {}),
    brightness:
      typeof initialPersisted.settings?.brightness === 'number'
        ? initialPersisted.settings.brightness
        : INITIAL_SETTINGS.brightness,
  }));

  const [activeFolder, setActiveFolder] = useState<FolderId>(() => {
    const saved = initialPersisted.activeFolder;
    return FOLDER_TABS.some((t) => t.id === saved) ? (saved as FolderId) : 'all';
  });

  const [viewMode, setViewMode] = useState<LibraryViewMode>(() => {
    const saved = initialPersisted.viewMode;
    return LIBRARY_VIEW_MODES.some((m) => m.id === saved) ? (saved as LibraryViewMode) : 'coverflow';
  });

  const [selectedIndex, setSelectedIndex] = useState<number>(() =>
    typeof initialPersisted.selectedIndex === 'number' && initialPersisted.selectedIndex >= 0
      ? initialPersisted.selectedIndex
      : 0
  );
  const [sphereTilt, setSphereTilt] = useState<number>(() =>
    !isNative && typeof initialPersisted.sphereTilt === 'number'
      ? initialPersisted.sphereTilt
      : 0
  );

  // Screen & Modal States
  const [activeBookId, setActiveBookId] = useState<string | null>(() => {
    if (isNative) return null;
    const savedId = initialPersisted.activeBookId;
    if (!savedId) return null;
    return INITIAL_BOOKS.some((b) => b.id === savedId) ? savedId : null;
  });
  const [infoBookId, setInfoBookId] = useState<string | null>(null);
  const [infoScrollSignal, setInfoScrollSignal] = useState<{ dir: -1 | 1; seq: number }>({
    dir: 1,
    seq: 0,
  });
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('general');
  const [guideSubTab, setGuideSubTab] = useState<GuideSubTab>('keys');
  const [guideScrollSignal, setGuideScrollSignal] = useState<{ dir: -1 | 1; seq: number }>({
    dir: 1,
    seq: 0,
  });
  const [settingsRow, setSettingsRow] = useState<number>(0);
  const [isRescanning, setIsRescanning] = useState<boolean>(false);
  const [rescanStatus, setRescanStatus] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResultIdx, setSearchResultIdx] = useState<number>(0);
  const [searchKeyRow, setSearchKeyRow] = useState<number>(1);
  const [searchKeyCol, setSearchKeyCol] = useState<number>(0);
  const [exitConfirmOpen, setExitConfirmOpen] = useState<boolean>(false);
  const [exitedToRocknix, setExitedToRocknix] = useState<boolean>(false);
  const [openingAnim, setOpeningAnim] = useState<{ book: BookItem; key: number } | null>(null);

  // Reader States
  const [showReaderHud, setShowReaderHud] = useState<boolean>(() =>
    Boolean(!isNative && initialPersisted.showReaderHud)
  );
  const [quickMenuOpen, setQuickMenuOpen] = useState<boolean>(false);
  const [quickMenuIndex, setQuickMenuIndex] = useState<number>(0);
  const [tocOpen, setTocOpen] = useState<boolean>(false);
  const [tocTab, setTocTab] = useState<TocTab>('chapters');
  const [tocIndex, setTocIndex] = useState<number>(0);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [turnAnimKey, setTurnAnimKey] = useState<number>(0);
  const [turnDirection, setTurnDirection] = useState<'next' | 'prev'>('next');
  const [turnFromPage, setTurnFromPage] = useState<number>(0);

  // OSD Toast
  const [toastText, setToastText] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const openingTimerRef = useRef<number | null>(null);
  const rescanTimerRef = useRef<number | null>(null);
  const readingTickRef = useRef<number>(Date.now());
  const nativeReadyRef = useRef<boolean>(false);
  const nativeGamepadActiveRef = useRef<boolean>(false);
  const saveTimerRef = useRef<number | null>(null);
  const pdfQueueRunningRef = useRef<boolean>(false);
  const lastPressRef = useRef<{ btn: HandheldButton | null; time: number }>({
    btn: null,
    time: 0,
  });
  const pendingTriggerRef = useRef<{
    btn: 'L2' | 'R2';
    timer: number;
    time: number;
  } | null>(null);
  const heldTriggersRef = useRef<{ L2: boolean; R2: boolean }>({ L2: false, R2: false });

  // Shell & Hardware input visualization
  const [expandedScreen, setExpandedScreen] = useState<boolean>(false);
  const [activeButtons, setActiveButtons] = useState<Set<HandheldButton>>(new Set());
  const [clockText, setClockText] = useState<string>('20:08');

  const showToast = useCallback((text: string) => {
    setToastText(text);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastText(null);
    }, 1400);
  }, []);

  const processPdfBackgroundMeta = useCallback(async (candidateBooks: BookItem[]) => {
    const bridge = window.rocknixNative;
    if (!bridge || pdfQueueRunningRef.current) return;
    const pending = candidateBooks.filter((b) => b.format === 'PDF' && b.needsPdfMeta);
    if (pending.length === 0) return;

    pdfQueueRunningRef.current = true;
    try {
      for (const item of pending) {
        try {
          const bytes = await bridge.readBookBytes(item.id);
          const meta = await extractPdfMetaAndThumb(bytes);
          const saved = await bridge.savePdfMeta({
            id: item.id,
            totalPages: meta.totalPages,
            title: meta.title,
            author: meta.author,
            thumbDataUrl: meta.thumbDataUrl,
            pdfMeta: meta.pdfMeta,
            pdfChapters: meta.pdfChapters,
          });
          setBooks((prev) =>
            prev.map((b) => {
              if (b.id !== item.id) return b;
              const nextPages =
                b.pages.length === meta.totalPages
                  ? b.pages
                  : Array.from({ length: meta.totalPages }, (_, idx) => ({
                      chapter: `Trang ${idx + 1}`,
                    }));
              return {
                ...b,
                title: meta.title || b.title,
                author: meta.author || b.author,
                totalPages: meta.totalPages,
                chapterCount:
                  meta.pdfChapters && meta.pdfChapters.length > 0
                    ? meta.pdfChapters.length
                    : b.chapterCount || 1,
                currentPage: Math.min(b.currentPage, Math.max(0, meta.totalPages - 1)),
                coverImage: saved.coverImage || b.coverImage,
                pdfMeta: meta.pdfMeta ?? b.pdfMeta,
                pdfChapters: meta.pdfChapters ?? b.pdfChapters,
                pages: nextPages,
                needsPdfMeta: false,
              };
            })
          );
        } catch {
          // Skip unreadable PDF silently
        }
      }
    } finally {
      pdfQueueRunningRef.current = false;
    }
  }, []);

  useEffect(() => {
    const bridge = window.rocknixNative;
    if (!bridge) return;
    let mounted = true;
    const unsubscribeGamepad = bridge.onNativeButton
      ? bridge.onNativeButton((btn) => {
          if (btn === 'L2_R2') {
            handleTriggerComboRef.current();
          } else {
            handleButtonRef.current(btn as HandheldButton);
          }
        })
      : undefined;

    bridge
      .init()
      .then((payload) => {
        if (!mounted) return;
        nativeGamepadActiveRef.current = Boolean(payload.hasNativeGamepad);
        const p = payload.persisted || {};
        setFolderTabs(payload.folders.length > 0 ? payload.folders : FOLDER_TABS);
        setBatteryInfo(payload.battery);

        if (p.settings) {
          setSettings({
            ...INITIAL_SETTINGS,
            ...p.settings,
            brightness:
              typeof p.settings.brightness === 'number'
                ? p.settings.brightness
                : INITIAL_SETTINGS.brightness,
          });
        }
        if (p.viewMode && LIBRARY_VIEW_MODES.some((m) => m.id === p.viewMode)) {
          setViewMode(p.viewMode);
        }
        if (p.activeFolder && payload.folders.some((f) => f.id === p.activeFolder)) {
          setActiveFolder(p.activeFolder);
        }
        if (typeof p.sphereTilt === 'number') {
          setSphereTilt(p.sphereTilt);
        }
        if (typeof p.selectedIndex === 'number' && p.selectedIndex >= 0) {
          setSelectedIndex(p.selectedIndex);
        }

        setBooks(payload.books);
        nativeReadyRef.current = true;

        if (p.activeBookId) {
          const resumeBook = payload.books.find((b) => b.id === p.activeBookId);
          if (resumeBook) {
            openBookRef.current(resumeBook, {
              silent: true,
              preserveHud: Boolean(p.showReaderHud),
            });
          }
        }

        if (payload.firstScanPerformed) {
          if (payload.books.length > 0) {
            showToast(`Đã tìm thấy ${payload.books.length} cuốn sách trong Books/`);
          } else {
            showToast('Đã tạo thư mục /storage/roms/books/');
          }
        }

        void processPdfBackgroundMeta(payload.books);
      })
      .catch(() => {
        nativeReadyRef.current = true;
      });

    const batteryTimer = window.setInterval(() => {
      bridge
        .getBattery()
        .then((bat) => {
          if (mounted) setBatteryInfo(bat);
        })
        .catch(() => {});
    }, 15000);

    return () => {
      mounted = false;
      unsubscribeGamepad?.();
      window.clearInterval(batteryTimer);
    };
  }, [processPdfBackgroundMeta, showToast]);

  // Web Simulator: read real browser Battery API when supported (falls back cleanly if unavailable)
  useEffect(() => {
    if (isNative) return;
    const nav = navigator as Navigator & {
      getBattery?: () => Promise<{
        level: number;
        charging: boolean;
        addEventListener: (ev: string, fn: () => void) => void;
        removeEventListener: (ev: string, fn: () => void) => void;
      }>;
    };
    if (typeof nav.getBattery !== 'function') return;

    let disposed = false;
    let batRef: Awaited<ReturnType<NonNullable<typeof nav.getBattery>>> | null = null;
    const sync = () => {
      if (disposed || !batRef) return;
      setBatteryInfo({
        level: Math.max(0, Math.min(100, Math.round(batRef.level * 100))),
        charging: Boolean(batRef.charging),
      });
    };

    nav
      .getBattery()
      .then((bat) => {
        if (disposed) return;
        batRef = bat;
        sync();
        bat.addEventListener('levelchange', sync);
        bat.addEventListener('chargingchange', sync);
      })
      .catch(() => {});

    return () => {
      disposed = true;
      if (batRef) {
        batRef.removeEventListener('levelchange', sync);
        batRef.removeEventListener('chargingchange', sync);
      }
    };
  }, [isNative]);

  useEffect(() => {
    sfx.configure(settings.sfxEnabled, settings.sfxVolume);
  }, [settings.sfxEnabled, settings.sfxVolume]);

  // Track active reading time for currently open book
  useEffect(() => {
    if (!activeBookId || exitedToRocknix) return;
    readingTickRef.current = Date.now();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'hidden') {
        readingTickRef.current = Date.now();
        return;
      }
      const now = Date.now();
      const elapsedSec = Math.min(60, Math.max(1, Math.round((now - readingTickRef.current) / 1000)));
      readingTickRef.current = now;
      setBooks((prev) =>
        prev.map((b) =>
          b.id === activeBookId
            ? { ...b, readingSeconds: (b.readingSeconds || 0) + elapsedSec }
            : b
        )
      );
    }, 15000);
    return () => window.clearInterval(timer);
  }, [activeBookId, exitedToRocknix]);

  const buildPersistedPayload = useCallback((): PersistedAppState => {
    const booksRecord: Record<string, PersistedBookState> = {};
    books.forEach((b) => {
      booksRecord[b.id] = {
        currentPage: b.currentPage,
        hasOpened: Boolean(b.hasOpened || b.currentPage > 0),
        lastOpenedAt: b.lastOpenedAt,
        readingSeconds: b.readingSeconds || 0,
        favorite: b.favorite,
        bookmarks: b.bookmarks,
      };
    });
    return {
      settings,
      activeFolder,
      viewMode,
      selectedIndex,
      activeBookId,
      sphereTilt,
      showReaderHud,
      books: booksRecord,
    };
  }, [activeBookId, activeFolder, books, selectedIndex, settings, showReaderHud, sphereTilt, viewMode]);

  const latestPayloadRef = useRef<PersistedAppState>({});
  latestPayloadRef.current = buildPersistedPayload();

  // Persist user preferences, library view mode, active folder, selected item, and book progress
  useEffect(() => {
    const payload = buildPersistedPayload();
    if (isNative) {
      if (!nativeReadyRef.current || !window.rocknixNative) return;
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = window.setTimeout(() => {
        void window.rocknixNative?.saveState(payload);
      }, 180);
      return;
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage quota errors in restricted environments
    }
  }, [buildPersistedPayload, isNative]);

  // Flush pending native/web state immediately on page hide / window close
  useEffect(() => {
    const flushNow = () => {
      const payload = latestPayloadRef.current;
      if (isNative) {
        if (nativeReadyRef.current && window.rocknixNative) {
          void window.rocknixNative.saveState(payload);
        }
      } else {
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        } catch {
          // Ignore storage quota errors
        }
      }
    };
    const onVisChange = () => {
      if (document.visibilityState === 'hidden') flushNow();
    };
    window.addEventListener('beforeunload', flushNow);
    window.addEventListener('pagehide', flushNow);
    document.addEventListener('visibilitychange', onVisChange);
    return () => {
      window.removeEventListener('beforeunload', flushNow);
      window.removeEventListener('pagehide', flushNow);
      document.removeEventListener('visibilitychange', onVisChange);
    };
  }, [isNative]);

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      setClockText(`${hh}:${mm}`);
    };
    updateClock();
    const timer = window.setInterval(updateClock, 15000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    return () => {
      if (rescanTimerRef.current) window.clearTimeout(rescanTimerRef.current);
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      if (openingTimerRef.current) window.clearTimeout(openingTimerRef.current);
      if (pendingTriggerRef.current) window.clearTimeout(pendingTriggerRef.current.timer);
    };
  }, []);

  const filteredBooks = useMemo(() => {
    const base =
      activeFolder === 'all'
        ? books
        : activeFolder === 'reading'
          ? books.filter((b) => b.currentPage > 0 || Boolean(b.hasOpened))
          : activeFolder === 'favorites'
            ? books.filter((b) => b.favorite)
            : books.filter((b) => b.folderId === activeFolder);

    if (settings.sortBy === 'default') return base;

    const copy = [...base];
    switch (settings.sortBy) {
      case 'title_asc':
        return copy.sort((a, b) => a.title.localeCompare(b.title, 'vi'));
      case 'title_desc':
        return copy.sort((a, b) => b.title.localeCompare(a.title, 'vi'));
      case 'author_asc':
        return copy.sort(
          (a, b) =>
            a.author.localeCompare(b.author, 'vi') ||
            a.title.localeCompare(b.title, 'vi')
        );
      case 'progress_desc':
        return copy.sort((a, b) => {
          const pctA = a.currentPage > 0 ? (a.currentPage + 1) / Math.max(1, a.totalPages) : 0;
          const pctB = b.currentPage > 0 ? (b.currentPage + 1) / Math.max(1, b.totalPages) : 0;
          return (
            pctB - pctA ||
            b.currentPage - a.currentPage ||
            a.title.localeCompare(b.title, 'vi')
          );
        });
      case 'pages_desc':
        return copy.sort(
          (a, b) =>
            b.totalPages - a.totalPages || a.title.localeCompare(b.title, 'vi')
        );
      case 'pages_asc':
        return copy.sort(
          (a, b) =>
            a.totalPages - b.totalPages || a.title.localeCompare(b.title, 'vi')
        );
      case 'format':
        return copy.sort(
          (a, b) =>
            a.format.localeCompare(b.format) ||
            a.title.localeCompare(b.title, 'vi')
        );
      case 'favorite':
        return copy.sort(
          (a, b) =>
            Number(b.favorite) - Number(a.favorite) ||
            a.title.localeCompare(b.title, 'vi')
        );
      default:
        return copy;
    }
  }, [books, activeFolder, settings.sortBy]);

  const activeFolderLabel = useMemo(
    () => folderTabs.find((t) => t.id === activeFolder)?.label ?? 'Tất cả',
    [activeFolder, folderTabs]
  );

  const searchResults = useMemo(() => {
    const pool = filteredBooks.length > 0 ? filteredBooks : books;
    return pool.filter((b) => matchesBookSearch(b, searchQuery));
  }, [filteredBooks, books, searchQuery]);

  const safeSearchResultIdx =
    searchResults.length > 0 ? Math.min(searchResultIdx, searchResults.length - 1) : 0;

  const safeSelectedIndex =
    filteredBooks.length > 0 ? Math.min(selectedIndex, filteredBooks.length - 1) : 0;
  const activeBook = useMemo(
    () => books.find((b) => b.id === activeBookId) ?? null,
    [books, activeBookId]
  );
  const activeBookChapters = useMemo(
    () => (activeBook ? getBookChapters(activeBook) : []),
    [activeBook]
  );
  const activeBookBookmarks = useMemo(
    () => (activeBook ? [...activeBook.bookmarks].sort((a, b) => a - b) : []),
    [activeBook]
  );
  const infoBook = useMemo(
    () => books.find((b) => b.id === infoBookId) ?? null,
    [books, infoBookId]
  );

  const flashButton = useCallback((btn: HandheldButton) => {
    setActiveButtons((prev) => {
      const next = new Set(prev);
      next.add(btn);
      return next;
    });
    window.setTimeout(() => {
      setActiveButtons((prev) => {
        const next = new Set(prev);
        next.delete(btn);
        return next;
      });
    }, 150);
  }, []);

  const updateSettings = useCallback(
    (patch: Partial<AppSettings>) => {
      sfx.playToggle();
      if (patch.sortBy !== undefined) {
        setSelectedIndex(0);
        const sortLabel =
          LIBRARY_SORT_MODES.find((s) => s.id === patch.sortBy)?.label ?? 'Mặc định';
        showToast(`Sắp xếp: ${sortLabel}`);
      }
      setSettings((prev) => ({ ...prev, ...patch }));
    },
    [showToast]
  );

  const cycleRotation = useCallback(() => {
    sfx.playToggle();
    setPanOffset({ x: 0, y: 0 });
    setSettings((prev) => {
      const curIdx = ROTATIONS.indexOf(prev.rotation);
      const nextRot = ROTATIONS[(curIdx + 1) % ROTATIONS.length];
      showToast(`Xoay màn hình: ${nextRot}°`);
      return { ...prev, rotation: nextRot };
    });
  }, [showToast]);

  const cycleZoom = useCallback(() => {
    sfx.playToggle();
    setZoomLevel((z) => {
      const idx = ZOOM_LEVELS.indexOf(z);
      const next = ZOOM_LEVELS[(idx + 1) % ZOOM_LEVELS.length];
      if (next === 1) {
        setPanOffset({ x: 0, y: 0 });
        showToast('Phóng to: 100% (Vừa khung)');
      } else {
        const { maxX, maxY } = getPanBounds(next, settings.rotation);
        setPanOffset((p) => ({
          x: Math.max(-maxX, Math.min(maxX, p.x)),
          y: Math.max(-maxY, Math.min(maxY, p.y)),
        }));
        showToast(`Phóng to: ${Math.round(next * 100)}% · Dùng D-Pad soi góc`);
      }
      return next;
    });
  }, [settings.rotation, showToast]);

  const selectFolder = useCallback((folder: FolderId) => {
    sfx.playFolderSwitch();
    setActiveFolder(folder);
    setSelectedIndex(0);
  }, []);

  const selectViewMode = useCallback((mode: LibraryViewMode) => {
    sfx.playToggle();
    setViewMode(mode);
  }, []);

  const ensurePdfPagesRendered = useCallback(
    async (bookId: string, centerIdx: number, totalCount: number) => {
      const targets = [centerIdx, centerIdx + 1, centerIdx + 2, centerIdx - 1].filter(
        (idx, pos, arr) => idx >= 0 && idx < totalCount && arr.indexOf(idx) === pos
      );
      for (const idx of targets) {
        const url = await renderPdfPageUrl(bookId, idx, 1040);
        if (!url) continue;
        setBooks((prev) =>
          prev.map((b) => {
            if (b.id !== bookId) return b;
            if (b.pages[idx]?.imageUrl === url) return b;
            const nextPages = [...b.pages];
            nextPages[idx] = {
              ...(nextPages[idx] || { chapter: `Trang ${idx + 1}` }),
              imageUrl: url,
            };
            return { ...b, pages: nextPages };
          })
        );
      }
    },
    []
  );

  const openBook = useCallback(
    (book: BookItem, options?: { silent?: boolean; preserveHud?: boolean }) => {
      if (!options?.silent) {
        sfx.playOpenBook();
        if (openingTimerRef.current) window.clearTimeout(openingTimerRef.current);
        setOpeningAnim({ book, key: Date.now() });
        openingTimerRef.current = window.setTimeout(() => {
          setOpeningAnim(null);
        }, 480);
      }

      const openedAt = Date.now();
      setBooks((prev) =>
        prev.map((b) =>
          b.id === book.id ? { ...b, hasOpened: true, lastOpenedAt: openedAt } : b
        )
      );

      setInfoBookId(null);
      setSettingsOpen(false);
      setSearchOpen(false);
      setExitConfirmOpen(false);
      setActiveBookId(book.id);
      if (!options?.preserveHud) {
        setShowReaderHud(false);
      }
      setQuickMenuOpen(false);
      setTocOpen(false);
      setZoomLevel(1);
      setPanOffset({ x: 0, y: 0 });
      setTurnAnimKey(0);
      setTurnFromPage(book.currentPage);
      setToastText(null);
      setTocIndex(Math.min(book.currentPage, Math.max(0, book.pages.length - 1)));

      const bridge = window.rocknixNative;
      if (!bridge) return;

      if (book.format === 'PDF') {
        void (async () => {
          try {
            const bytes = await bridge.readBookBytes(book.id);
            const opened = await openPdfDocument(book.id, bytes);
            const realTotal = opened.totalPages;
            setBooks((prev) =>
              prev.map((b) => {
                if (b.id !== book.id) return b;
                const existing = b.pages.length === realTotal ? b.pages : [];
                const nextPages =
                  existing.length > 0
                    ? existing
                    : Array.from({ length: realTotal }, (_, i) => ({
                        chapter: `Trang ${i + 1}`,
                      }));
                return {
                  ...b,
                  totalPages: realTotal,
                  chapterCount:
                    opened.pdfChapters.length > 0
                      ? opened.pdfChapters.length
                      : b.chapterCount || 1,
                  pdfMeta: opened.pdfMeta ?? b.pdfMeta,
                  pdfChapters:
                    opened.pdfChapters.length > 0 ? opened.pdfChapters : b.pdfChapters,
                  currentPage: Math.min(b.currentPage, realTotal - 1),
                  pages: nextPages,
                };
              })
            );
            if (
              !book.pdfMeta &&
              (opened.pdfMeta || opened.pdfChapters.length > 0)
            ) {
              void bridge.savePdfMeta({
                id: book.id,
                totalPages: realTotal,
                pdfMeta: opened.pdfMeta,
                pdfChapters: opened.pdfChapters,
              });
            }
            await ensurePdfPagesRendered(
              book.id,
              Math.min(book.currentPage, realTotal - 1),
              realTotal
            );
          } catch {
            showToast('Không thể đọc tệp PDF này');
          }
        })();
      } else if (book.pages.length === 0) {
        void (async () => {
          try {
            const loadedPages = await bridge.loadBookPages(book.id);
            if (loadedPages.length > 0) {
              setBooks((prev) =>
                prev.map((b) =>
                  b.id === book.id
                    ? {
                        ...b,
                        pages: loadedPages,
                        totalPages: loadedPages.length,
                        currentPage: Math.min(b.currentPage, loadedPages.length - 1),
                      }
                    : b
                )
              );
            }
          } catch {
            showToast('Không thể mở nội dung sách');
          }
        })();
      }
    },
    [ensurePdfPagesRendered, showToast]
  );

  const openBookRef = useRef(openBook);
  openBookRef.current = openBook;

  const restartBookFromBeginning = useCallback(
    (book: BookItem) => {
      setBooks((prev) =>
        prev.map((b) =>
          b.id === book.id
            ? { ...b, currentPage: 0, hasOpened: true, lastOpenedAt: Date.now() }
            : b
        )
      );
      openBook({ ...book, currentPage: 0 });
    },
    [openBook]
  );

  const closeBook = useCallback(() => {
    sfx.playCloseBook();
    if (openingTimerRef.current) window.clearTimeout(openingTimerRef.current);
    if (pendingTriggerRef.current) {
      window.clearTimeout(pendingTriggerRef.current.timer);
      pendingTriggerRef.current = null;
    }
    if (activeBook) {
      const elapsedSec = Math.min(60, Math.max(0, Math.round((Date.now() - readingTickRef.current) / 1000)));
      if (elapsedSec > 0) {
        setBooks((prev) =>
          prev.map((b) =>
            b.id === activeBook.id
              ? { ...b, readingSeconds: (b.readingSeconds || 0) + elapsedSec }
              : b
          )
        );
      }
    }
    setOpeningAnim(null);
    if (isNative && activeBook?.format === 'PDF') {
      void closePdfDocument(activeBook.id);
    }
    setActiveBookId(null);
    setShowReaderHud(false);
    setQuickMenuOpen(false);
    setTocOpen(false);
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
    setToastText(null);
  }, [activeBook, isNative]);

  const turnPage = useCallback(
    (dir: 'next' | 'prev') => {
      if (!activeBook) return;
      const maxPage = Math.max(0, activeBook.pages.length - 1);
      const nextPage =
        dir === 'next'
          ? Math.min(maxPage, activeBook.currentPage + 1)
          : Math.max(0, activeBook.currentPage - 1);

      if (nextPage === activeBook.currentPage) {
        showToast(dir === 'next' ? 'Đã tới trang cuối' : 'Đang ở trang đầu');
        return;
      }

      sfx.playPageTurn(dir);
      setTurnFromPage(activeBook.currentPage);
      setTurnDirection(dir);
      setTurnAnimKey((k) => k + 1);
      setPanOffset({ x: 0, y: 0 });
      setBooks((prev) =>
        prev.map((b) => (b.id === activeBook.id ? { ...b, currentPage: nextPage } : b))
      );
      if (isNative && activeBook.format === 'PDF') {
        void ensurePdfPagesRendered(activeBook.id, nextPage, activeBook.totalPages);
      }
    },
    [activeBook, ensurePdfPagesRendered, isNative, showToast]
  );

  const jumpToPage = useCallback(
    (pageIdx: number, customToast?: string) => {
      if (!activeBook) return;
      const clamped = Math.max(0, Math.min(activeBook.pages.length - 1, pageIdx));
      if (clamped !== activeBook.currentPage) {
        sfx.playPageTurn(clamped >= activeBook.currentPage ? 'next' : 'prev');
        setTurnFromPage(activeBook.currentPage);
        setTurnDirection(clamped >= activeBook.currentPage ? 'next' : 'prev');
        setTurnAnimKey((k) => k + 1);
        setPanOffset({ x: 0, y: 0 });
        setBooks((prev) =>
          prev.map((b) => (b.id === activeBook.id ? { ...b, currentPage: clamped } : b))
        );
        if (isNative && activeBook.format === 'PDF') {
          void ensurePdfPagesRendered(activeBook.id, clamped, activeBook.totalPages);
        }
      }
      if (customToast) showToast(customToast);
    },
    [activeBook, ensurePdfPagesRendered, isNative, showToast]
  );

  const jumpChapter = useCallback(
    (dir: 'next' | 'prev') => {
      if (!activeBook) return;
      const curChap = activeBook.pages[activeBook.currentPage]?.chapter;
      let target = activeBook.currentPage;

      if (dir === 'next') {
        for (let i = activeBook.currentPage + 1; i < activeBook.pages.length; i++) {
          if (activeBook.pages[i].chapter !== curChap) {
            target = i;
            break;
          }
        }
      } else {
        let foundPrevChap: string | null = null;
        for (let i = activeBook.currentPage - 1; i >= 0; i--) {
          if (activeBook.pages[i].chapter !== curChap) {
            foundPrevChap = activeBook.pages[i].chapter;
            break;
          }
        }
        if (foundPrevChap) {
          target = activeBook.pages.findIndex((p) => p.chapter === foundPrevChap);
        } else {
          target = 0;
        }
      }

      if (target !== activeBook.currentPage) {
        const chapTitle = activeBook.pages[target]?.chapter ?? '';
        jumpToPage(target, chapTitle);
      } else {
        showToast(dir === 'next' ? 'Đang ở chương cuối' : 'Đang ở chương đầu');
      }
    },
    [activeBook, jumpToPage, showToast]
  );

  const scrubByPercent = useCallback(
    (dir: 'forward' | 'backward') => {
      if (!activeBook) return;
      const total = activeBook.pages.length;
      const stepPages = Math.max(1, Math.round(total * 0.1));
      const target =
        dir === 'forward'
          ? Math.min(total - 1, activeBook.currentPage + stepPages)
          : Math.max(0, activeBook.currentPage - stepPages);
      const pct = Math.round(((target + 1) / Math.max(1, total)) * 100);
      jumpToPage(target, `Tua nhanh: ${pct}% (Trang ${target + 1}/${total})`);
    },
    [activeBook, jumpToPage]
  );

  const toggleBookmark = useCallback(() => {
    if (!activeBook) return;
    sfx.playBookmark();
    const exists = activeBook.bookmarks.includes(activeBook.currentPage);
    showToast(exists ? 'Đã gỡ đánh dấu trang' : 'Đã đánh dấu trang hiện tại');
    setBooks((prev) =>
      prev.map((b) => {
        if (b.id !== activeBook.id) return b;
        const bookmarks = exists
          ? b.bookmarks.filter((p) => p !== b.currentPage)
          : [...b.bookmarks, b.currentPage].sort((a, c) => a - c);
        return { ...b, bookmarks };
      })
    );
  }, [activeBook, showToast]);

  const removeBookmarkPage = useCallback(
    (pageIdx: number) => {
      if (!activeBook) return;
      sfx.playBookmark();
      const nextCount = activeBook.bookmarks.filter((p) => p !== pageIdx).length;
      setBooks((prev) =>
        prev.map((b) => {
          if (b.id !== activeBook.id) return b;
          return {
            ...b,
            bookmarks: b.bookmarks.filter((p) => p !== pageIdx),
          };
        })
      );
      setTocIndex((i) => Math.max(0, Math.min(i, Math.max(0, nextCount - 1))));
      showToast(`Đã xóa đánh dấu Trang ${pageIdx + 1}`);
    },
    [activeBook, showToast]
  );

  const toggleTwoPageLayout = useCallback(() => {
    const nextTwoPage = !settings.twoPageSpread;
    const isPortrait = settings.rotation === 90 || settings.rotation === 270;
    updateSettings({ twoPageSpread: nextTwoPage });
    showToast(
      nextTwoPage
        ? isPortrait
          ? 'Bố cục: 2 Trang (hiện khi xoay ngang)'
          : 'Bố cục: 2 Trang'
        : 'Bố cục: 1 Trang'
    );
  }, [settings.rotation, settings.twoPageSpread, showToast, updateSettings]);

  const triggerL2R2Bookmark = useCallback(() => {
    if (pendingTriggerRef.current) {
      window.clearTimeout(pendingTriggerRef.current.timer);
      pendingTriggerRef.current = null;
    }
    flashButton('L2');
    flashButton('R2');
    if (activeBook && !tocOpen && !quickMenuOpen) {
      toggleBookmark();
    }
  }, [activeBook, flashButton, quickMenuOpen, tocOpen, toggleBookmark]);

  const toggleFavorite = useCallback(
    (bookId: string) => {
      sfx.playBookmark();
      setBooks((prev) =>
        prev.map((b) => {
          if (b.id !== bookId) return b;
          const nextFav = !b.favorite;
          showToast(nextFav ? 'Đã thêm vào ★ Yêu thích' : 'Đã gỡ khỏi ★ Yêu thích');
          return { ...b, favorite: nextFav };
        })
      );
    },
    [showToast]
  );

  const handleRescanBooks = useCallback(() => {
    if (isRescanning) return;
    sfx.playFolderSwitch();
    setIsRescanning(true);
    setRescanStatus('Đang quét Books/... và tạo cache cục bộ...');

    const bridge = window.rocknixNative;
    if (bridge) {
      void (async () => {
        try {
          await bridge.saveState(buildPersistedPayload());
          const res = await bridge.rescanBooks();
          setBooks(res.books);
          setFolderTabs(res.folders.length > 0 ? res.folders : FOLDER_TABS);
          setActiveFolder((cur) =>
            res.folders.some((f) => f.id === cur) ? cur : 'all'
          );
          setSelectedIndex(0);
          setIsRescanning(false);
          setRescanStatus(
            `Đã cập nhật cache: ${res.folderCount} thư mục · ${res.books.length} đầu sách`
          );
          sfx.playToggle();
          showToast('Đã quét lại thư mục Books');
          void processPdfBackgroundMeta(res.books);
        } catch {
          setIsRescanning(false);
          setRescanStatus('Lỗi khi quét thư mục Books');
          showToast('Lỗi quét thư mục Books');
        }
      })();
      return;
    }

    if (rescanTimerRef.current) window.clearTimeout(rescanTimerRef.current);
    rescanTimerRef.current = window.setTimeout(() => {
      setIsRescanning(false);
      setRescanStatus(`Đã cập nhật cache: 4 thư mục · ${books.length} đầu sách`);
      sfx.playToggle();
      showToast('Đã quét lại thư mục Books');
    }, 650);
  }, [books.length, buildPersistedPayload, isRescanning, processPdfBackgroundMeta, showToast]);

  const handleSelectSearchResult = useCallback(
    (book: BookItem) => {
      const idxInFolder = filteredBooks.findIndex((b) => b.id === book.id);
      if (idxInFolder >= 0) {
        setSelectedIndex(idxInFolder);
      } else {
        const idxAll = books.findIndex((b) => b.id === book.id);
        setActiveFolder('all');
        if (idxAll >= 0) setSelectedIndex(idxAll);
      }
      openBook(book);
    },
    [books, filteredBooks, openBook]
  );

  const handleSearchKeyPress = useCallback(
    (keyLabel: string) => {
      sfx.playToggle();
      if (keyLabel === '⌫') {
        setSearchQuery((q) => q.slice(0, -1));
        setSearchResultIdx(0);
      } else if (keyLabel === 'CLEAR') {
        setSearchQuery('');
        setSearchResultIdx(0);
      } else if (keyLabel === 'SPACE') {
        setSearchQuery((q) => (q && !q.endsWith(' ') ? `${q} ` : q));
        setSearchResultIdx(0);
      } else if (keyLabel === 'OK') {
        if (searchResults.length > 0) {
          handleSelectSearchResult(searchResults[safeSearchResultIdx]);
        } else {
          showToast('Không có sách khớp từ khóa');
        }
      } else {
        setSearchQuery((q) => (q.length < 24 ? `${q}${keyLabel}` : q));
        setSearchResultIdx(0);
      }
    },
    [handleSelectSearchResult, safeSearchResultIdx, searchResults, showToast]
  );

  const handleButton = useCallback(
    (rawBtn: HandheldButton) => {
      const now = performance.now();
      if (lastPressRef.current.btn === rawBtn && now - lastPressRef.current.time < 110) {
        return;
      }
      lastPressRef.current = { btn: rawBtn, time: now };

      flashButton(rawBtn);

      // 0. EXITED TO ROCKNIX SCREEN
      if (exitedToRocknix) {
        if (rawBtn === 'A' || rawBtn === 'START') {
          sfx.playOpenBook();
          setExitedToRocknix(false);
        }
        return;
      }

      // 1. READER MODE INPUTS
      if (activeBook) {
        // TOC Modal open (uses visual screen-space menu direction!)
        if (tocOpen) {
          const menuBtn = remapMenuDirection(rawBtn, settings.rotation);
          const listLen =
            tocTab === 'chapters'
              ? activeBookChapters.length
              : activeBookBookmarks.length;
          if (menuBtn === 'B' || menuBtn === 'Y') {
            sfx.playToggle();
            setTocOpen(false);
          } else if (
            menuBtn === 'LEFT' ||
            menuBtn === 'RIGHT' ||
            rawBtn === 'L1' ||
            rawBtn === 'R1'
          ) {
            sfx.playFolderSwitch();
            const nextTab: TocTab = tocTab === 'chapters' ? 'bookmarks' : 'chapters';
            setTocTab(nextTab);
            setTocIndex(
              nextTab === 'chapters'
                ? getCurrentChapterInfo(activeBook).chapterIdx
                : 0
            );
          } else if (menuBtn === 'UP') {
            if (listLen > 0) {
              sfx.playHover();
              setTocIndex((i) => Math.max(0, i - 1));
            }
          } else if (menuBtn === 'DOWN') {
            if (listLen > 0) {
              sfx.playHover();
              setTocIndex((i) => Math.min(listLen - 1, i + 1));
            }
          } else if (menuBtn === 'A') {
            if (tocTab === 'chapters' && activeBookChapters.length > 0) {
              const target =
                activeBookChapters[Math.min(tocIndex, activeBookChapters.length - 1)];
              if (target) jumpToPage(target.pageIdx);
              setTocOpen(false);
            } else if (tocTab === 'bookmarks' && activeBookBookmarks.length > 0) {
              const targetPage =
                activeBookBookmarks[Math.min(tocIndex, activeBookBookmarks.length - 1)];
              if (typeof targetPage === 'number') jumpToPage(targetPage);
              setTocOpen(false);
            }
          } else if (menuBtn === 'X') {
            if (tocTab === 'bookmarks' && activeBookBookmarks.length > 0) {
              const targetIdx = Math.min(tocIndex, activeBookBookmarks.length - 1);
              const pageToDelete = activeBookBookmarks[targetIdx];
              if (typeof pageToDelete === 'number') {
                removeBookmarkPage(pageToDelete);
                setTocIndex(Math.max(0, Math.min(targetIdx, activeBookBookmarks.length - 2)));
              }
            }
          }
          return;
        }

        // Quick Settings Drawer open (uses visual screen-space menu direction!)
        if (quickMenuOpen) {
          const menuBtn = remapMenuDirection(rawBtn, settings.rotation);
          if (menuBtn === 'B' || menuBtn === 'START') {
            sfx.playToggle();
            setQuickMenuOpen(false);
          } else if (menuBtn === 'UP') {
            sfx.playHover();
            setQuickMenuIndex((i) => (i + 5) % 6);
          } else if (menuBtn === 'DOWN') {
            sfx.playHover();
            setQuickMenuIndex((i) => (i + 1) % 6);
          } else if (menuBtn === 'LEFT' || menuBtn === 'RIGHT' || menuBtn === 'A') {
            const delta = menuBtn === 'LEFT' ? -1 : 1;
            if (quickMenuIndex === 0) {
              const cur = READER_THEMES.indexOf(settings.readerTheme);
              const next = (cur + delta + READER_THEMES.length) % READER_THEMES.length;
              updateSettings({ readerTheme: READER_THEMES[next] });
            } else if (quickMenuIndex === 1) {
              const cur = PAGE_TURN_MODES.indexOf(settings.pageTurnMode);
              const next = (cur + delta + PAGE_TURN_MODES.length) % PAGE_TURN_MODES.length;
              updateSettings({ pageTurnMode: PAGE_TURN_MODES[next] });
            } else if (quickMenuIndex === 2) {
              updateSettings({
                fontSize: Math.max(13, Math.min(24, settings.fontSize + delta)),
              });
            } else if (quickMenuIndex === 3) {
              const curBrightness = settings.brightness ?? 100;
              updateSettings({
                brightness: Math.max(20, Math.min(100, curBrightness + delta * 5)),
              });
            } else if (quickMenuIndex === 4) {
              updateSettings({
                warmth: Math.max(0, Math.min(65, settings.warmth + delta * 5)),
              });
            } else if (quickMenuIndex === 5) {
              if (menuBtn === 'LEFT') {
                updateSettings({ twoPageSpread: !settings.twoPageSpread });
              } else {
                cycleRotation();
              }
            }
          }
          return;
        }

        // Reading Page Navigation (uses verified reader mapping; D-Pad pans when Zoom > 100%)
        const btn = remapReaderDirection(rawBtn, settings.rotation);
        if (btn === 'SELECT') {
          sfx.playToggle();
          setShowReaderHud((s) => !s);
        } else if (btn === 'A') {
          cycleRotation();
        } else if (
          zoomLevel > 1 &&
          (rawBtn === 'LEFT' || rawBtn === 'RIGHT' || rawBtn === 'UP' || rawBtn === 'DOWN')
        ) {
          const panBtn = remapMenuDirection(rawBtn, settings.rotation);
          const step = Math.round(70 * Math.min(2, zoomLevel));
          const { maxX, maxY } = getPanBounds(zoomLevel, settings.rotation);
          setPanOffset((prev) => {
            let nx = prev.x;
            let ny = prev.y;
            if (panBtn === 'RIGHT') nx -= step;
            else if (panBtn === 'LEFT') nx += step;
            else if (panBtn === 'DOWN') ny -= step;
            else if (panBtn === 'UP') ny += step;
            return {
              x: Math.max(-maxX, Math.min(maxX, nx)),
              y: Math.max(-maxY, Math.min(maxY, ny)),
            };
          });
        } else if (btn === 'RIGHT') {
          turnPage('next');
        } else if (btn === 'LEFT') {
          turnPage('prev');
        } else if (btn === 'DOWN') {
          scrubByPercent('forward');
        } else if (btn === 'UP') {
          scrubByPercent('backward');
        } else if (btn === 'R1') {
          jumpChapter('next');
        } else if (btn === 'L1') {
          jumpChapter('prev');
        } else if (btn === 'R2' || btn === 'L2') {
          const otherBtn = btn === 'R2' ? 'L2' : 'R2';
          if (heldTriggersRef.current[otherBtn]) {
            triggerL2R2Bookmark();
            return;
          }
          if (
            pendingTriggerRef.current &&
            pendingTriggerRef.current.btn === otherBtn &&
            now - pendingTriggerRef.current.time <= 150
          ) {
            triggerL2R2Bookmark();
            return;
          }
          if (pendingTriggerRef.current) {
            window.clearTimeout(pendingTriggerRef.current.timer);
          }
          const firedBtn = btn;
          const timer = window.setTimeout(() => {
            pendingTriggerRef.current = null;
            if (firedBtn === 'R2') {
              const target = Math.min(activeBook.pages.length - 1, activeBook.currentPage + 5);
              jumpToPage(target, `Tua nhanh +5 trang (${target + 1}/${activeBook.totalPages})`);
            } else {
              const target = Math.max(0, activeBook.currentPage - 5);
              jumpToPage(target, `Lùi nhanh -5 trang (${target + 1}/${activeBook.totalPages})`);
            }
          }, 115);
          pendingTriggerRef.current = { btn: firedBtn, timer, time: now };
        } else if (btn === 'R3') {
          cycleZoom();
        } else if (btn === 'X') {
          toggleTwoPageLayout();
        } else if (btn === 'Y') {
          sfx.playToggle();
          setTocTab('chapters');
          setTocIndex(getCurrentChapterInfo(activeBook).chapterIdx);
          setTocOpen(true);
        } else if (btn === 'START') {
          sfx.playToggle();
          setQuickMenuOpen(true);
        } else if (btn === 'B') {
          if (showReaderHud) {
            sfx.playToggle();
            setShowReaderHud(false);
          } else if (zoomLevel > 1) {
            sfx.playToggle();
            setZoomLevel(1);
            setPanOffset({ x: 0, y: 0 });
            showToast('Đã thu về 100% · Bấm [B] lần nữa để về Thư viện');
          } else {
            closeBook();
          }
        }
        return;
      }

      // 2. EXIT CONFIRMATION MODAL INPUTS
      if (exitConfirmOpen) {
        if (rawBtn === 'B' || rawBtn === 'SELECT') {
          sfx.playToggle();
          setExitConfirmOpen(false);
        } else if (rawBtn === 'A') {
          sfx.playCloseBook();
          setExitConfirmOpen(false);
          if (isNative && window.rocknixNative) {
            void window.rocknixNative.saveState(buildPersistedPayload()).finally(() => {
              void window.rocknixNative?.quitApp();
            });
          } else {
            setExitedToRocknix(true);
          }
        }
        return;
      }

      // 3. SEARCH VIRTUAL KEYBOARD MODAL INPUTS
      if (searchOpen) {
        if (rawBtn === 'B') {
          sfx.playToggle();
          setSearchOpen(false);
        } else if (rawBtn === 'UP') {
          sfx.playHover();
          setSearchKeyRow((r) => (r + KEYBOARD_ROWS.length - 1) % KEYBOARD_ROWS.length);
        } else if (rawBtn === 'DOWN') {
          sfx.playHover();
          setSearchKeyRow((r) => (r + 1) % KEYBOARD_ROWS.length);
        } else if (rawBtn === 'LEFT') {
          sfx.playHover();
          setSearchKeyCol((c) => (c + 9) % 10);
        } else if (rawBtn === 'RIGHT') {
          sfx.playHover();
          setSearchKeyCol((c) => (c + 1) % 10);
        } else if (rawBtn === 'L1') {
          if (searchResults.length > 0) {
            sfx.playHover();
            setSearchResultIdx((i) => (i - 1 + searchResults.length) % searchResults.length);
          }
        } else if (rawBtn === 'R1') {
          if (searchResults.length > 0) {
            sfx.playHover();
            setSearchResultIdx((i) => (i + 1) % searchResults.length);
          }
        } else if (rawBtn === 'A') {
          const keyLabel = KEYBOARD_ROWS[searchKeyRow]?.[searchKeyCol];
          if (keyLabel) handleSearchKeyPress(keyLabel);
        } else if (rawBtn === 'X') {
          handleSearchKeyPress('⌫');
        } else if (rawBtn === 'Y') {
          handleSearchKeyPress('CLEAR');
        } else if (rawBtn === 'START') {
          if (searchResults.length > 0) {
            handleSelectSearchResult(searchResults[safeSearchResultIdx]);
          } else {
            showToast('Không có sách khớp từ khóa');
          }
        }
        return;
      }

      // 4. BOOK INFO MODAL INPUTS
      if (infoBook) {
        if (rawBtn === 'B' || rawBtn === 'X') {
          sfx.playToggle();
          setInfoBookId(null);
        } else if (rawBtn === 'A') {
          openBook(infoBook);
        } else if (rawBtn === 'R1' && infoBook.currentPage > 0) {
          restartBookFromBeginning(infoBook);
        } else if (rawBtn === 'Y') {
          toggleFavorite(infoBook.id);
        } else if (rawBtn === 'UP' || rawBtn === 'DOWN') {
          sfx.playHover();
          setInfoScrollSignal((prev) => ({
            dir: rawBtn === 'UP' ? -1 : 1,
            seq: prev.seq + 1,
          }));
        }
        return;
      }

      // 5. GLOBAL SETTINGS MODAL INPUTS
      if (settingsOpen) {
        if (rawBtn === 'B' || rawBtn === 'START') {
          sfx.playToggle();
          setSettingsOpen(false);
        } else if (rawBtn === 'L1' || rawBtn === 'R1') {
          sfx.playFolderSwitch();
          const tabs: SettingsTab[] = ['general', 'controls', 'about'];
          const curIdx = tabs.indexOf(settingsTab);
          const dir = rawBtn === 'R1' ? 1 : -1;
          setSettingsTab(tabs[(curIdx + dir + tabs.length) % tabs.length]);
        } else if (settingsTab === 'general') {
          if (rawBtn === 'UP') {
            sfx.playHover();
            setSettingsRow((r) => (r + 5) % 6);
          } else if (rawBtn === 'DOWN') {
            sfx.playHover();
            setSettingsRow((r) => (r + 1) % 6);
          } else if (rawBtn === 'LEFT' || rawBtn === 'RIGHT' || rawBtn === 'A') {
            const delta = rawBtn === 'LEFT' ? -1 : 1;
            if (settingsRow === 0) {
              updateSettings({ sfxEnabled: !settings.sfxEnabled });
            } else if (settingsRow === 1) {
              updateSettings({
                sfxVolume: Math.max(0, Math.min(1, Number((settings.sfxVolume + delta * 0.1).toFixed(2)))),
              });
            } else if (settingsRow === 2) {
              const cur = LIBRARY_VIEW_MODES.findIndex((m) => m.id === viewMode);
              const next = (cur + delta + LIBRARY_VIEW_MODES.length) % LIBRARY_VIEW_MODES.length;
              selectViewMode(LIBRARY_VIEW_MODES[next].id);
            } else if (settingsRow === 3) {
              const cur = LIBRARY_SORT_MODES.findIndex((s) => s.id === settings.sortBy);
              const next = (cur + delta + LIBRARY_SORT_MODES.length) % LIBRARY_SORT_MODES.length;
              updateSettings({ sortBy: LIBRARY_SORT_MODES[next].id });
            } else if (settingsRow === 4) {
              updateSettings({ showHints: !settings.showHints });
            } else if (settingsRow === 5 && rawBtn === 'A') {
              handleRescanBooks();
            }
          }
        } else if (settingsTab === 'controls') {
          if (rawBtn === 'LEFT' || rawBtn === 'RIGHT' || rawBtn === 'A') {
            sfx.playToggle();
            setGuideSubTab((s) => (s === 'keys' ? 'copy' : 'keys'));
          } else if (guideSubTab === 'copy' && (rawBtn === 'UP' || rawBtn === 'DOWN')) {
            sfx.playHover();
            setGuideScrollSignal((prev) => ({
              dir: rawBtn === 'UP' ? -1 : 1,
              seq: prev.seq + 1,
            }));
          }
        }
        return;
      }

      // 6. LIBRARY STAGE INPUTS
      if (rawBtn === 'SELECT') {
        sfx.playToggle();
        setExitConfirmOpen(true);
      } else if (rawBtn === 'B') {
        sfx.playToggle();
        setSearchQuery('');
        setSearchResultIdx(0);
        setSearchOpen(true);
      } else if (rawBtn === 'L1' || rawBtn === 'R1') {
        const cur = folderTabs.findIndex((f) => f.id === activeFolder);
        const safeCur = cur >= 0 ? cur : 0;
        const dir = rawBtn === 'R1' ? 1 : -1;
        const next = (safeCur + dir + folderTabs.length) % folderTabs.length;
        selectFolder(folderTabs[next].id);
      } else if (rawBtn === 'L2' || rawBtn === 'R2') {
        if (filteredBooks.length === 0) return;
        const delta = rawBtn === 'R2' ? 10 : -10;
        const target =
          rawBtn === 'R2'
            ? safeSelectedIndex === filteredBooks.length - 1
              ? 0
              : Math.min(filteredBooks.length - 1, safeSelectedIndex + delta)
            : safeSelectedIndex === 0
              ? filteredBooks.length - 1
              : Math.max(0, safeSelectedIndex + delta);
        sfx.playFolderSwitch();
        setSelectedIndex(target);
        showToast(
          `${rawBtn === 'R2' ? '+10 cuốn' : '-10 cuốn'} · Vị trí ${target + 1}/${filteredBooks.length}`
        );
      } else if (rawBtn === 'Y') {
        const cur = LIBRARY_VIEW_MODES.findIndex((m) => m.id === viewMode);
        const next = (cur + 1) % LIBRARY_VIEW_MODES.length;
        selectViewMode(LIBRARY_VIEW_MODES[next].id);
      } else if (rawBtn === 'START') {
        sfx.playToggle();
        setSettingsOpen(true);
      } else if (rawBtn === 'X') {
        const target = filteredBooks[safeSelectedIndex];
        if (target) {
          sfx.playToggle();
          setInfoBookId(target.id);
        }
      } else if (rawBtn === 'A') {
        const target = filteredBooks[safeSelectedIndex];
        if (target) openBook(target);
      } else if (
        rawBtn === 'LEFT' ||
        rawBtn === 'RIGHT' ||
        rawBtn === 'UP' ||
        rawBtn === 'DOWN'
      ) {
        if (filteredBooks.length === 0) return;

        if (viewMode === 'sphere' && (rawBtn === 'UP' || rawBtn === 'DOWN')) {
          sfx.playHover();
          setSphereTilt((t) => t + (rawBtn === 'UP' ? -1 : 1));
          return;
        }

        const isRowGrid = viewMode === 'grid' || viewMode === 'bookshelf';
        const step =
          rawBtn === 'LEFT'
            ? -1
            : rawBtn === 'RIGHT'
              ? 1
              : isRowGrid
                ? rawBtn === 'UP'
                  ? -5
                  : 5
                : rawBtn === 'UP'
                  ? -1
                  : 1;

        const nextIdx =
          (safeSelectedIndex + step + filteredBooks.length) % filteredBooks.length;
        if (nextIdx !== safeSelectedIndex) {
          sfx.playHover();
          setSelectedIndex(nextIdx);
        }
      }
    },
    [
      activeBook,
      activeBookBookmarks,
      activeBookChapters,
      activeFolder,
      buildPersistedPayload,
      closeBook,
      cycleRotation,
      cycleZoom,
      exitConfirmOpen,
      exitedToRocknix,
      filteredBooks,
      flashButton,
      folderTabs,
      guideSubTab,
      handleRescanBooks,
      handleSearchKeyPress,
      handleSelectSearchResult,
      infoBook,
      isNative,
      jumpChapter,
      jumpToPage,
      openBook,
      quickMenuIndex,
      quickMenuOpen,
      removeBookmarkPage,
      restartBookFromBeginning,
      safeSearchResultIdx,
      safeSelectedIndex,
      scrubByPercent,
      searchKeyCol,
      searchKeyRow,
      searchOpen,
      searchResults,
      selectFolder,
      selectViewMode,
      settings.brightness,
      settings.fontSize,
      settings.pageTurnMode,
      settings.readerTheme,
      settings.rotation,
      settings.sfxEnabled,
      settings.sfxVolume,
      settings.showHints,
      settings.sortBy,
      settings.twoPageSpread,
      settings.warmth,
      settingsOpen,
      settingsRow,
      settingsTab,
      showReaderHud,
      showToast,
      tocIndex,
      tocOpen,
      tocTab,
      toggleBookmark,
      toggleFavorite,
      toggleTwoPageLayout,
      triggerL2R2Bookmark,
      turnPage,
      updateSettings,
      viewMode,
      zoomLevel,
    ]
  );

  // Keyboard listener (supports direct letter typing inside SearchModal too)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) {
        return;
      }

      if (searchOpen) {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          handleButton('UP');
          return;
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          handleButton('DOWN');
          return;
        }
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          handleButton('LEFT');
          return;
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          handleButton('RIGHT');
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          handleButton('B');
          return;
        }
        if (e.key === 'Backspace') {
          e.preventDefault();
          handleSearchKeyPress('⌫');
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          handleButton('A');
          return;
        }
        if (e.key === 'Tab') {
          e.preventDefault();
          handleButton('START');
          return;
        }
        if (e.key === ' ') {
          e.preventDefault();
          handleSearchKeyPress('SPACE');
          return;
        }
        if (/^[a-z0-9]$/i.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          handleSearchKeyPress(e.key.toUpperCase());
          return;
        }
      }

      const key = e.key.toLowerCase();
      let mapped: HandheldButton | null = null;

      if (e.key === 'ArrowUp' || key === 'w') mapped = 'UP';
      else if (e.key === 'ArrowDown' || key === 's') mapped = 'DOWN';
      else if (e.key === 'ArrowLeft' || key === 'a') mapped = 'LEFT';
      else if (e.key === 'ArrowRight' || key === 'd') mapped = 'RIGHT';
      else if (e.key === 'Enter' || e.key === ' ') mapped = 'A';
      else if (e.key === 'Escape' || e.key === 'Backspace') mapped = 'B';
      else if (key === 'x') mapped = 'X';
      else if (key === 'y') mapped = 'Y';
      else if (key === 'q' || e.key === '[') mapped = 'L1';
      else if (key === 'e' || e.key === ']') mapped = 'R1';
      else if (key === '1') {
        heldTriggersRef.current.L2 = true;
        if (heldTriggersRef.current.R2) {
          e.preventDefault();
          triggerL2R2Bookmark();
          return;
        }
        mapped = 'L2';
      } else if (key === '2') {
        heldTriggersRef.current.R2 = true;
        if (heldTriggersRef.current.L2) {
          e.preventDefault();
          triggerL2R2Bookmark();
          return;
        }
        mapped = 'R2';
      }
      else if (key === 'z') mapped = 'R3';
      else if (e.key === 'Shift') mapped = 'SELECT';
      else if (e.key === 'Tab') mapped = 'START';
      else if (key === 'r' && activeBook) {
        e.preventDefault();
        cycleRotation();
        return;
      }

      if (mapped) {
        e.preventDefault();
        handleButton(mapped);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === '1') heldTriggersRef.current.L2 = false;
      else if (key === '2') heldTriggersRef.current.R2 = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [activeBook, cycleRotation, handleButton, handleSearchKeyPress, searchOpen, triggerL2R2Bookmark]);

  // Real USB / Bluetooth / Embedded X55 Gamepad + Left Analog Polling Support
  const prevPadButtonsRef = useRef<boolean[]>([]);
  const prevAxisTimeRef = useRef<{ dir: HandheldButton | null; time: number }>({
    dir: null,
    time: 0,
  });
  const handleButtonRef = useRef(handleButton);
  handleButtonRef.current = handleButton;
  const handleTriggerComboRef = useRef(triggerL2R2Bookmark);
  handleTriggerComboRef.current = triggerL2R2Bookmark;

  useEffect(() => {
    let rafId = 0;
    const pollGamepad = () => {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      let pad: Gamepad | null = null;
      for (let i = 0; i < pads.length; i++) {
        if (pads[i] && pads[i]!.connected) {
          pad = pads[i];
          break;
        }
      }
      if (pad) {
        if (!nativeGamepadActiveRef.current) {
          const l2Now = Boolean(pad.buttons[6]?.pressed);
          const r2Now = Boolean(pad.buttons[7]?.pressed);
          const l2Was = Boolean(prevPadButtonsRef.current[6]);
          const r2Was = Boolean(prevPadButtonsRef.current[7]);
          heldTriggersRef.current.L2 = l2Now;
          heldTriggersRef.current.R2 = r2Now;

          const mapping: [number, HandheldButton][] = [
            [0, 'B'],
            [1, 'A'],
            [2, 'Y'],
            [3, 'X'],
            [4, 'L1'],
            [5, 'R1'],
            [6, 'L2'],
            [7, 'R2'],
            [8, 'SELECT'],
            [9, 'START'],
            [11, 'R3'],
            [12, 'UP'],
            [13, 'DOWN'],
            [14, 'LEFT'],
            [15, 'RIGHT'],
          ];
          if (l2Now && r2Now && (!l2Was || !r2Was)) {
            handleTriggerComboRef.current();
          }
          mapping.forEach(([idx, btn]) => {
            const pressed = Boolean(pad!.buttons[idx]?.pressed);
            const wasPressed = Boolean(prevPadButtonsRef.current[idx]);
            if (pressed && !wasPressed) {
              if ((idx === 6 || idx === 7) && l2Now && r2Now) {
                // Already handled as L2+R2 chord above
              } else {
                handleButtonRef.current(btn);
              }
            }
            prevPadButtonsRef.current[idx] = pressed;
          });

          // Fallback HAT axes when Linux evdev maps D-Pad onto axes[6..7] or axes[4..5]
          if (pad.buttons.length <= 12) {
            const hatX = pad.axes[6] ?? pad.axes[4] ?? 0;
            const hatY = pad.axes[7] ?? pad.axes[5] ?? 0;
            const hatFlags: [number, boolean, HandheldButton][] = [
              [20, hatY < -0.5, 'UP'],
              [21, hatY > 0.5, 'DOWN'],
              [22, hatX < -0.5, 'LEFT'],
              [23, hatX > 0.5, 'RIGHT'],
            ];
            hatFlags.forEach(([slot, pressed, btn]) => {
              const wasPressed = Boolean(prevPadButtonsRef.current[slot]);
              if (pressed && !wasPressed) {
                handleButtonRef.current(btn);
              }
              prevPadButtonsRef.current[slot] = pressed;
            });
          }
        }

        // Left Analog Stick support (axes 0 & 1) with deadzone 0.58 & repeat delay 220ms
        const axX = pad.axes[0] ?? 0;
        const axY = pad.axes[1] ?? 0;
        let axisBtn: HandheldButton | null = null;
        if (Math.abs(axX) > Math.abs(axY)) {
          if (axX < -0.58) axisBtn = 'LEFT';
          else if (axX > 0.58) axisBtn = 'RIGHT';
        } else {
          if (axY < -0.58) axisBtn = 'UP';
          else if (axY > 0.58) axisBtn = 'DOWN';
        }
        const now = performance.now();
        if (axisBtn) {
          if (
            prevAxisTimeRef.current.dir !== axisBtn ||
            now - prevAxisTimeRef.current.time > 220
          ) {
            handleButtonRef.current(axisBtn);
            prevAxisTimeRef.current = { dir: axisBtn, time: now };
          }
        } else {
          prevAxisTimeRef.current = { dir: null, time: 0 };
        }
      }
      rafId = window.requestAnimationFrame(pollGamepad);
    };

    rafId = window.requestAnimationFrame(pollGamepad);
    return () => window.cancelAnimationFrame(rafId);
  }, []);

  return (
    <HandheldShell
      activeButtons={activeButtons}
      expandedScreen={expandedScreen}
      nativeFullscreen={isNative}
      onToggleExpand={() => setExpandedScreen((s) => !s)}
      onPressButton={handleButton}
    >
      {exitedToRocknix ? (
        <div className="animate-tab-fade flex h-full w-full flex-col items-center justify-center bg-gradient-to-b from-[#0f1624] to-[#06080d] text-slate-200 select-none">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-300 ring-1 ring-sky-400/35">
            <Power className="h-6 w-6" />
          </div>
          <h2 className="font-display text-lg font-semibold text-white">
            ROCKNIX · Danh mục Ports
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Bạn đã thoát CozyRead và trở về màn hình chính của máy X55.
          </p>
          <button
            type="button"
            onClick={() => {
              sfx.playOpenBook();
              setExitedToRocknix(false);
            }}
            className="mt-5 rounded-lg bg-sky-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-sky-400 transition-colors"
          >
            [A] Mở lại CozyRead
          </button>
        </div>
      ) : activeBook ? (
        <ReaderView
          book={activeBook}
          settings={settings}
          showHud={showReaderHud}
          quickMenuOpen={quickMenuOpen}
          quickMenuIndex={quickMenuIndex}
          tocOpen={tocOpen}
          tocTab={tocTab}
          tocIndex={tocIndex}
          zoomLevel={zoomLevel}
          panOffset={panOffset}
          turnAnimKey={turnAnimKey}
          turnDirection={turnDirection}
          turnFromPage={turnFromPage}
          clockText={clockText}
          batteryInfo={batteryInfo}
          toastText={toastText}
          onToggleHud={() => {
            sfx.playToggle();
            setShowReaderHud((s) => !s);
          }}
          onRotateScreen={cycleRotation}
          onTurnPage={turnPage}
          onJumpToPage={jumpToPage}
          onToggleBookmark={toggleBookmark}
          onRemoveBookmark={removeBookmarkPage}
          onToggleTwoPage={toggleTwoPageLayout}
          onToggleQuickMenu={() => {
            sfx.playToggle();
            setQuickMenuOpen((q) => !q);
          }}
          onToggleToc={() => {
            sfx.playToggle();
            setTocOpen((t) => {
              const next = !t;
              if (next) {
                setTocTab('chapters');
                setTocIndex(getCurrentChapterInfo(activeBook).chapterIdx);
              }
              return next;
            });
          }}
          onChangeTocTab={(tab) => {
            sfx.playFolderSwitch();
            setTocTab(tab);
            setTocIndex(
              tab === 'chapters' ? getCurrentChapterInfo(activeBook).chapterIdx : 0
            );
          }}
          onUpdateSettings={updateSettings}
          onToggleZoom={cycleZoom}
          onCloseBook={closeBook}
        />
      ) : (
        <LibraryStage
          books={filteredBooks}
          folderTabs={folderTabs}
          activeFolder={activeFolder}
          viewMode={viewMode}
          selectedIndex={safeSelectedIndex}
          sphereTilt={sphereTilt}
          settings={settings}
          clockText={clockText}
          batteryInfo={batteryInfo}
          toastText={toastText}
          onSelectFolder={selectFolder}
          onSelectViewMode={selectViewMode}
          onSelectIndex={(idx) => {
            sfx.playHover();
            setSelectedIndex(idx);
          }}
          onOpenBook={openBook}
          onOpenInfo={(book) => {
            sfx.playToggle();
            setInfoBookId(book.id);
          }}
          onOpenSearch={() => {
            sfx.playToggle();
            setSearchQuery('');
            setSearchResultIdx(0);
            setSearchOpen(true);
          }}
          onOpenSettings={() => {
            sfx.playToggle();
            setSettingsOpen(true);
          }}
          onRequestExit={() => {
            sfx.playToggle();
            setExitConfirmOpen(true);
          }}
        />
      )}

      {searchOpen && !activeBook && !exitedToRocknix && (
        <SearchModal
          query={searchQuery}
          results={searchResults}
          selectedResultIndex={safeSearchResultIdx}
          keyRow={searchKeyRow}
          keyCol={searchKeyCol}
          activeFolderLabel={activeFolderLabel}
          onPressKey={handleSearchKeyPress}
          onSelectResult={handleSelectSearchResult}
          onClose={() => {
            sfx.playToggle();
            setSearchOpen(false);
          }}
        />
      )}

      {infoBook && !activeBook && !exitedToRocknix && (
        <BookInfoModal
          book={infoBook}
          scrollSignal={infoScrollSignal}
          onReadBook={() => openBook(infoBook)}
          onRestartBook={() => restartBookFromBeginning(infoBook)}
          onToggleFavorite={() => toggleFavorite(infoBook.id)}
          onClose={() => {
            sfx.playToggle();
            setInfoBookId(null);
          }}
        />
      )}

      {settingsOpen && !activeBook && !exitedToRocknix && (
        <SettingsModal
          settings={settings}
          viewMode={viewMode}
          activeTab={settingsTab}
          guideSubTab={guideSubTab}
          guideScrollSignal={guideScrollSignal}
          activeRow={settingsRow}
          isRescanning={isRescanning}
          rescanStatus={rescanStatus}
          onChangeTab={(tab) => {
            sfx.playFolderSwitch();
            setSettingsTab(tab);
          }}
          onChangeGuideSubTab={(sub) => {
            sfx.playToggle();
            setGuideSubTab(sub);
          }}
          onUpdateSettings={updateSettings}
          onChangeViewMode={selectViewMode}
          onRescanBooks={handleRescanBooks}
          onClose={() => {
            sfx.playToggle();
            setSettingsOpen(false);
          }}
        />
      )}

      {openingAnim && activeBook && !exitedToRocknix && (
        <div
          key={openingAnim.key}
          className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center overflow-hidden perspective-1400"
        >
          <div className="animate-book-open-backdrop absolute inset-0 bg-[#050811]/78 backdrop-blur-xs" />
          <div
            onAnimationEnd={() => setOpeningAnim(null)}
            className="animate-book-open-cover relative w-[205px] aspect-[3/4] rounded-xl shadow-[0_28px_70px_rgba(0,0,0,0.88)]"
          >
            <BookCover
              book={openingAnim.book}
              showProgress={false}
              className="h-full w-full rounded-xl ring-1 ring-sky-300/45"
            />
          </div>
        </div>
      )}

      {exitConfirmOpen && !activeBook && !exitedToRocknix && (
        <div className="animate-backdrop-in absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs">
          <div className="animate-modal-pop w-[380px] rounded-xl border border-white/15 bg-[#101520]/96 p-4 text-center text-slate-100 shadow-2xl">
            <div className="mx-auto mb-2.5 flex h-10 w-10 items-center justify-center rounded-full bg-rose-500/15 text-rose-300 ring-1 ring-rose-400/35">
              <LogOut className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-semibold text-white">Thoát ứng dụng CozyRead?</h3>
            <p className="mt-1 text-xs text-slate-400">
              Tiến độ đọc và đánh dấu trang đã được tự động lưu lại.
            </p>
            <div className="mt-4 flex items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  sfx.playToggle();
                  setExitConfirmOpen(false);
                }}
                className="rounded-lg bg-white/10 px-3.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/15 transition-colors"
              >
                [B] Ở lại
              </button>
              <button
                type="button"
                onClick={() => {
                  sfx.playCloseBook();
                  setExitConfirmOpen(false);
                  if (isNative && window.rocknixNative) {
                    void window.rocknixNative.saveState(buildPersistedPayload()).finally(() => {
                      void window.rocknixNative?.quitApp();
                    });
                  } else {
                    setExitedToRocknix(true);
                  }
                }}
                className="rounded-lg bg-rose-500 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-400 transition-colors"
              >
                [A] Thoát về ROCKNIX
              </button>
            </div>
          </div>
        </div>
      )}
    </HandheldShell>
  );
}
