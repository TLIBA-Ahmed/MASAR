"""Pinned local artifact validation with a stat-keyed, process-local checksum cache."""
import hashlib,json
from .providers import ARTIFACTS,manifest,ModelUnavailable
_verified={}
def verify(model):
    entry,path=manifest(model)
    if entry['status']!='tested-cpu':raise ModelUnavailable('MODEL_NOT_READY')
    for relative,record in entry.get('files',{}).items():
        file=(path/relative).resolve()
        if not file.is_relative_to(ARTIFACTS.resolve()) or not file.is_file():raise ModelUnavailable('MODEL_ARTIFACT_MISSING')
        expected=record.get('runtime_sha256',record['sha256']);stat=file.stat();key=(str(file),stat.st_size,stat.st_mtime_ns,expected)
        if key in _verified:continue
        h=hashlib.sha256()
        with file.open('rb') as f:
            for chunk in iter(lambda:f.read(4*1024*1024),b''):h.update(chunk)
        if h.hexdigest()!=expected:raise ModelUnavailable('MODEL_CHECKSUM_MISMATCH')
        _verified[key]=True
    return entry
