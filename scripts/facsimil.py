#!/usr/bin/env python3
"""
Generador determinista de facsímiles PNG (art. 13 TRLPI) a partir de PDFs oficiales
(BOE, Diario de Sesiones del Congreso/Senado, JEC, Tribunal de Cuentas, CENDOJ).

Uso:
  python scripts/facsimil.py --pdf <ruta_o_url> --out <ruta.png> [--page 1] [--dpi 145] [--crop-top 0.0] [--crop-bottom 0.62]

Salida JSON por stdout con sha256 del PDF original, dimensiones y ruta generada.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import pathlib
import sys
import urllib.request

import pymupdf
from PIL import Image, ImageOps


def download_or_read(pdf_arg: str, cache_dir: pathlib.Path) -> tuple[pathlib.Path, str]:
    if pdf_arg.startswith("http://") or pdf_arg.startswith("https://"):
        req = urllib.request.Request(
            pdf_arg,
            headers={
                "User-Agent": "LaInvariante/0.1 (archivo documental; +https://lainvariante.es)"
            },
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = resp.read()
        sha = hashlib.sha256(data).hexdigest()
        cache_dir.mkdir(parents=True, exist_ok=True)
        cached = cache_dir / sha
        if not cached.exists():
            cached.write_bytes(data)
        return cached, sha

    p = pathlib.Path(pdf_arg)
    if not p.exists():
        raise FileNotFoundError(f"PDF no encontrado: {p}")
    data = p.read_bytes()
    sha = hashlib.sha256(data).hexdigest()
    return p, sha


def render_facsimile(
    pdf_path: pathlib.Path,
    out_path: pathlib.Path,
    page_num: int,
    dpi: int,
    crop_top: float,
    crop_bottom: float,
    max_width: int,
) -> tuple[int, int, int]:
    doc = pymupdf.open(pdf_path)
    try:
        idx = max(0, min(page_num - 1, len(doc) - 1))
        page = doc[idx]
        rect = page.rect
        y0 = rect.y0 + rect.height * max(0.0, min(crop_top, 0.95))
        y1 = rect.y0 + rect.height * max(crop_top + 0.05, min(crop_bottom, 1.0))
        clip = pymupdf.Rect(rect.x0, y0, rect.x1, y1)

        zoom = dpi / 72.0
        mat = pymupdf.Matrix(zoom, zoom)
        pix = page.get_pixmap(matrix=mat, clip=clip, alpha=False)
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)

        # Escala de grises limpia con contraste documental (sin tintes amarillentos ni peso excesivo)
        img = ImageOps.grayscale(img)
        img = ImageOps.autocontrast(img, cutoff=1)

        if img.width > max_width:
            ratio = max_width / float(img.width)
            img = img.resize((max_width, int(img.height * ratio)), Image.Resampling.LANCZOS)

        # Cuantización a 16 tonos de gris para PNG muy ligero y nítido en texto escaneado
        img = img.quantize(colors=16, dither=Image.Dither.NONE)

        out_path.parent.mkdir(parents=True, exist_ok=True)
        img.save(out_path, format="PNG", optimize=True)
        size_bytes = out_path.stat().st_size
        return img.width, img.height, size_bytes
    finally:
        doc.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="Renderiza facsímiles PNG ligeros desde PDF oficial.")
    parser.add_argument("--pdf", required=True, help="URL o ruta local al PDF oficial")
    parser.add_argument("--out", required=True, help="Ruta destino del PNG (ej. site/public/facsimiles/1978/ES-1978-FIN-001.png)")
    parser.add_argument("--page", type=int, default=1, help="Número de página (1-indexado)")
    parser.add_argument("--dpi", type=int, default=150, help="Resolución de renderizado")
    parser.add_argument("--crop-top", type=float, default=0.0, help="Fracción superior de recorte (0.0-0.95)")
    parser.add_argument("--crop-bottom", type=float, default=0.68, help="Fracción inferior de recorte (0.05-1.0)")
    parser.add_argument("--max-width", type=int, default=1100, help="Ancho máximo en píxeles")
    parser.add_argument("--cache-dir", default=".cache/docs", help="Directorio de caché de PDFs")
    args = parser.parse_args()

    pdf_path, sha = download_or_read(args.pdf, pathlib.Path(args.cache_dir))
    out_path = pathlib.Path(args.out)
    w, h, size_bytes = render_facsimile(
        pdf_path,
        out_path,
        page_num=args.page,
        dpi=args.dpi,
        crop_top=args.crop_top,
        crop_bottom=args.crop_bottom,
        max_width=args.max_width,
    )

    print(
        json.dumps(
            {
                "ok": True,
                "pdf_sha256": sha,
                "out": str(out_path).replace(os.sep, "/"),
                "page": args.page,
                "width": w,
                "height": h,
                "bytes": size_bytes,
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
