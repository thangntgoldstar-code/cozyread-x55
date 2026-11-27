#!/bin/bash
# CozyRead Native Launcher for Powkiddy X55 (ROCKNIX)
# Place CozyRead.sh and cozyread/ inside /storage/roms/ports/

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PORT_DIR="${SCRIPT_DIR}/cozyread"
BOOKS_DIR="/storage/roms/books"

# Keep ALL app config, cache, thumbnails and home dotfiles strictly inside PORT_DIR (zero system junk)
mkdir -p \
  "${PORT_DIR}/data" \
  "${PORT_DIR}/cache/thumbs" \
  "${PORT_DIR}/.home" \
  "${PORT_DIR}/.xdg/config" \
  "${PORT_DIR}/.xdg/data" \
  "${PORT_DIR}/.xdg/cache" \
  "${BOOKS_DIR}"

export COZYREAD_PORT_DIR="${PORT_DIR}"
export COZYREAD_BOOKS_DIR="${BOOKS_DIR}"
export HOME="${PORT_DIR}/.home"
export XDG_CONFIG_HOME="${PORT_DIR}/.xdg/config"
export XDG_DATA_HOME="${PORT_DIR}/.xdg/data"
export XDG_CACHE_HOME="${PORT_DIR}/.xdg/cache"
export ELECTRON_DISABLE_SECURITY_WARNINGS=true

# Auto-detect ROCKNIX Sway / Wayland runtime directory & active socket
if [ -z "${XDG_RUNTIME_DIR:-}" ] || [ ! -d "${XDG_RUNTIME_DIR}" ]; then
  for candidate in /run/user/0 /var/run/user/0 /run/user/1000 /tmp; do
    if ls "${candidate}"/wayland-* >/dev/null 2>&1; then
      export XDG_RUNTIME_DIR="${candidate}"
      break
    fi
  done
  export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/0}"
fi

if [ -z "${WAYLAND_DISPLAY:-}" ]; then
  for sock in "${XDG_RUNTIME_DIR}"/wayland-*; do
    [ -S "$sock" ] || continue
    case "$sock" in
      *.lock) continue ;;
    esac
    export WAYLAND_DISPLAY="$(basename "$sock")"
    break
  done
fi

# Bundled runtime shared libraries for ROCKNIX rootfs compatibility
export LD_LIBRARY_PATH="${PORT_DIR}/libs:${LD_LIBRARY_PATH:-}"

# Enable ALSA / PipeWire audio if available
export SDL_AUDIODRIVER="${SDL_AUDIODRIVER:-alsa}"

chmod +x "${PORT_DIR}/cozyread" 2>/dev/null || true

EXTRA_FLAGS=()
if [ -n "${WAYLAND_DISPLAY:-}" ]; then
  EXTRA_FLAGS+=(
    --ozone-platform=wayland
    --enable-features=UseOzonePlatform
    --use-gl=angle
    --use-angle=gles
    --ignore-gpu-blocklist
  )
else
  EXTRA_FLAGS+=(
    --ozone-platform-hint=auto
    --enable-features=UseOzonePlatform
    --ignore-gpu-blocklist
  )
fi

exec "${PORT_DIR}/cozyread" \
  --no-sandbox \
  --disable-dev-shm-usage \
  --disable-gpu-sandbox \
  --autoplay-policy=no-user-gesture-required \
  "${EXTRA_FLAGS[@]}" \
  >"${PORT_DIR}/data/launch.log" 2>&1
