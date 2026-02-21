#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUTPUT_DIR="$ROOT_DIR/video-output"

if [[ $# -lt 1 ]]; then
  echo "Usage: pnpm video:prepare -- <input.mp4> [start_time] [end_time]"
  exit 1
fi

INPUT_PATH="$1"
START_TIME="${2:-}"
END_TIME="${3:-}"

if [[ ! -f "$INPUT_PATH" ]]; then
  echo "[video] input file not found: $INPUT_PATH"
  exit 1
fi

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "[video] ffmpeg not found. Please install ffmpeg first."
  exit 1
fi

if ! command -v ffprobe >/dev/null 2>&1; then
  echo "[video] ffprobe not found. Please install ffprobe first."
  exit 1
fi

mkdir -p "$OUTPUT_DIR"

BASE_CLIP="$OUTPUT_DIR/_base_clip.mp4"
HQ_OUT="$OUTPUT_DIR/ppt-hq.mp4"
LITE_OUT="$OUTPUT_DIR/ppt-lite.mp4"
POSTER_OUT="$OUTPUT_DIR/poster.png"

TRIM_ARGS=()
if [[ -n "$START_TIME" ]]; then
  TRIM_ARGS+=("-ss" "$START_TIME")
fi
if [[ -n "$END_TIME" ]]; then
  TRIM_ARGS+=("-to" "$END_TIME")
fi

echo "[video] preparing base clip..."
ffmpeg -y "${TRIM_ARGS[@]}" -i "$INPUT_PATH" -c copy "$BASE_CLIP"

echo "[video] encoding HQ version..."
ffmpeg -y -i "$BASE_CLIP" \
  -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fps=30" \
  -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -movflags +faststart \
  -c:a aac -b:a 160k -ar 48000 \
  "$HQ_OUT"

echo "[video] encoding lite version..."
ffmpeg -y -i "$BASE_CLIP" \
  -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fps=30" \
  -c:v libx264 -preset medium -crf 25 -pix_fmt yuv420p -movflags +faststart \
  -c:a aac -b:a 128k -ar 48000 \
  "$LITE_OUT"

echo "[video] exporting poster frame..."
ffmpeg -y -ss 00:00:01 -i "$BASE_CLIP" -frames:v 1 "$POSTER_OUT"

echo "[video] output summary"
ffprobe -v error -show_entries format=filename,duration,size -of default=noprint_wrappers=1 "$HQ_OUT"
ffprobe -v error -show_entries format=filename,duration,size -of default=noprint_wrappers=1 "$LITE_OUT"

echo "[video] done:"
echo "  - $HQ_OUT"
echo "  - $LITE_OUT"
echo "  - $POSTER_OUT"
