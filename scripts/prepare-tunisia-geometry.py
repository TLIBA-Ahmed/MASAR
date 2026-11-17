"""Build a small, local Tunisia geometry from public-domain Natural Earth data.

This development utility downloads public geography only. No business data is read.
"""
import hashlib
import json
from pathlib import Path
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
SOURCE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson'


def main():
    with urlopen(SOURCE, timeout=60) as response:
        raw = response.read()
    feature = next(f for f in json.loads(raw)['features'] if f['properties']['ADM0_A3'] == 'TUN')
    geometry = feature['geometry']
    polygons = geometry['coordinates'] if geometry['type'] == 'MultiPolygon' else [geometry['coordinates']]
    polygons = [[[[round(x, 5), round(y, 5)] for x, y in ring] for ring in polygon] for polygon in polygons]
    asset = {'source': 'Natural Earth, Admin 0, 1:50m', 'license': 'Public domain',
             'sourceUrl': SOURCE, 'licenseUrl': 'https://www.naturalearthdata.com/about/terms-of-use/',
             'sourceSha256': hashlib.sha256(raw).hexdigest(), 'bbox': feature['bbox'],
             'type': 'MultiPolygon', 'coordinates': polygons}
    target = ROOT/'src/features/child-journey/geo/tunisia.json'
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(asset, ensure_ascii=False, separators=(',', ':'))+'\n', encoding='utf-8')
    print(f'Tunisia: {len(polygons)} polygons, {sum(len(r) for p in polygons for r in p)} vertices, {target.stat().st_size} bytes.')


if __name__ == '__main__':
    main()
