import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ArrowUpDown,
  BookOpen,
  Eye,
  EyeOff,
  FolderOpen,
  FolderSync,
  Gamepad2,
  Info,
  LayoutGrid,
  Library,
  MessageCircle,
  RefreshCw,
  Settings,
  User,
  Volume1,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  AppSettings,
  LIBRARY_SORT_MODES,
  LIBRARY_VIEW_MODES,
  LibrarySortMode,
  LibraryViewMode,
} from '../data/books';

export type SettingsTab = 'general' | 'controls' | 'about';
export type GuideSubTab = 'keys' | 'copy';

interface SettingsModalProps {
  settings: AppSettings;
  viewMode: LibraryViewMode;
  activeTab: SettingsTab;
  guideSubTab: GuideSubTab;
  guideScrollSignal: { dir: -1 | 1; seq: number };
  activeRow: number;
  isRescanning: boolean;
  rescanStatus: string | null;
  onChangeTab: (tab: SettingsTab) => void;
  onChangeGuideSubTab: (sub: GuideSubTab) => void;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  onChangeViewMode: (mode: LibraryViewMode) => void;
  onRescanBooks: () => void;
  onClose: () => void;
}

const CONTROL_ROWS_LIBRARY: [string, string][] = [
  ['D-Pad / Analog Trái', 'Di chuyển chọn sách'],
  ['L1 / R1', 'Chuyển nhanh Tab Thư mục'],
  ['L2 / R2', 'Nhảy nhanh ±10 cuốn sách'],
  ['Nút A', 'Mở đọc cuốn sách đang chọn'],
  ['Nút B', 'Tìm sách (Bàn phím ảo / Chữ cái đầu)'],
  ['Nút Y', 'Đổi 8 kiểu giao diện 2D / 3D'],
  ['Nút X', 'Thông tin & Thêm vào Yêu thích'],
  ['Select / Start', 'Thoát app (⏻) / Cài đặt (⚙️)'],
];

