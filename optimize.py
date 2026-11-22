#!/usr/bin/env python3
"""Word Alchemy loading optimization: externalize inlined PNG data URIs as WebP files.

Reads the artifact export (single-file HTML with base64 PNGs inlined), extracts
every unique inlined image, converts it to WebP (quality 90, visually verified
indistinguishable from the PNG originals on backgrounds, Momo and spirits),
writes content-addressed files under <deploy>/assets/img/, and rewrites the
data URIs to /assets/img/<sha12>.webp URLs in the deployed HTML.

The artifact and its export are NEVER modified; only the deploy dir is written.
Run this after every artifact.export, before `wrangler pages deploy`:
    python3 optimize.py
    python3 .../cf_wrangler.py pages deploy <deploy-dir> --project-name word-alchemy

Usage:
    python3 optimize.py [--export PATH] [--deploy DIR] [--quality 90]
Defaults:
    --export ~/workspace/your_files/daneo-yeongeumsul/daneo-yeongeumsul.html
    --deploy ~/workspace/deploy/word-alchemy
"""
import argparse
import base64
import hashlib
import io
import json
import os
import re
import sys
from pathlib import Path

from PIL import Image

DATA_URI_RE = re.compile(r'data:image/(png|jpe?g|webp);base64,([A-Za-z0-9+/=]+)')
SCRIPT_RE = re.compile(r'<script[^>]*>.*?</script>', re.S)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--export', default=str(
        Path.home() / 'workspace/your_files/daneo-yeongeumsul/daneo-yeongeumsul.html'))
    ap.add_argument('--deploy', default=str(
        Path.home() / 'workspace/deploy/word-alchemy'))
    ap.add_argument('--quality', type=int, default=90)
    args = ap.parse_args()

    export_path = Path(args.export)
    deploy_dir = Path(args.deploy)
    img_dir = deploy_dir / 'assets' / 'img'
    img_dir.mkdir(parents=True, exist_ok=True)

    html = export_path.read_text(encoding='utf-8')
    orig_bytes = len(html.encode('utf-8'))
    matches = DATA_URI_RE.findall(html)
    print(f'export: {export_path} ({orig_bytes:,} bytes)')
    print(f'data URIs found: {len(matches)}')

    # Dedupe by content hash of the decoded image bytes.
    unique = {}  # sha12 -> (full_data_uri, fmt, raw_png_bytes, occurrences)
    for fmt, b64 in matches:
        full = f'data:image/{fmt};base64,{b64}'
        try:
            raw = base64.b64decode(b64, validate=True)
        except Exception as e:
            print(f'  WARN skip undecodable URI ({fmt}): {e}', file=sys.stderr)
            continue
        sha = hashlib.sha256(raw).hexdigest()[:12]
        if sha in unique:
            unique[sha] = (unique[sha][0], unique[sha][1], unique[sha][2],
                           unique[sha][3] + 1)
        else:
            unique[sha] = (full, fmt, raw, 1)
    print(f'unique images: {len(unique)}')

    # Convert each unique image to WebP and write content-addressed files.
    manifest = {}
    total_webp = 0
    for sha, (full, fmt, raw, occ) in sorted(unique.items()):
        name = f'{sha}.webp'
        out_path = img_dir / name
        im = Image.open(io.BytesIO(raw))
        w, h = im.size
        if im.mode != 'RGBA':
            im = im.convert('RGBA')
        im.save(out_path, 'WEBP', quality=args.quality, method=6)
        webp_bytes = out_path.stat().st_size
        total_webp += webp_bytes
        manifest[name] = {
            'w': w, 'h': h, 'format': fmt,
            'png_bytes': len(raw), 'webp_bytes': webp_bytes,
            'occurrences': occ,
        }
        # Rewrite every occurrence of this data URI to the file URL.
        html = html.replace(full, f'/assets/img/{name}')

    # Remove stale WebP files no longer referenced.
    for old in img_dir.glob('*.webp'):
        if old.name not in manifest:
            old.unlink()
            print(f'  removed stale {old.name}')

    # First-load estimate: assets referenced outside <script> blocks (static HTML).
    static_html = SCRIPT_RE.sub('', html)
    first_load_imgs = set(re.findall(r'/assets/img/[0-9a-f]{12}\.webp', static_html))
    first_load_webp = sum(manifest[n.split('/')[-1]]['webp_bytes']
                          for n in first_load_imgs if n.split('/')[-1] in manifest)

    out_html = deploy_dir / 'index.html'
    out_html.write_text(html, encoding='utf-8')
    new_bytes = len(html.encode('utf-8'))
    (img_dir / 'manifest.json').write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False), encoding='utf-8')

    remaining = len(DATA_URI_RE.findall(html))
    print(f'optimized index.html: {new_bytes:,} bytes '
          f'({new_bytes / orig_bytes * 100:.1f}% of original)')
    print(f'WebP files: {len(manifest)} files, {total_webp:,} bytes total')
    print(f'remaining data URIs in output: {remaining}')
    print(f'first-load estimate: HTML {new_bytes:,} + '
          f'{len(first_load_imgs)} static assets {first_load_webp:,} = '
          f'{new_bytes + first_load_webp:,} bytes')
    if remaining:
        print('ERROR: data URIs remain in output', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
