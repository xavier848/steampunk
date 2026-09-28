#!/usr/bin/env python3
"""Contact sheet: python3 tools/contact.py <dir> <out.jpg> [cols] [width]
Tiles every PNG/JPG in <dir> (sorted by name) with its file name as a label."""
import sys, os
from PIL import Image, ImageDraw, ImageFont
d, out = sys.argv[1], sys.argv[2]
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 4
tw = int(sys.argv[4]) if len(sys.argv) > 4 else 480
files = sorted(f for f in os.listdir(d) if f.lower().endswith(('.png', '.jpg')) and not f.startswith('sheet'))
if not files:
    sys.exit('no images')
first = Image.open(os.path.join(d, files[0]))
th = int(tw * first.height / first.width)
rows = (len(files) + cols - 1) // cols
sheet = Image.new('RGB', (cols * tw, rows * (th + 18)), (20, 16, 14))
try:
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 12)
except Exception:
    font = ImageFont.load_default()
draw = ImageDraw.Draw(sheet)
for i, f in enumerate(files):
    im = Image.open(os.path.join(d, f)).convert('RGB').resize((tw, th), Image.LANCZOS)
    x, y = (i % cols) * tw, (i // cols) * (th + 18)
    sheet.paste(im, (x, y + 18))
    draw.text((x + 4, y + 2), os.path.splitext(f)[0][:60], fill=(230, 210, 170), font=font)
sheet.save(out, quality=88)
print(out, sheet.size)
