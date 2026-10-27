"""Build a directly loadable release folder and a flat ZIP using Python's standard library."""
from pathlib import Path
import json
import shutil
import zipfile
import hashlib

project = Path(__file__).resolve().parents[1]
source = project / 'extension'
manifest = json.loads((source / 'manifest.json').read_text(encoding='utf-8'))
assert manifest['version'] == json.loads((project / 'package.json').read_text(encoding='utf-8'))['version']
release = project / "dist" / f"yanhe-replay-{manifest['version']}"
assert release.resolve().parent == (project / 'dist').resolve()
release.mkdir(parents=True, exist_ok=True)
files = []
for item in sorted(source.rglob('*')):
    if not item.is_file():
        continue
    relative = item.relative_to(source)
    target = release / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(item, target)
    files.append(relative)
for relative in [Path(name) for name in ('README.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md')] + [p.relative_to(project) for p in (project / 'licenses').rglob('*')]:
    if not (project / relative).is_file():
        continue
    (release / relative).parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(project / relative, release / relative)
    if relative.suffix == '.md':
        target = release / relative
        target.write_text(target.read_text(encoding='utf-8').replace('](extension/', ']('), encoding='utf-8')
    files.append(relative)
archive = release.parent / (release.name + '.zip')
with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED) as package:
    for relative in files:
        package.write(release / relative, relative.as_posix())
with zipfile.ZipFile(archive) as package:
    assert 'manifest.json' in package.namelist()
    assert not any(name.startswith('extension/') for name in package.namelist())
    assert package.testzip() is None
    for relative in files:
        assert package.read(relative.as_posix()) == (release / relative).read_bytes()
report = {'version': manifest['version'], 'folder': str(release), 'zip': str(archive), 'files': len(files), 'bytes': archive.stat().st_size, 'sha256': hashlib.sha256(archive.read_bytes()).hexdigest(), 'verified': True}
(project / 'test-results').mkdir(exist_ok=True)
(project / 'test-results' / 'package-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(report, ensure_ascii=False))
