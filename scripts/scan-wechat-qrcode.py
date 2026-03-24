#!/usr/bin/env python3
"""使用 OpenCV WeChatQRCode 扫描单张图片中的二维码/小程序码。"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from urllib.request import urlretrieve


MODEL_FILES = {
    "detect.prototxt": "https://raw.githubusercontent.com/WeChatCV/opencv_3rdparty/a8b69ccc738421293254aec5ddb38bd523503252/detect.prototxt",
    "detect.caffemodel": "https://raw.githubusercontent.com/WeChatCV/opencv_3rdparty/a8b69ccc738421293254aec5ddb38bd523503252/detect.caffemodel",
    "sr.prototxt": "https://raw.githubusercontent.com/WeChatCV/opencv_3rdparty/a8b69ccc738421293254aec5ddb38bd523503252/sr.prototxt",
    "sr.caffemodel": "https://raw.githubusercontent.com/WeChatCV/opencv_3rdparty/a8b69ccc738421293254aec5ddb38bd523503252/sr.caffemodel",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("image_path")
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--download-models", action="store_true")
    parser.add_argument("--model-dir")
    return parser.parse_args()


def emit(payload: dict, use_json: bool) -> int:
    if use_json:
      print(json.dumps(payload, ensure_ascii=False))
    else:
      print(payload)
    return 0


def resolve_model_dir(arg_value: str | None) -> Path:
    if arg_value:
        return Path(arg_value).expanduser().resolve()

    env_value = os.environ.get("WECHAT_QRCODE_MODEL_DIR")
    if env_value:
        return Path(env_value).expanduser().resolve()

    return (Path(__file__).resolve().parents[1] / ".cache" / "wechat-qrcode-models").resolve()


def ensure_models(model_dir: Path, allow_download: bool) -> tuple[bool, str | None]:
    model_dir.mkdir(parents=True, exist_ok=True)
    missing = [name for name in MODEL_FILES if not (model_dir / name).exists()]

    if not missing:
        return True, None

    if not allow_download:
        return False, f"missing model files: {', '.join(missing)}"

    for name in missing:
        urlretrieve(MODEL_FILES[name], model_dir / name)

    return True, None


def main() -> int:
    args = parse_args()
    image_path = Path(args.image_path).resolve()

    try:
        import cv2  # type: ignore
    except Exception as error:  # pragma: no cover
        return emit({
            "detected": False,
            "text": None,
            "backend": "opencv-python",
            "reason": f"cv2 unavailable: {error}",
        }, args.json)

    if not image_path.exists():
        return emit({
            "detected": False,
            "text": None,
            "backend": "opencv-python",
            "reason": f"image not found: {image_path}",
        }, args.json)

    detector = None
    detector_reason = None

    try:
        detector = cv2.wechat_qrcode_WeChatQRCode()
    except Exception as error:
        detector_reason = str(error)

    if detector is None:
        model_dir = resolve_model_dir(args.model_dir)
        ok, model_error = ensure_models(model_dir, args.download_models)
        if not ok:
            return emit({
                "detected": False,
                "text": None,
                "backend": "opencv-python",
                "reason": detector_reason or model_error,
                "modelDir": str(model_dir),
            }, args.json)

        try:
            detector = cv2.wechat_qrcode_WeChatQRCode(
                str(model_dir / "detect.prototxt"),
                str(model_dir / "detect.caffemodel"),
                str(model_dir / "sr.prototxt"),
                str(model_dir / "sr.caffemodel"),
            )
        except Exception as error:
            return emit({
                "detected": False,
                "text": None,
                "backend": "opencv-python",
                "reason": f"failed to init WeChatQRCode: {error}",
                "modelDir": str(model_dir),
            }, args.json)

    image = cv2.imread(str(image_path))
    if image is None:
        return emit({
            "detected": False,
            "text": None,
            "backend": "opencv-python",
            "reason": "failed to read image",
        }, args.json)

    texts, _ = detector.detectAndDecode(image)
    first_text = next((text for text in texts if text), None)

    return emit({
        "detected": bool(first_text),
        "text": first_text,
        "backend": "opencv-python",
    }, args.json)


if __name__ == "__main__":
    sys.exit(main())
