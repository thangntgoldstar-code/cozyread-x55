import React from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';

export type HandheldButton =
  | 'UP'
  | 'DOWN'
  | 'LEFT'
  | 'RIGHT'
  | 'A'
  | 'B'
  | 'X'
  | 'Y'
  | 'L1'
  | 'R1'
  | 'L2'
  | 'R2'
  | 'R3'
  | 'SELECT'
  | 'START';

interface HandheldShellProps {
  activeButtons: Set<HandheldButton>;
  expandedScreen: boolean;
  nativeFullscreen?: boolean;
  onToggleExpand: () => void;
  onPressButton: (btn: HandheldButton) => void;
  children: React.ReactNode;
}

export const HandheldShell: React.FC<HandheldShellProps> = ({
  activeButtons,
  expandedScreen,
  nativeFullscreen = false,
  onToggleExpand,
  onPressButton,
  children,
}) => {
  if (nativeFullscreen) {
    return (
      <div className="relative h-screen w-screen overflow-hidden bg-black select-none">
        {children}
      </div>
    );
  }

  const isPressed = (btn: HandheldButton) => activeButtons.has(btn);

  return (
    <div className="flex min-h-screen flex-col items-center justify-between bg-[#090b10] px-4 py-3 text-slate-200">
      {/* Top Minimal Simulator Bar */}
      <div className="flex w-full max-w-[1220px] items-center justify-between gap-4 pb-2">
        <div className="flex items-center gap-3">
          <span className="font-display text-base font-semibold tracking-tight text-white">
            Powkiddy X55 · CozyRead Simulator
          </span>
          <span className="text-xs text-slate-400">
            ROCKNIX Native UI Preview · 1280×720
          </span>
        </div>

        <button
          type="button"
          onClick={onToggleExpand}
          className="flex items-center gap-1.5 rounded-lg bg-white/8 px-3 py-1.5 text-xs font-medium text-slate-200 ring-1 ring-white/12 hover:bg-white/14 transition-colors whitespace-nowrap shrink-0"
        >
          {expandedScreen ? (
            <>
              <Minimize2 className="h-3.5 w-3.5 text-sky-300" />
              <span>Hiện khung máy X55</span>
            </>
          ) : (
            <>
              <Maximize2 className="h-3.5 w-3.5 text-sky-300" />
              <span>Phóng to màn hình</span>
            </>
          )}
        </button>
      </div>

      {/* Main Device Frame or Expanded Screen */}
      {expandedScreen ? (
        <div className="flex w-full max-w-[1160px] flex-1 items-center justify-center py-1">
          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl border border-white/15 bg-black shadow-[0_24px_80px_rgba(0,0,0,0.85)]">
            {children}
          </div>
        </div>
      ) : (
        <div className="relative my-auto flex w-full max-w-[1180px] flex-col items-center">
          {/* Shoulder Triggers L2 / L1 ... R1 / R2 */}
          <div className="flex w-[92%] items-end justify-between px-6">
            <div className="flex items-center gap-2">
              <button
                type="button"
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onPressButton('L2')}
                className={`h-6 w-16 rounded-t-xl border-x border-t border-white/15 font-mono-hud text-[10px] font-semibold transition-all ${
                  isPressed('L2')
                    ? 'translate-y-0.5 bg-sky-500 text-slate-950'
                    : 'bg-[#1a1f29] text-slate-300 hover:bg-[#242b38]'
                }`}
              >
                L2
              </button>
              <button
                type="button"
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onPressButton('L1')}
                className={`h-7 w-20 rounded-t-xl border-x border-t border-white/15 font-mono-hud text-[11px] font-semibold transition-all ${
                  isPressed('L1')
                    ? 'translate-y-0.5 bg-sky-500 text-slate-950'
                    : 'bg-[#202633] text-slate-200 hover:bg-[#2a3242]'
                }`}
              >
                L1
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onPressButton('R1')}
                className={`h-7 w-20 rounded-t-xl border-x border-t border-white/15 font-mono-hud text-[11px] font-semibold transition-all ${
                  isPressed('R1')
                    ? 'translate-y-0.5 bg-sky-500 text-slate-950'
                    : 'bg-[#202633] text-slate-200 hover:bg-[#2a3242]'
                }`}
              >
                R1
              </button>
              <button
                type="button"
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onPressButton('R2')}
                className={`h-6 w-16 rounded-t-xl border-x border-t border-white/15 font-mono-hud text-[10px] font-semibold transition-all ${
                  isPressed('R2')
                    ? 'translate-y-0.5 bg-sky-500 text-slate-950'
                    : 'bg-[#1a1f29] text-slate-300 hover:bg-[#242b38]'
                }`}
              >
                R2
              </button>
            </div>
          </div>

          {/* X55 Matte Obsidian Body */}
          <div className="relative flex w-full items-center justify-between gap-4 rounded-[38px] border border-white/12 bg-gradient-to-b from-[#232834] via-[#181c25] to-[#12151c] p-4 shadow-[0_32px_90px_rgba(0,0,0,0.9),inset_0_1px_1px_rgba(255,255,255,0.12)]">
            {/* LEFT CONTROL GRIP */}
            <div className="flex w-[142px] shrink-0 flex-col items-center justify-between gap-6 py-3">
              {/* Left Analog Stick */}
              <div
                title="Analog Trái (Di chuyển)"
                className="flex h-14 w-14 items-center justify-center rounded-full bg-[#0e1117] shadow-inner ring-1 ring-white/10"
              >
                <div className="h-10 w-10 rounded-full bg-gradient-to-b from-[#2c3342] to-[#191d26] shadow-md ring-1 ring-white/15" />
              </div>

              {/* D-Pad */}
              <div className="relative h-24 w-24">
                <button
                  type="button"
                  tabIndex={-1}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onPressButton('UP')}
                  aria-label="D-Pad Lên"
                  className={`absolute top-0 left-1/3 flex h-8 w-8 items-center justify-center rounded-t-md border border-white/12 text-xs transition-all ${
                    isPressed('UP')
                      ? 'bg-sky-500 text-slate-950'
                      : 'bg-[#10141c] text-slate-400 hover:bg-[#272e3d] hover:text-white'
                  }`}
                >
                  ▲
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onPressButton('DOWN')}
                  aria-label="D-Pad Xuống"
                  className={`absolute bottom-0 left-1/3 flex h-8 w-8 items-center justify-center rounded-b-md border border-white/12 text-xs transition-all ${
                    isPressed('DOWN')
                      ? 'bg-sky-500 text-slate-950'
                      : 'bg-[#10141c] text-slate-400 hover:bg-[#272e3d] hover:text-white'
                  }`}
                >
                  ▼
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onPressButton('LEFT')}
                  aria-label="D-Pad Trái"
                  className={`absolute top-1/3 left-0 flex h-8 w-8 items-center justify-center rounded-l-md border border-white/12 text-xs transition-all ${
                    isPressed('LEFT')
                      ? 'bg-sky-500 text-slate-950'
                      : 'bg-[#10141c] text-slate-400 hover:bg-[#272e3d] hover:text-white'
                  }`}
                >
                  ◀
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onPressButton('RIGHT')}
                  aria-label="D-Pad Phải"
                  className={`absolute top-1/3 right-0 flex h-8 w-8 items-center justify-center rounded-r-md border border-white/12 text-xs transition-all ${
                    isPressed('RIGHT')
                      ? 'bg-sky-500 text-slate-950'
                      : 'bg-[#10141c] text-slate-400 hover:bg-[#272e3d] hover:text-white'
                  }`}
                >
                  ▶
                </button>
                <div className="pointer-events-none absolute top-1/3 left-1/3 h-8 w-8 bg-[#10141c]" />
              </div>

              {/* SELECT Button */}
              <button
                type="button"
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onPressButton('SELECT')}
                className={`rounded-full border border-white/15 px-3.5 py-1 font-mono-hud text-[10px] font-semibold tracking-wider transition-all ${
                  isPressed('SELECT')
                    ? 'scale-95 bg-sky-500 text-slate-950'
                    : 'bg-[#11151d] text-slate-300 hover:bg-[#252c3b]'
                }`}
              >
                SELECT
              </button>
            </div>

            {/* CENTER 5.5" 16:9 IPS SCREEN */}
            <div className="relative min-w-0 flex-1 rounded-xl bg-[#050608] p-2.5 shadow-[inset_0_0_16px_rgba(0,0,0,0.9)] ring-1 ring-white/10">
              <div className="relative aspect-[16/9] w-full overflow-hidden rounded-md bg-black">
                {children}
              </div>
            </div>

            {/* RIGHT CONTROL GRIP */}
            <div className="flex w-[142px] shrink-0 flex-col items-center justify-between gap-6 py-3">
              {/* ABXY Diamond */}
              <div className="relative h-24 w-24">
                <button
                  type="button"
                  tabIndex={-1}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onPressButton('Y')}
                  className={`absolute top-0 left-1/3 flex h-8 w-8 items-center justify-center rounded-full border border-white/15 font-mono-hud text-xs font-bold transition-all ${
                    isPressed('Y')
                      ? 'scale-92 bg-amber-400 text-slate-950'
                      : 'bg-[#121620] text-amber-300 hover:bg-[#283042]'
                  }`}
                  title="Phím Y"
                >
                  Y
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onPressButton('X')}
                  className={`absolute top-1/3 left-0 flex h-8 w-8 items-center justify-center rounded-full border border-white/15 font-mono-hud text-xs font-bold transition-all ${
                    isPressed('X')
                      ? 'scale-92 bg-sky-400 text-slate-950'
                      : 'bg-[#121620] text-sky-300 hover:bg-[#283042]'
                  }`}
                  title="Phím X"
                >
                  X
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onPressButton('A')}
                  className={`absolute top-1/3 right-0 flex h-8 w-8 items-center justify-center rounded-full border border-white/15 font-mono-hud text-xs font-bold transition-all ${
                    isPressed('A')
                      ? 'scale-92 bg-emerald-400 text-slate-950'
                      : 'bg-[#121620] text-emerald-300 hover:bg-[#283042]'
                  }`}
                  title="Phím A (Đọc / Xoay màn hình)"
                >
                  A
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onPressButton('B')}
                  className={`absolute bottom-0 left-1/3 flex h-8 w-8 items-center justify-center rounded-full border border-white/15 font-mono-hud text-xs font-bold transition-all ${
                    isPressed('B')
                      ? 'scale-92 bg-rose-400 text-slate-950'
                      : 'bg-[#121620] text-rose-300 hover:bg-[#283042]'
                  }`}
                  title="Phím B (Quay lại / Đóng)"
                >
                  B
                </button>
              </div>

              {/* Right Analog Stick (R3 Zoom) */}
              <button
                type="button"
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onPressButton('R3')}
                title="Analog Phải R3 (Phóng to / Thu nhỏ trang)"
                className={`flex h-14 w-14 items-center justify-center rounded-full bg-[#0e1117] shadow-inner ring-1 transition-all ${
                  isPressed('R3')
                    ? 'scale-95 ring-sky-400'
                    : 'ring-white/10 hover:ring-sky-400/50'
                }`}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-b from-[#2c3342] to-[#191d26] font-mono-hud text-[9px] text-slate-400 shadow-md ring-1 ring-white/15">
                  R3
                </div>
              </button>

              {/* START Button */}
              <button
                type="button"
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onPressButton('START')}
                className={`rounded-full border border-white/15 px-3.5 py-1 font-mono-hud text-[10px] font-semibold tracking-wider transition-all ${
                  isPressed('START')
                    ? 'scale-95 bg-sky-500 text-slate-950'
                    : 'bg-[#11151d] text-slate-300 hover:bg-[#252c3b]'
                }`}
              >
                START
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Keyboard & Gamepad Legend */}
      <div className="flex w-full max-w-[1220px] flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-2 text-[11px] text-slate-400">
        <span>
          <strong className="font-mono-hud text-slate-200">Mũi tên / WASD</strong> = D-Pad
        </span>
        <span>
          <strong className="font-mono-hud text-slate-200">Enter / Space</strong> = A (Mở / Xoay 90°)
        </span>
        <span>
          <strong className="font-mono-hud text-slate-200">Esc / Backspace</strong> = B
        </span>
        <span>
          <strong className="font-mono-hud text-slate-200">X / Y</strong> = X / Y
        </span>
        <span>
          <strong className="font-mono-hud text-slate-200">Q / E</strong> = L1 / R1
        </span>
        <span>
          <strong className="font-mono-hud text-slate-200">1 / 2</strong> = L2 / R2
        </span>
        <span>
          <strong className="font-mono-hud text-slate-200">Z</strong> = R3 (Zoom)
        </span>
        <span>
          <strong className="font-mono-hud text-slate-200">Shift</strong> = Select
        </span>
        <span>
          <strong className="font-mono-hud text-slate-200">Tab</strong> = Start
        </span>
      </div>
    </div>
  );
};
