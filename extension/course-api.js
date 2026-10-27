import {YanheApi} from './api.js';
import {normalizeCourse} from './catalog-core.js';

// Same course index used by Refine. Only metadata is requested here.
export class CourseSearchApi extends YanheApi{
 async authenticate(options={}){options.signal?.throwIfAborted();if(this.loginFlight)return this.loginFlight;this.loginFlight=super.authenticate({force:options.force});try{return await this.loginFlight;}finally{this.loginFlight=null;}}
 async filters(signal){
  await this.authenticate({signal});const scope=String(this.profile.tenant_id);
  if(this.filterCache?.scope===scope&&Date.now()-this.filterCache.at<120000)return this.filterCache;
  const [terms,colleges]=await Promise.all([
   this.json('/vlabpassportapi/v1/course/term-list',{}, {signal,codes:[1000,0,200]}),
   this.json('/vlabpassportapi/v1/user/structures',{}, {signal,codes:[1000,0,200]})
  ]);
  if(!Array.isArray(terms.params?.list)||!colleges.params?.data)throw new Error('课程筛选信息格式已变化');
  const departments=new Map();const walk=node=>{if(Array.isArray(node))node.forEach(walk);else if(node&&typeof node==='object'){if(/^\d{1,12}$/.test(String(node.id))&&node.display_name)departments.set(String(node.id),{id:String(node.id),name:String(node.display_name)});Object.values(node).filter(x=>x&&typeof x==='object').forEach(walk);}};walk(colleges.params.data);
  this.filterCache={scope,at:Date.now(),terms:terms.params.list.filter(t=>/^\d{1,12}$/.test(String(t.id))).map(t=>({id:String(t.id),name:String(t.term_name)})),colleges:[...departments.values()]};return this.filterCache;
 }
 async search(query='',{page=1,term='',college='',signal}={}){
  const q=String(query).trim();if(q.length>512||!Number.isSafeInteger(page)||page<1||page>10000)throw new Error('课程搜索条件无效');
  for(const id of [term,college])if(id&&!/^\d{1,12}$/.test(String(id)))throw new Error('课程筛选条件无效');
  await this.authenticate({signal});
  if(/^\d{1,12}$/.test(q)){
   const data=await this.course(q,signal),course=normalizeCourse(data,'modern');if(!course)return {rows:[],total:0,page:1,pageSize:40};
   if(term||college){const f=await this.filters(signal);if(term&&course.term!==f.terms.find(t=>t.id===term)?.name||college&&course.college!==f.colleges.find(c=>c.id===college)?.name)return {rows:[],total:0,page:1,pageSize:40};}
   return {rows:[course],total:1,page:1,pageSize:40};
  }
  const params={tenant:this.profile.tenant_id,title:q,order:'c.created_at desc',page,per_page:40};if(term)params.term=term;if(college)params['struc_ids[]']=college;
  const {data}=await this.json('/courseapi/v3/multi-search/get-course-list',params,{signal,headers:{'tenant-id':String(this.profile.tenant_id)}});
  if(!Array.isArray(data?.list))throw new Error('课程搜索结果格式已变化');
  const rows=[...new Map(data.list.map(r=>normalizeCourse(r,'modern')).filter(c=>c&&c.platform==='modern'&&!c.testCourse).map(c=>[c.key,c])).values()];
  return {rows,total:Math.max(0,Number(data.total)||0),page,pageSize:40};
 }
}
