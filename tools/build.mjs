import { mkdir, copyFile, writeFile, readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const extension = resolve(root, 'extension');
await mkdir(resolve(extension,'vendor'),{recursive:true});
for (const [source,target] of [
  ['node_modules/hls.js/dist/hls.light.min.js','hls.light.min.js'],
  ['node_modules/hls.js/LICENSE','hls.LICENSE'],
  ['node_modules/mpegts.js/dist/mpegts.js','mpegts.min.js'],
  ['node_modules/mpegts.js/LICENSE','mpegts.LICENSE'],
  ['node_modules/mpegts.js/dist/mpegts.js.LICENSE.txt','mpegts.NOTICE.txt'],
  ['node_modules/blueimp-md5/js/md5.min.js','md5.min.js'],
  ['node_modules/blueimp-md5/LICENSE.txt','md5.LICENSE']
]) await copyFile(resolve(root,source),resolve(extension,'vendor',target));
// The icon is a code-drawn play symbol over two classroom rows.
const crcTable = Array.from({length:256},(_,n) => { let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0; });
function chunk(type,data) { const t=Buffer.from(type),n=Buffer.alloc(4);n.writeUInt32BE(data.length);let c=0xffffffff;for(const b of Buffer.concat([t,data]))c=crcTable[(c^b)&255]^(c>>>8);const crc=Buffer.alloc(4);crc.writeUInt32BE((c^0xffffffff)>>>0);return Buffer.concat([n,t,data,crc]); }
await mkdir(resolve(extension,'icons'),{recursive:true});
for (const size of [16,32,48,128]) {
  const raw=Buffer.alloc((size*4+1)*size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
    const u=x/size,v=y/size,inside=u>.31&&u<.72&&Math.abs(v-.43)<(u-.31)*.66;
    const row=v>.75&&v<.8&&u>.24&&u<.76;
    const i=y*(size*4+1)+1+x*4;
    raw.set(inside||row?[241,249,249,255]:[0,123,131,255],i);
  }
  const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(size);ihdr.writeUInt32BE(size,4);ihdr[8]=8;ihdr[9]=6;
  await writeFile(resolve(extension,'icons',`${size}.png`),Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]));
}
const manifest=JSON.parse(await readFile(resolve(extension,'manifest.json'),'utf8'));
console.log(`Built ${manifest.name} ${manifest.version}; load this folder: ${extension}`);
