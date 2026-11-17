"""Fetch public administrative geography only; never reads any case or employee data.

Reproducible, pinned geoBoundaries gbOpen TUN ADM1 simplified geometry.
The source describes 2017 boundaries, not an official current CDIS registry.
"""
import hashlib
import json
from pathlib import Path
from urllib.request import urlopen

ROOT=Path(__file__).resolve().parents[1]
SOURCE='https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/TUN/ADM1/geoBoundaries-TUN-ADM1_simplified.geojson'

def main():
    raw=urlopen(SOURCE,timeout=45).read()
    data=json.loads(raw)
    catalogue=json.loads((ROOT/'config/governorates.json').read_text(encoding='utf-8'))
    assert len(data['features'])==24
    assert {f['properties']['shapeISO'] for f in data['features']}=={g['id'] for g in catalogue}
    data['metadata']={
        'source':'geoBoundaries gbOpen TUN ADM1; OpenStreetMap contributors / Wambacher',
        'boundaryID':'TUN-ADM1-13205935','boundaryYear':2017,
        'sourceUrl':SOURCE,'sourceSha256':hashlib.sha256(raw).hexdigest(),
        'license':'ODbL-1.0 (source boundaries); CC-BY-4.0 (geoBoundaries attribution)',
        'licenseUrls':['https://opendatacommons.org/licenses/odbl/1-0/','https://creativecommons.org/licenses/by/4.0/'],
        'changes':'JSON minification and addition of provenance only; coordinates unchanged.'
    }
    target=ROOT/'public/geography/tunisia-governorates.geojson'
    target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
    print(f'24 ISO governorates; {target.stat().st_size} bytes; source SHA256 {data["metadata"]["sourceSha256"]}')

if __name__=='__main__':main()
