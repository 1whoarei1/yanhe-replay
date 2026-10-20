"""Build a directly loadable release folder and a flat ZIP using Python's standard library."""
from pathlib import Path
import json
import shutil
import zipfile

project = Path(__file__).resolve().parents[1]
source = project / 'extension'
manifest = json.loads((source / 'manifest.json').read_text(encoding='utf-8'))
release = project / "dist" / f"yanhe-replay-{manifest['version']}"
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
print(json.dumps({'version': manifest['version'], 'folder': str(release), 'zip': str(archive), 'files': len(files), 'verified': True}, ensure_ascii=False))
