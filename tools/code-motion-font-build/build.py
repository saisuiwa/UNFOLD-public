"""Rebuild local font files. Requires fontTools==4.60.2; checks source hashes."""
from pathlib import Path
import hashlib, io, json, urllib.request
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
root=Path(__file__).resolve().parents[2]/'app/vendor/motion-fonts'
for entry in json.loads((root/'sources.json').read_text()):
    data=urllib.request.urlopen(entry['source']).read()
    if hashlib.sha256(data).hexdigest()!=entry['sourceSHA256']:
        raise ValueError('Upstream changed: '+entry['key']+'; review before updating manifest')
    font=TTFont(io.BytesIO(data))
    if entry['weight']:
        font=instantiateVariableFont(font,{'wght':entry['weight']},inplace=True)
    font.save(root/(entry['key']+'.ttf'))
