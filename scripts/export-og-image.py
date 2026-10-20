#!/usr/bin/env python3
"""Exporta imagem Open Graph para PNG 1200×630. Dependência só no ambiente de produção de arte."""
from pathlib import Path
import sys
try:
    import cairosvg
except ImportError:
    sys.exit("Instale CairoSVG no computador de exportação: python -m pip install cairosvg")
source = Path(__file__).resolve().parent.parent / "HydroCasa_ESP32_LittleFS1.0.0-20261001T112649Z-1-001" / "HydroCasa_ESP32_LittleFS1.0.0" / "data" / "hydrocasa-og.svg"
target = source.with_suffix(".png")
cairosvg.svg2png(url=str(source), write_to=str(target), output_width=1200, output_height=630)
print(f"Imagem criada: {target} ({target.stat().st_size / 1024:.1f} KiB)")
if target.stat().st_size > 1_000_000:
    sys.exit("A imagem excede 1 MB: comprima antes de publicar.")
