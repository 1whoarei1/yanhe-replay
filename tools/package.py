"""Build a directly loadable release folder and a flat ZIP using Python's standard library."""
from pathlib import Path
import json
import shutil
import zipfile
import hashlib
import sys

project = Path(__file__).resolve().parents[1]
source = project / 'extension'
manifest = json.loads((source / 'manifest.json').read_text(encoding='utf-8'))
assert manifest['version'] == json.loads((project / 'package.json').read_text(encoding='utf-8'))['version']
with_imports = '--with-imports' in sys.argv
with_sessions = '--with-session-index' in sys.argv
if with_sessions:
    snapshot = json.loads((source / 'legacy-session-index.json').read_text(encoding='utf-8'))
    assert snapshot['format'] == 'yanhekt-session-index/v1' and snapshot['source']['kind'] == 'self-collected'
release = project / "dist" / (f"yanhe-replay-{manifest['version']}" + ('-session-test' if with_sessions else ''))
assert release.resolve().parent == (project / 'dist').resolve()
release.mkdir(parents=True, exist_ok=True)
files = []
for item in sorted(source.rglob('*')):
    if not item.is_file():
        continue
    relative = item.relative_to(source)
    if relative.as_posix() == 'legacy-session-index.json' and not with_sessions:
        continue
    target = release / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(item, target)
    files.append(relative)
for relative in [Path(name) for name in ('README.md', 'CHANGELOG.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md')] + [p.relative_to(project) for p in (project / 'licenses').rglob('*')]:
    if not (project / relative).is_file():
        continue
    (release / relative).parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(project / relative, release / relative)
    if relative.suffix == '.md':
        target = release / relative
        target.write_text(target.read_text(encoding='utf-8').replace('](extension/', ']('), encoding='utf-8')
    files.append(relative)
if with_imports:
    directory=Path('课程目录');(release/directory).mkdir(exist_ok=True)
    datasets={}
    for source_name,target_name in [('release-catalog.json','课程目录.json'),('release-session-index.json','旧版课次目录.json')]:
        source_file=project/'local-data'/source_name;datasets[source_name]=json.loads(source_file.read_text(encoding='utf8'))
        assert source_file.stat().st_size<=32*1024*1024
        shutil.copy2(source_file,release/directory/target_name);files.append(directory/target_name)
    modern=datasets['release-catalog.json'];old=datasets['release-session-index.json']
    assert modern['schema']==1 and all(c['platform']=='modern' for c in modern['courses'])
    assert old['format']=='yanhekt-session-index/v1' and old['source']['kind']=='self-collected'
    text=f"""打开「全校课程」→「导入目录」，依次导入本文件夹的两个 JSON。
课程目录.json：新版 {len(modern['courses']):,} 门课程。
旧版课次目录.json：旧版 {len(old['courses']):,} 门课程 / {sum(len(c['sessions']) for c in old['courses']):,} 个 session。
旧版快照时间：{old['generatedAt']}；采集仍在继续，未收录不代表没有回放。
导入后目录保存在本浏览器，可离线检索。新版可点「在线查询」读取平台最新列表；观看仍需登录及相应权限。
更新目录时重新导入同类文件即可。不含旧版 XLSX、账号数据、观看记录或媒体地址。
感谢 bit-admin / Yanhekt-AutoSlides 的公开索引器，旧版快照为我们独立采集的元数据。
"""
    (release/directory/'导入说明.txt').write_text(text,encoding='utf8');files.append(directory/'导入说明.txt')
archive = release.parent / (release.name + '.zip')
with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED) as package:
    for relative in files:
        package.write(release / relative, relative.as_posix())
with zipfile.ZipFile(archive) as package:
    assert 'manifest.json' in package.namelist()
    assert not any(name.startswith('extension/') for name in package.namelist())
    assert not any(name.lower().endswith(('.xlsx','.xls','.csv','.tsv')) or ('catalog' in name.lower() and name.lower().endswith('.json') and not with_imports) for name in package.namelist()), 'Course tables must not be distributed'
    assert package.testzip() is None
    assert ('legacy-session-index.json' in package.namelist()) == with_sessions
    for relative in files:
        assert package.read(relative.as_posix()) == (release / relative).read_bytes()
report = {'version': manifest['version'], 'folder': str(release), 'zip': str(archive), 'files': len(files), 'bytes': archive.stat().st_size, 'sha256': hashlib.sha256(archive.read_bytes()).hexdigest(), 'verified': True}
(project / 'test-results').mkdir(exist_ok=True)
(project / 'test-results' / 'package-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(report, ensure_ascii=False))