const CONTROL_ROWS_READER: [string, string][] = [
  ['D-Pad Trái / Phải', 'Lật 1 trang (hoặc soi góc khi Zoom)'],
  ['D-Pad Lên / Xuống', 'Tua nhanh 10% (hoặc soi góc khi Zoom)'],
  ['Analog Phải (R3)', 'Phóng to: 100% → 125 → 150 → 200 → 300%'],
  ['L1 / R1', 'Nhảy Chương trước / Chương sau'],
  ['L2 / R2', 'Lùi / Tua nhanh 5 trang'],
  ['L2 + R2 (đồng thời)', 'Đánh dấu / Gỡ đánh dấu trang'],
  ['Nút A', 'Xoay màn hình 0° / 90° / 180° / 270°'],
  ['Nút Select', 'Ẩn / Hiện thanh trạng thái (tự thu phóng)'],
  ['Nút X / Y / Start', 'Đổi 1↔2 trang / Mục lục / Tùy chỉnh nhanh'],
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  viewMode,
  activeTab,
  guideSubTab,
  guideScrollSignal,
  activeRow,
  isRescanning,
  rescanStatus,
  onChangeTab,
  onChangeGuideSubTab,
  onUpdateSettings,
  onChangeViewMode,
  onRescanBooks,
  onClose,
}) => {
  const copyScrollRef = useRef<HTMLDivElement | null>(null);
  const bodyContentRef = useRef<HTMLDivElement | null>(null);
  const [bodyHeight, setBodyHeight] = useState<number | null>(null);
  const [copyScrollBar, setCopyScrollBar] = useState<{ topPct: number; heightPct: number }>({
    topPct: 0,
    heightPct: 38,
  });

  useLayoutEffect(() => {
    const el = bodyContentRef.current;
    if (!el) return;
    const measure = () => {
      const next = Math.ceil(el.getBoundingClientRect().height);
      if (next > 0) {
        setBodyHeight((prev) => (prev === next ? prev : next));
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [activeTab, guideSubTab, rescanStatus]);

  const syncCopyScrollBar = useCallback(() => {
    const el = copyScrollRef.current;
    if (!el || el.scrollHeight <= el.clientHeight) {
      setCopyScrollBar({ topPct: 0, heightPct: 100 });
      return;
    }
    const heightPct = Math.max(16, Math.round((el.clientHeight / el.scrollHeight) * 100));
    const maxTop = 100 - heightPct;
    const progress = el.scrollTop / Math.max(1, el.scrollHeight - el.clientHeight);
    setCopyScrollBar({
      topPct: Math.max(0, Math.min(maxTop, progress * maxTop)),
      heightPct,
    });
  }, []);

  useEffect(() => {
    if (activeTab !== 'controls' || guideSubTab !== 'copy') return;
    const raf = window.requestAnimationFrame(syncCopyScrollBar);
    return () => window.cancelAnimationFrame(raf);
  }, [activeTab, guideSubTab, syncCopyScrollBar]);

  useEffect(() => {
    if (activeTab !== 'controls' || guideSubTab !== 'copy') return;
    if (guideScrollSignal.seq === 0) return;
    copyScrollRef.current?.scrollBy({
      top: guideScrollSignal.dir * 86,
      behavior: 'smooth',
    });
  }, [activeTab, guideScrollSignal, guideSubTab]);

  return (
    <div className="animate-backdrop-in absolute inset-0 z-50 flex items-center justify-center bg-black/68 backdrop-blur-xs">
      <div className="animate-modal-pop w-[584px] rounded-xl border border-white/15 bg-[#0f141e]/96 p-4 text-slate-100 shadow-2xl">
        {/* Header + Tabs */}
        <div className="mb-3 flex items-center justify-between gap-3 border-b border-white/10 pb-2.5">
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => onChangeTab('general')}
              className={`inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[11.5px] font-medium whitespace-nowrap shrink-0 transition-colors ${
                activeTab === 'general'
                  ? 'bg-sky-500/20 text-sky-200 ring-1 ring-sky-400/50'
                  : 'text-slate-400 ring-1 ring-transparent hover:bg-white/6 hover:text-white'
              }`}
            >
              <Settings className="h-3.5 w-3.5 shrink-0" />
              <span>Cài đặt</span>
            </button>

            <button
              type="button"
              onClick={() => onChangeTab('controls')}
              className={`inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[11.5px] font-medium whitespace-nowrap shrink-0 transition-colors ${
                activeTab === 'controls'
                  ? 'bg-amber-500/20 text-amber-200 ring-1 ring-amber-400/50'
                  : 'text-slate-400 ring-1 ring-transparent hover:bg-white/6 hover:text-white'
              }`}
            >
              <BookOpen className="h-3.5 w-3.5 shrink-0" />
              <span>Hướng dẫn</span>
            </button>

            <button
              type="button"
              onClick={() => onChangeTab('about')}
              className={`inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[11.5px] font-medium whitespace-nowrap shrink-0 transition-colors ${
                activeTab === 'about'
                  ? 'bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400/50'
                  : 'text-slate-400 ring-1 ring-transparent hover:bg-white/6 hover:text-white'
              }`}
            >
              <Info className="h-3.5 w-3.5 shrink-0" />
              <span>About</span>
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0 whitespace-nowrap">
            <span className="font-mono-hud text-[10px] text-slate-400 whitespace-nowrap">
              [L1/R1] Đổi tab
            </span>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-6 items-center rounded bg-white/10 px-2 font-mono-hud text-[10px] text-slate-300 hover:bg-white/20 whitespace-nowrap shrink-0"
            >
              [B] Đóng
            </button>
          </div>
        </div>

        {/* Smoothly Animated Height Body Container */}
        <div
          className="-mx-[2px] overflow-hidden transition-[height] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={bodyHeight !== null ? { height: `${bodyHeight}px` } : undefined}
        >
          <div ref={bodyContentRef} className="p-[2px]">
            {activeTab === 'general' ? (
          <div key="general" className="animate-tab-fade space-y-1.5 text-xs">
            {/* Row 0: SFX Enable */}
            <div
              className={`flex items-center justify-between rounded-lg px-3 py-2 transition-all duration-150 ${
                activeRow === 0 ? 'bg-sky-500/18 ring-1 ring-sky-400/55' : 'bg-white/4'
              }`}
            >
              <div className="flex items-center gap-2">
                {settings.sfxEnabled ? (
                  <Volume2 className="h-4 w-4 text-sky-300" />
                ) : (
                  <VolumeX className="h-4 w-4 text-slate-500" />
                )}
                <div>
                  <div className="font-medium text-white">Âm thanh hiệu ứng (SFX)</div>
                  <div className="text-[10px] text-slate-400">
                    Tiếng chọn sách, lật trang, gập sách, đánh dấu
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onUpdateSettings({ sfxEnabled: !settings.sfxEnabled })}
                className={`rounded-md px-3 py-1 font-medium transition-colors ${
                  settings.sfxEnabled
                    ? 'bg-emerald-500/25 text-emerald-200 ring-1 ring-emerald-400/40'
                    : 'bg-white/10 text-slate-400'
                }`}
              >
                {settings.sfxEnabled ? 'Đang bật' : 'Đã tắt'}
              </button>
            </div>

            {/* Row 1: SFX Volume */}
            <div
              className={`flex items-center justify-between rounded-lg px-3 py-2 transition-all duration-150 ${
                activeRow === 1 ? 'bg-sky-500/18 ring-1 ring-sky-400/55' : 'bg-white/4'
              }`}
            >
              <div className="flex items-center gap-2">
                <Volume1 className="h-4 w-4 text-sky-300" />
                <span className="font-medium text-white">Âm lượng hiệu ứng</span>
              </div>
              <div className="flex items-center gap-2.5">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(settings.sfxVolume * 100)}
                  onChange={(e) => onUpdateSettings({ sfxVolume: Number(e.target.value) / 100 })}
                  className="w-32 accent-sky-400"
                />
                <span className="font-mono-hud w-9 text-right text-sky-300">
                  {Math.round(settings.sfxVolume * 100)}%
                </span>
              </div>
            </div>

            {/* Row 2: Library View Style */}
            <div
              className={`flex items-center justify-between rounded-lg px-3 py-1.5 transition-all duration-150 ${
                activeRow === 2 ? 'bg-sky-500/18 ring-1 ring-sky-400/55' : 'bg-white/4'
              }`}
            >
              <div className="flex items-center gap-2">
                <LayoutGrid className="h-4 w-4 text-indigo-300" />
                <span className="font-medium text-white">Kiểu giao diện Thư viện</span>
              </div>
              <select
                value={viewMode}
                onChange={(e) => {
                  onChangeViewMode(e.target.value as LibraryViewMode);
                  e.currentTarget.blur();
                }}
                className="rounded bg-slate-800 px-2.5 py-1 text-xs text-sky-200 ring-1 ring-white/15 outline-none"
              >
                {LIBRARY_VIEW_MODES.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Row 3: Library Sort Order */}
            <div
              className={`flex items-center justify-between rounded-lg px-3 py-1.5 transition-all duration-150 ${
                activeRow === 3 ? 'bg-sky-500/18 ring-1 ring-sky-400/55' : 'bg-white/4'
              }`}
            >
              <div className="flex items-center gap-2">
                <ArrowUpDown className="h-4 w-4 text-emerald-300" />
                <span className="font-medium text-white">Sắp xếp sách trong thư mục</span>
              </div>
              <select
                value={settings.sortBy}
                onChange={(e) => {
                  onUpdateSettings({ sortBy: e.target.value as LibrarySortMode });
                  e.currentTarget.blur();
                }}
                className="rounded bg-slate-800 px-2.5 py-1 text-xs text-emerald-200 ring-1 ring-white/15 outline-none"
              >
                {LIBRARY_SORT_MODES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Row 4: Show Button Hints */}
            <div
              className={`flex items-center justify-between rounded-lg px-3 py-2 transition-all duration-150 ${
                activeRow === 4 ? 'bg-sky-500/18 ring-1 ring-sky-400/55' : 'bg-white/4'
              }`}
            >
              <div className="flex items-center gap-2">
                {settings.showHints ? (
                  <Eye className="h-4 w-4 text-cyan-300" />
                ) : (
                  <EyeOff className="h-4 w-4 text-slate-500" />
                )}
                <span className="font-medium text-white">Hiển thị thanh Gợi ý phím</span>
              </div>
              <button
                type="button"
                onClick={() => onUpdateSettings({ showHints: !settings.showHints })}
                className={`rounded-md px-3 py-1 font-medium transition-colors ${
                  settings.showHints
                    ? 'bg-emerald-500/25 text-emerald-200 ring-1 ring-emerald-400/40'
                    : 'bg-white/10 text-slate-400'
                }`}
              >
                {settings.showHints ? 'Hiển thị' : 'Ẩn'}
              </button>
            </div>

            {/* Row 5: Rescan Books Directory & Rebuild Local Cache */}
            <div
              className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 transition-all duration-150 ${
                activeRow === 5 ? 'bg-sky-500/18 ring-1 ring-sky-400/55' : 'bg-white/4'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <FolderSync className="h-4 w-4 text-amber-300 shrink-0" />
                <div className="min-w-0">
                  <div className="font-medium text-white">Quét lại thư mục Books</div>
                  <div className="truncate text-[10px] text-slate-400">
                    {rescanStatus || 'Cập nhật cache tại ports/cozyread/data/cache.json'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onRescanBooks}
                disabled={isRescanning}
                className="flex items-center gap-1.5 rounded-md bg-amber-500/20 px-3 py-1 font-medium text-amber-200 ring-1 ring-amber-400/40 hover:bg-amber-500/30 transition-colors shrink-0"
              >
                <RefreshCw className={`h-3 w-3 ${isRescanning ? 'animate-spin' : ''}`} />
                <span>{isRescanning ? 'Đang quét...' : '[A] Quét lại'}</span>
              </button>
            </div>
          </div>
        ) : activeTab === 'controls' ? (
          <div key="controls" className="animate-tab-fade space-y-2.5">
            {/* Sub-tab switcher inside Hướng dẫn */}
            <div className="flex items-center justify-between gap-2">
              <div className="inline-flex items-center gap-1 rounded-lg bg-white/4 p-0.5 ring-1 ring-white/8">
                <button
                  type="button"
                  onClick={() => onChangeGuideSubTab('keys')}
                  className={`inline-flex h-6 items-center gap-1.5 rounded-md px-2.5 text-[10.5px] font-medium whitespace-nowrap transition-colors ${
                    guideSubTab === 'keys'
                      ? 'bg-sky-500/22 text-sky-200 ring-1 ring-sky-400/45'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Gamepad2 className="h-3 w-3 shrink-0" />
                  <span>Hướng dẫn phím</span>
                </button>
                <button
                  type="button"
                  onClick={() => onChangeGuideSubTab('copy')}
                  className={`inline-flex h-6 items-center gap-1.5 rounded-md px-2.5 text-[10.5px] font-medium whitespace-nowrap transition-colors ${
                    guideSubTab === 'copy'
                      ? 'bg-amber-500/22 text-amber-200 ring-1 ring-amber-400/45'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <FolderOpen className="h-3 w-3 shrink-0" />
                  <span>Hướng dẫn copy sách</span>
                </button>
              </div>

              <span className="font-mono-hud text-[9.5px] text-slate-400 whitespace-nowrap">
                {guideSubTab === 'copy' ? '[◀▶] Đổi mục · [▲▼] Cuộn' : '[◀▶] Đổi mục'}
              </span>
            </div>

            {guideSubTab === 'keys' ? (
              <div key="guide-keys" className="animate-tab-fade grid grid-cols-2 gap-3 text-[10px]">
                <div className="rounded-lg bg-white/4 p-2.5 ring-1 ring-white/8">
                  <div className="mb-1.5 font-semibold text-sky-300">Tại Thư viện sách</div>
                  <div className="space-y-1">
                    {CONTROL_ROWS_LIBRARY.map(([k, v]) => (
                      <div key={k} className="flex items-start justify-between gap-2">
                        <span className="font-mono-hud text-white shrink-0">{k}</span>
                        <span className="text-right text-slate-300">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg bg-white/4 p-2.5 ring-1 ring-white/8">
                  <div className="mb-1.5 font-semibold text-amber-300">Khi đang đọc sách</div>
                  <div className="space-y-1">
                    {CONTROL_ROWS_READER.map(([k, v]) => (
                      <div key={k} className="flex items-start justify-between gap-2">
                        <span className="font-mono-hud text-white shrink-0">{k}</span>
                        <span className="text-right text-slate-300">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div key="guide-copy" className="animate-tab-fade relative">
                <div
                  ref={copyScrollRef}
                  onScroll={syncCopyScrollBar}
                  className="no-scrollbar max-h-[268px] space-y-2 overflow-y-auto pr-3 text-[10.5px] leading-relaxed text-slate-300"
                >
                <div className="rounded-lg bg-white/4 p-2.5 ring-1 ring-white/8">
                  <div className="mb-1 font-semibold text-sky-300">
                    1. Thư mục quét & Cách chia Tab
                  </div>
                  <ul className="space-y-1 text-slate-300">
                    <li>
                      • Đường dẫn gốc trên X55:{' '}
                      <span className="font-mono-hud text-white">/storage/roms/books/</span> (tự tạo khi mở app lần đầu).
                    </li>
                    <li>
                      • Quét đệ quy toàn bộ thư mục con; tự bỏ qua file/thư mục ẩn bắt đầu bằng dấu{' '}
                      <span className="font-mono-hud text-white">.</span> hoặc{' '}
                      <span className="font-mono-hud text-white">__MACOSX</span> và thư mục rỗng.
                    </li>
                    <li>
                      • <strong className="text-white">Thứ tự Tab:</strong> 3 tab hệ thống cố định luôn đứng đầu (
                      <span className="text-sky-200">Tất cả</span> →{' '}
                      <span className="text-sky-200">Đang đọc</span> →{' '}
                      <span className="text-sky-200">★ Yêu thích</span>), tiếp theo là từng{' '}
                      <strong className="text-white">thư mục cấp 1</strong> xếp theo bảng chữ cái tiếng Việt. Thư mục con sâu hơn sẽ gom vào tab cấp 1; file đặt thẳng ngoài{' '}
                      <span className="font-mono-hud text-white">books/</span> vào tab{' '}
                      <span className="text-sky-200">Thư mục gốc</span>.
                    </li>
                  </ul>
                </div>

                <div className="rounded-lg bg-white/4 p-2.5 ring-1 ring-white/8">
                  <div className="mb-1 font-semibold text-emerald-300">
                    2. Định dạng sách hỗ trợ
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                    <div>
                      <span className="font-mono-hud font-semibold text-white">.epub</span> — Sách chữ EPUB2/EPUB3, tự tách chương & phân trang
                    </div>
                    <div>
                      <span className="font-mono-hud font-semibold text-white">.pdf</span> — Tài liệu PDF, dựng trang nét cao & đọc meta ngầm
                    </div>
                    <div>
                      <span className="font-mono-hud font-semibold text-white">.cbz</span> — Truyện tranh ZIP chứa ảnh JPG, PNG, WEBP
                    </div>
                    <div>
                      <span className="font-mono-hud font-semibold text-white">.txt</span> — Văn bản thuần UTF-8, tự chia đoạn & phân trang
                    </div>
                  </div>
                </div>

                <div className="rounded-lg bg-white/4 p-2.5 ring-1 ring-white/8">
                  <div className="mb-1 font-semibold text-amber-300">
                    3. Mức độ ưu tiên đọc Ảnh bìa (Cover)
                  </div>
                  <ul className="space-y-1">
                    <li>
                      • <strong className="text-amber-200">Ưu tiên #1 (Cao nhất):</strong> Ảnh rời{' '}
                      <strong className="text-white">cùng tên file, cùng thư mục</strong> với sách (
                      <span className="font-mono-hud text-white">.jpg .jpeg .png .webp</span> — vd:{' '}
                      <span className="font-mono-hud text-slate-200">DeMen.epub</span> +{' '}
                      <span className="font-mono-hud text-slate-200">DeMen.jpg</span>). Dùng cho mọi định dạng, kể cả TXT và PDF.
                    </li>
                    <li>
                      • <strong className="text-white">Ưu tiên #2:</strong> Ảnh nhúng trong file — EPUB tìm{' '}
                      <span className="font-mono-hud text-slate-200">cover-image</span> →{' '}
                      <span className="font-mono-hud text-slate-200">&lt;meta name=&quot;cover&quot;&gt;</span> → ảnh có chữ{' '}
                      <span className="font-mono-hud text-slate-200">cover</span>; CBZ lấy trang ảnh đầu tiên; PDF trích xuất trang 1 chạy nền.
                    </li>
                    <li>
                      • <strong className="text-white">Ưu tiên #3:</strong> Tự tạo bìa đồ họa tối giản kèm tên sách nếu không có ảnh.
                    </li>
                  </ul>
                </div>

                <div className="rounded-lg bg-white/4 p-2.5 ring-1 ring-white/8">
                  <div className="mb-1 font-semibold text-sky-300">
                    4. Cách đọc Tên sách, Tác giả & Số trang
                  </div>
                  <ul className="space-y-1">
                    <li>
                      • <strong className="text-white">EPUB:</strong> Đọc{' '}
                      <span className="font-mono-hud text-slate-200">dc:title / dc:creator / dc:description</span> trong OPF; ước lượng ~1.120 ký tự/trang khi quét và phân trang chuẩn khi mở đọc.
                    </li>
                    <li>
                      • <strong className="text-white">CBZ:</strong> Tên sách lấy theo tên file (đổi <span className="font-mono-hud text-slate-200">_</span> thành khoảng trắng), tác giả <span className="text-slate-200">Truyện Tranh</span>, số trang = tổng số ảnh hợp lệ (xếp tự nhiên 1, 2, 10...).
                    </li>
                    <li>
                      • <strong className="text-white">PDF / TXT:</strong> PDF đọc ngầm Title, Author & số trang thực bằng bộ giải mã PDF; TXT lấy tên file và tính trang theo độ dài văn bản (~1.120 ký tự/trang).
                    </li>
                  </ul>
                </div>

                <div className="rounded-lg bg-white/4 p-2.5 ring-1 ring-white/8">
                  <div className="mb-1 font-semibold text-emerald-300">
                    5. Cache & Giữ tiến trình khi chép thêm sách
                  </div>
                  <p>
                    Danh mục & bìa lưu ở <span className="font-mono-hud text-white">data/cache.json</span> và{' '}
                    <span className="font-mono-hud text-white">cache/thumbs/</span>; tiến trình đọc lưu riêng tại{' '}
                    <span className="font-mono-hud text-white">data/progress.json</span> (sao lưu tại{' '}
                    <span className="font-mono-hud text-white">books/.cozyread_progress.json</span>). Khi chép thêm sách mới và bấm{' '}
                    <strong className="text-white">Quét lại thư mục Books</strong>, tiến trình đọc của sách cũ vẫn giữ nguyên; sách đã xóa khỏi thẻ nhớ sẽ tự gỡ khỏi danh sách và dọn ảnh cache thừa.
                  </p>
                </div>
                </div>

                {/* Ultra-thin translucent vertical scroll indicator */}
                {copyScrollBar.heightPct < 100 && (
                  <div className="pointer-events-none absolute top-1 bottom-1 right-0.5 w-[2.5px] rounded-full bg-white/8">
                    <div
                      className="absolute inset-x-0 rounded-full bg-white/35 transition-[top] duration-100 ease-out"
                      style={{
                        top: `${copyScrollBar.topPct}%`,
                        height: `${copyScrollBar.heightPct}%`,
                      }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div key="about" className="animate-tab-fade space-y-2.5 text-xs">
            <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-sky-500/12 via-slate-900/70 to-emerald-500/12 p-3 ring-1 ring-white/10">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/20 text-sky-300 ring-1 ring-sky-400/40">
                  <Library className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-display text-sm font-bold text-white">CozyRead</div>
                  <div className="text-[10.5px] text-slate-300">
                    Ứng dụng đọc sách Native tối ưu cho Powkiddy X55 (ROCKNIX)
                  </div>
                </div>
              </div>
              <span className="rounded-md bg-emerald-500/20 px-2.5 py-1 font-mono-hud text-[10.5px] font-semibold text-emerald-200 ring-1 ring-emerald-400/35">
                v1.0.0
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="rounded-lg bg-white/4 px-3 py-2 ring-1 ring-white/8">
                <div className="text-[10px] text-slate-400">Định dạng hỗ trợ</div>
                <div className="mt-0.5 font-mono-hud font-semibold text-sky-200">
                  EPUB · PDF · CBZ · TXT
                </div>
              </div>
              <div className="rounded-lg bg-white/4 px-3 py-2 ring-1 ring-white/8">
                <div className="text-[10px] text-slate-400">Nền tảng</div>
                <div className="mt-0.5 font-medium text-white">
                  ROCKNIX ARM64 · Web Simulator
                </div>
              </div>
              <div className="col-span-2 rounded-lg bg-white/4 px-3 py-2 ring-1 ring-white/8">
                <div className="text-[10px] text-slate-400">Tính năng nổi bật</div>
                <div className="mt-0.5 text-slate-200">
                  8 kiểu thư viện 2D/3D · Hiệu ứng lật trang 3D · Zoom 300% · Xoay 4 hướng · Điều khiển 100% phím vật lý
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-white/4 px-3.5 py-2.5 ring-1 ring-white/8">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/18 text-amber-300 ring-1 ring-amber-400/35">
                  <User className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-[10px] text-slate-400">Tác giả & Phát triển</div>
                  <div className="text-xs font-semibold text-white">Nguyễn Mai Thăng</div>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="text-right">
                  <div className="text-[10px] text-slate-400">Liên hệ Zalo</div>
                  <div className="font-mono-hud text-xs font-semibold text-white">
                    0981224492
                  </div>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-500/18 text-sky-300 ring-1 ring-sky-400/35">
                  <MessageCircle className="h-4 w-4" />
                </div>
              </div>
            </div>
          </div>
        )}
          </div>
        </div>
      </div>
    </div>
  );
};
