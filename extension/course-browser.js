import {CourseSearchApi} from './course-api.js';
import {explain} from './core.js';

export function mountCourseBrowser({onSelect,api=new CourseSearchApi()}){
 const $=id=>document.getElementById(id),dialog=$('course-browser');let controller,filterController,sequence=0,page=1,total=0,loadedFilters=false;
 const text=(tag,value,cls)=>{const n=document.createElement(tag);n.textContent=value;if(cls)n.className=cls;return n;};
 const status=$('catalog-status'),list=$('catalog-results');
 function paging(busy=false){$('catalog-prev').disabled=busy||page<=1;$('catalog-next').disabled=busy||page*40>=total;$('catalog-page').textContent=`${page} / ${Math.max(1,Math.ceil(total/40))}`;}
 async function filters(){
  if(loadedFilters)return;filterController?.abort();filterController=new AbortController();
  try{const data=await api.filters(filterController.signal);if(!dialog.open)return;
   for(const [id,rows]of [['catalog-term',data.terms],['catalog-college',data.colleges]]){const select=$(id);select.replaceChildren(new Option(id==='catalog-term'?'全部学期':'全部学院',''),...rows.map(r=>new Option(r.name,r.id)));select.disabled=false;}loadedFilters=true;$('catalog-filter-status').textContent='';
  }catch(error){if(error.name!=='AbortError'&&dialog.open)$('catalog-filter-status').textContent='筛选暂不可用，可直接搜索';}
 }
 async function search(next=1){
  controller?.abort();controller=new AbortController();const current=++sequence;page=next;paging(true);$('catalog-submit').setAttribute('aria-busy','true');list.setAttribute('aria-busy','true');status.textContent='正在搜索…';
  try{
   const result=await api.search($('catalog-query').value,{page,term:$('catalog-term').value,college:$('catalog-college').value,signal:controller.signal});
   if(current!==sequence||!dialog.open)return;total=result.total;page=result.page;list.replaceChildren();
   for(const course of result.rows){const row=document.createElement('button');row.type='button';row.className='catalog-row';row.dataset.course=course.id;
    row.append(text('strong',course.title),text('span',course.teacher||'—'),text('span',course.term||'—'),text('span',course.college||'—'));
    row.setAttribute('aria-label',`打开 ${course.title} ${course.teacher}`);row.addEventListener('click',()=>{dialog.close();onSelect(course);});list.append(row);
   }
   if(!result.rows.length)list.append(text('p','未找到课程','catalog-empty'));
   status.textContent=`${total.toLocaleString('zh-CN')} 门课程`;
  }catch(error){if(current!==sequence||!dialog.open||error.name==='AbortError')return;list.replaceChildren(text('p',explain(error),'catalog-empty'));status.textContent='读取失败';total=0;}
  finally{if(current===sequence){list.setAttribute('aria-busy','false');$('catalog-submit').setAttribute('aria-busy','false');paging();}}
 }
 $('browse-courses').addEventListener('click',()=>{dialog.showModal();$('catalog-query').focus();void filters();void search(page);});
 $('catalog-close').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('close',()=>{controller?.abort();filterController?.abort();sequence++;$('catalog-submit').setAttribute('aria-busy','false');list.setAttribute('aria-busy','false');paging();});
 $('catalog-form').addEventListener('submit',event=>{event.preventDefault();void search();});
 for(const id of ['catalog-term','catalog-college'])$(id).addEventListener('change',()=>void search());
 $('catalog-prev').addEventListener('click',()=>void search(page-1));$('catalog-next').addEventListener('click',()=>void search(page+1));
 return {close:()=>dialog.close()};
}
