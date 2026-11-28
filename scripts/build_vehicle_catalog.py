"""Build a local vehicle photo catalog from reviewable CC0 Commons candidates.
Usage: python scripts/build_vehicle_catalog.py Honda CR-V 2022
Requires: pip install 'rembg[cpu]' pillow requests
Review output in vehicle-photo-review/ before using --approve.
Only approve a correct vehicle/year, clean cutout, no watermark, and verified rights.
"""
import argparse
import io
import json
import os
from pathlib import Path
import re
import requests
from PIL import Image
from rembg import remove, new_session

ROOT = Path(__file__).resolve().parents[1]
def slug(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')

p = argparse.ArgumentParser()
p.add_argument('make')
p.add_argument('model')
p.add_argument('year', type=int)
p.add_argument('--approve', type=int, help='Approve a previously generated candidate number')
a = p.parse_args()
key = f'{a.year}-{slug(a.make)}-{slug(a.model)}'
if not 1900 <= a.year <= 2100 or not slug(a.make) or not slug(a.model):
    p.error('Invalid vehicle')
review = ROOT / 'vehicle-photo-review' / key
dest = ROOT / 'public' / 'vehicle-catalog'
if a.approve is not None:
    meta = json.loads((review / f'{a.approve}.json').read_text())
    if meta['license'] != 'CC0':
        raise SystemExit('Unapproved license')
    dest.mkdir(parents=True, exist_ok=True)
    (dest / f'{key}.webp').write_bytes((review / f'{a.approve}.webp').read_bytes())
    (dest / f'{key}.json').write_text(json.dumps(meta, indent=2))
    print('Approved:', key)
    raise SystemExit

contact = os.environ.get('COMMONS_CONTACT')
if not contact:
    raise SystemExit('Set COMMONS_CONTACT to your contact email for Wikimedia requests.')
session = requests.Session()
session.headers['User-Agent'] = f'BandWhipVehicleCatalog/1.0 ({contact})'
response = session.get('https://commons.wikimedia.org/w/api.php', params={
    'action':'query','generator':'search','gsrnamespace':6,
    'gsrsearch':f'"{a.make}" "{a.model}" "{a.year}" filetype:bitmap',
    'gsrlimit':30,'prop':'imageinfo','iiprop':'url|extmetadata',
    'iiurlwidth':1200,'format':'json'}, timeout=30)
response.raise_for_status()
review.mkdir(parents=True, exist_ok=True)
model_session = new_session('u2net')
count = 0
for page in response.json().get('query',{}).get('pages',{}).values():
    info = page.get('imageinfo',[{}])[0]
    md = info.get('extmetadata',{})
    if md.get('LicenseShortName',{}).get('value') != 'CC0':
        continue
    title = page.get('title','')
    if str(a.year) not in title or slug(a.model) not in slug(title):
        continue
    url = info.get('thumburl') or info.get('url')
    if not url or not url.startswith(('https://upload.wikimedia.org/','https://thumb.wikimedia.org/')):
        continue
    try:
        photo = session.get(url, timeout=30)
        photo.raise_for_status()
        im = Image.open(io.BytesIO(photo.content)).convert('RGB')
        if im.width < 600 or im.width < im.height:
            continue
        cut = remove(im, session=model_session).convert('RGBA')
        bounds = cut.getbbox()
        if not bounds:
            continue
        cut = cut.crop(bounds)
        cut.thumbnail((1000,580), Image.Resampling.LANCZOS)
        canvas = Image.new('RGBA',(1200,720),'white')
        canvas.alpha_composite(cut,((1200-cut.width)//2,(720-cut.height)//2))
        count += 1
        canvas.convert('RGB').save(review / f'{count}.webp', quality=90)
        (review / f'{count}.json').write_text(json.dumps({'title':title,'license':'CC0','source':info.get('descriptionurl'),'author':md.get('Artist',{}).get('value',''),'vehicle':key},indent=2))
        if count >= 5: break
    except Exception as e:
        print('Skipped', title, str(e))
print(f'{count} candidates in {review}. Review visually, then run again with --approve NUMBER.')
