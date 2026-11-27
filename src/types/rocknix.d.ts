import {
  AppSettings,
  BookItem,
  BookPage,
  FolderId,
  LibraryViewMode,
  PdfMetaDetails,
  PdfOutlineItem,
} from '../data/books';

export interface RocknixBatteryInfo {
  level: number;
  charging: boolean;
}

export interface RocknixPersistedBookState {
  currentPage: number;
  hasOpened?: boolean;
  lastOpenedAt?: number;
  readingSeconds?: number;
  favorite: boolean;
  bookmarks: number[];
}

export interface RocknixPersistedState {
  settings?: Partial<AppSettings>;
  activeFolder?: FolderId;
  viewMode?: LibraryViewMode;
  selectedIndex?: number;
  selectedBookId?: string | null;
  activeBookId?: string | null;
  sphereTilt?: number;
  showReaderHud?: boolean;
  books?: Record<string, RocknixPersistedBookState>;
}

export interface RocknixFolderTab {
  id: FolderId;
  label: string;
}

export interface RocknixInitPayload {
  books: BookItem[];
  folders: RocknixFolderTab[];
  persisted: RocknixPersistedState;
  battery: RocknixBatteryInfo;
  booksDir: string;
  dataDir: string;
  firstScanPerformed: boolean;
  hasNativeGamepad?: boolean;
}

export interface RocknixRescanPayload {
  books: BookItem[];
  folders: RocknixFolderTab[];
  folderCount: number;
}

export interface RocknixBridge {
  isNative: true;
  init: () => Promise<RocknixInitPayload>;
  rescanBooks: () => Promise<RocknixRescanPayload>;
  saveState: (state: RocknixPersistedState) => Promise<boolean>;
  loadBookPages: (bookId: string) => Promise<BookPage[]>;
  readBookBytes: (bookId: string) => Promise<Uint8Array>;
  savePdfMeta: (payload: {
    id: string;
    totalPages: number;
    title?: string;
    author?: string;
    thumbDataUrl?: string;
    pdfMeta?: PdfMetaDetails;
    pdfChapters?: PdfOutlineItem[];
  }) => Promise<{ coverImage?: string }>;
  getBattery: () => Promise<RocknixBatteryInfo>;
  quitApp: () => Promise<void>;
  onNativeButton?: (callback: (btn: string) => void) => () => void;
}

declare global {
  interface Window {
    rocknixNative?: RocknixBridge;
  }
}
