import {importCatalog,readImportedCatalog} from './catalog-import.js';
import {CourseSearchApi} from './course-api.js';
import {explain} from './core.js';
import {AutoSlidesIndex} from './autoslides-index.js';
import {normalizeCourse,hasSpecificTerm,courseTermOptions,searchCourses} from './catalog-core.js';

export function mountCourseBrowser({onSelect,api=new CourseSearchApi(),index=new AutoSlidesIndex()}){
 const $=id=>document.getElementById(id),dialog=$('course-browser');let controller,filterController,sequence=0,page=1,total=0,loadedFilters=false,filterSequence=0,preferOnline=false,localModern=null;
 const isIndex=()=>$('catalog-source').value==='legacy';
 const text=(tag,value,cls)=>{const n=document.createElement(tag);n.textContent=value;if(cls)n.className=cls;return n;};
 const status=$('catalog-status'),list=$('catalog-results');
 function paging(busy=false){$('catalog-prev').disabled=busy||page<=1;$('catalog-next').disabled=busy||page*40>=total;$('catalog-page').textContent=`${page} / ${Math.max(1,Math.ceil(total/40))}`;}
 async function filters(){
  if(loadedFilters)return;filterController?.abort();filterController=new AbortController();const current=++filterSequence,old=isIndex();
  try{localModern=old||preferOnline?null:await readImportedCatalog('modern');const localRows=localModern?.courses.map(row=>normalizeCourse(row,'modern')).filter(Boolean);const data=old?await index.terms(filterController.signal).then(r=>({terms:r.terms.filter(hasSpecificTerm).map(t=>({id:t,name:t})),colleges:[]})):localModern?{terms:courseTermOptions(localRows,'modern').map(term=>({id:term,name:term})),colleges:[...new Set(localRows.map(row=>row.college).filter(Boolean))].sort().map(college=>({id:college,name:college}))}:await api.filters(filterController.signal);if(!dialog.open||current!==filterSequence)return;
   for(const [id,rows]of [['catalog-term',data.terms],['catalog-college',data.colleges]]){const select=$(id);select.replaceChildren(new Option(id==='catalog-term'?'全部学期':'全部学院',''),...rows.map(r=>new Option(r.name,r.id)));select.disabled=old&&id==='catalog-college';}if(old)$('catalog-term').value=data.terms[0]?.id||'';loadedFilters=true;$('catalog-online').hidden=old||!localModern;$('catalog-filter-status').textContent=old?'旧版课程索引尚未完整；未收录不代表没有回放。':localModern?'已使用本地新版目录，可切换在线查询获取最新课程。':'';
  }catch(error){if(error.name!=='AbortError'&&dialog.open&&current===filterSequence)$('catalog-filter-status').textContent=old?error.message:'筛选暂不可用，可直接搜索';}
 }
 async function search(next=1){
  controller?.abort();controller=new AbortController();const current=++sequence;page=next;paging(true);$('catalog-submit').setAttribute('aria-busy','true');list.setAttribute('aria-busy','true');status.textContent='正在搜索…';
  try{
   const old=isIndex();if(!loadedFilters)await filters();let result;if(!old&&localModern){const query=$('catalog-query').value.trim(),exact=/^\d{1,12}$/.test(query),rows=localModern.courses.map(row=>normalizeCourse(row,'modern')).filter(row=>row&&(!exact||row.id===query));result={...searchCourses(rows,{q:exact?'':query,term:$('catalog-term').value,college:$('catalog-college').value,offset:(page-1)*40,limit:40}),page,pageSize:40};}else result=await (old?index:api).search($('catalog-query').value,{page,term:$('catalog-term').value,college:$('catalog-college').value,signal:controller.signal});
   if(current!==sequence||!dialog.open)return;total=result.total;page=result.page;list.replaceChildren();
   for(const raw of result.rows){const course=old?normalizeCourse(raw,'legacy'):raw;if(!course)continue;const row=document.createElement('button');row.type='button';row.className='catalog-row';row.dataset.course=course.id;
    row.append(text('strong',course.title),text('span',course.teacher||'—'),text('span',course.term||'—'),text('span',course.college||'—'));
    row.setAttribute('aria-label',`打开 ${course.title} ${course.teacher}`);row.addEventListener('click',()=>{dialog.close();onSelect(course);});list.append(row);
   }
   if(!result.rows.length)list.append(text('p',old?($('catalog-query').value.trim()?'索引未找到课程；数据仍在完善。':'输入课程名或教师并选择学期，也可搜索课程 ID。'):'未找到课程','catalog-empty'));
   status.textContent=old?`旧版课程索引 · 已返回 ${total} 门${result.reportedTotal>total?' / 共匹配 '+result.reportedTotal+' 门（最多返回 200 门）':''}${result.truncated?' · 候选范围受限':''}`:`${localModern?'新版目录 · ':''}${total.toLocaleString('zh-CN')} 门课程`;
  }catch(error){if(current!==sequence||!dialog.open||error.name==='AbortError')return;list.replaceChildren(text('p',explain(error),'catalog-empty'));status.textContent='读取失败';total=0;}
  finally{if(current===sequence){list.setAttribute('aria-busy','false');$('catalog-submit').setAttribute('aria-busy','false');paging();}}
 }
 $('browse-courses').addEventListener('click',()=>{dialog.showModal();$('catalog-query').focus();void filters();void search(page);});
 $('catalog-source').addEventListener('change',()=>{preferOnline=false;controller?.abort();sequence++;filterController?.abort();filterSequence++;loadedFilters=false;page=1;total=0;for(const id of ['catalog-term','catalog-college']){$(id).replaceChildren(new Option(id==='catalog-term'?'选择学期':'全部学院',''));$(id).disabled=true;}void filters().then(()=>search());});
 $('catalog-import').addEventListener('click',()=>$('catalog-file').click());
 $('catalog-file').addEventListener('change',async event=>{const input=event.target,file=input.files[0];if(!file)return;try{if(file.size>32*1024*1024)throw new Error('目录文件超过 32 MB。');const imported=await importCatalog(JSON.parse(await file.text()));preferOnline=false;loadedFilters=false;$('catalog-source').value=imported.kind==='sessions'?'legacy':'modern';for(const id of ['catalog-term','catalog-college'])$(id).replaceChildren(new Option(id==='catalog-term'?'全部学期':'全部学院',''));$('catalog-query').value='';page=1;await filters();await search();$('catalog-import-status').textContent=imported.kind==='sessions'?`已导入 ${imported.courses.toLocaleString()} 门旧版课程 / ${imported.sessions.toLocaleString()} 个课次`:`已导入 ${imported.courses.toLocaleString()} 门新版课程`;}catch(error){$('catalog-import-status').textContent=error.message||'目录导入失败';}finally{input.value='';}});
 $('catalog-online').addEventListener('click',()=>{preferOnline=true;loadedFilters=false;for(const id of ['catalog-term','catalog-college'])$(id).replaceChildren(new Option(id==='catalog-term'?'全部学期':'全部学院',''));void filters().then(()=>search());});
 $('catalog-close').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('close',()=>{controller?.abort();filterController?.abort();sequence++;filterSequence++;$('catalog-submit').setAttribute('aria-busy','false');list.setAttribute('aria-busy','false');paging();});
 $('catalog-form').addEventListener('submit',event=>{event.preventDefault();void search();});
 for(const id of ['catalog-term','catalog-college'])$(id).addEventListener('change',()=>void search());
 $('catalog-prev').addEventListener('click',()=>void search(page-1));$('catalog-next').addEventListener('click',()=>void search(page+1));
 return {close:()=>dialog.close()};
}
