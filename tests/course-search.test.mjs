import test from 'node:test';
import assert from 'node:assert/strict';
import {CourseSearchApi} from '../extension/course-api.js';

function fixture(){
 const calls=[],row={id:10001,title:'示例课程',realname:'示例教师',term_name:'2026-2027-1',kkxy_name:'示例学院'};
 const api=new CourseSearchApi({fetcher:async(raw,options)=>{const u=new URL(raw);calls.push({url:u,options});let body;
  if(u.pathname.endsWith('/term-list'))body={code:1000,params:{list:[{id:1,term_name:row.term_name}]}};
  else if(u.pathname.endsWith('/structures'))body={code:1000,params:{data:[{id:9,display_name:'学校',child:[{id:2,display_name:row.kkxy_name}]}]}};
  else if(u.pathname.endsWith('/get-course-list'))body={code:0,data:{total:81,list:[row,{...row},{id:3,title:'测试课程',realname:'超级管理员'},{...row,id:4,url:'https://www.yanhekt.cn/course/4'}]}};
  else if(u.pathname.endsWith('/get-course-detail'))body={code:0,data:{...row,sub_list:[]}};
  else throw Error('Unexpected request '+u.pathname);
  return new Response(JSON.stringify(body));
 }});api.authenticate=async()=>{api.profile={id:7,tenant_id:21,phone:'13000000000'};api.token='synthetic-search-token';};return {api,calls};
}
test('school search uses the modern index, tenant header, pagination and validated filters without requesting media',async()=>{
 const {api,calls}=fixture(),result=await api.search('示例教师',{page:2,term:'1',college:'2'});
 assert.equal(result.rows.length,1);assert.equal(result.rows[0].id,'10001');assert.equal(result.total,81);
 assert.equal(calls[0].url.pathname,'/courseapi/v3/multi-search/get-course-list');assert.deepEqual(Object.fromEntries(calls[0].url.searchParams),{tenant:'21',title:'示例教师',order:'c.created_at desc',page:'2',per_page:'40',term:'1','struc_ids[]':'2'});
 assert.equal(calls[0].options.headers['tenant-id'],'21');assert.equal(calls.length,1);
});
test('filters traverse nested colleges, reuse metadata and ID search resolves a course without video source requests',async()=>{
 const {api,calls}=fixture();assert.equal((await api.filters()).colleges[1].name,'示例学院');await api.filters();assert.equal(calls.length,2);
 const result=await api.search('10001',{term:'1',college:'2'});assert.equal(result.rows[0].title,'示例课程');assert.ok(calls.every(r=>!r.url.pathname.includes('/get-sub-info')&&!r.url.pathname.startsWith('/play/')));
 assert.equal((await api.search('10001',{term:'99'})).total,0);
});
test('invalid search input is rejected before HTTP; malformed search responses remain errors',async()=>{
 const {api,calls}=fixture();for(const options of [{page:0},{page:Infinity},{term:'abc'},{college:'../2'}])await assert.rejects(api.search('',options));await assert.rejects(api.search('x'.repeat(513)));assert.equal(calls.length,0);
 api.fetcher=async()=>new Response(JSON.stringify({code:0,data:{list:null}}));await assert.rejects(api.search('示例'),/格式/);
});
