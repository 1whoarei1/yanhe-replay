const digits=value=>/^\d{1,12}$/.test(String(value??''));

// Store only typed entity IDs. Never retain arbitrary source URLs or credentials.
export function safeReference(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||typeof value.legacy!=='boolean')return null;
 for(const name of ['id','sessionId','videoId','liveId','subId'])if(value[name]!=null&&!digits(value[name]))return null;
 const result={legacy:value.legacy,...(value.legacy&&value.indexSource==='autoslides'?{indexSource:'autoslides'}:{})};if(value.id!=null)result.id=String(value.id);
 if(value.legacy){
  if(value.subId!=null)return null;
  if(value.liveId!=null)return {...result,liveId:String(value.liveId)};
  if(value.sessionId!=null)return {...result,sessionId:String(value.sessionId),...(value.videoId!=null?{videoId:String(value.videoId)}:{})};
  return result.id&&value.videoId==null?result:null;
 }
 if(!result.id||value.sessionId!=null||value.videoId!=null||value.liveId!=null)return null;
 return {...result,...(value.subId!=null?{subId:String(value.subId)}:{})};
}

export function selectionReference(course,lecture){
 if(!course||!lecture)return null;
 if(course.legacy){
  const live=String(lecture.id).match(/^live:(\d{1,12})$/);
  if(live)return safeReference({legacy:true,id:course.id,liveId:live[1]});
  const part=String(lecture.id).match(/^(\d{1,12}):(pending|\d{1,12})$/);
  return part?safeReference({legacy:true,id:course.id,sessionId:part[1],...(part[2]==='pending'?{}:{videoId:part[2]}),indexSource:course.indexSource}):null;
 }
 return safeReference({legacy:false,id:course.id,subId:lecture.id});
}

export function referenceQuery(value){
 const ref=safeReference(value);if(!ref)throw new Error('播放目标编号无效');
 const params=new URLSearchParams();
 if(ref.liveId)params.set('legacy_live',ref.liveId);
 else if(ref.sessionId){params.set('legacy_session',ref.sessionId);if(ref.videoId)params.set('legacy_video',ref.videoId);}
 else params.set(ref.legacy?'legacy':'course',ref.id);
 if(ref.subId)params.set('sub_id',ref.subId);
 if(ref.indexSource==='autoslides')params.set('index_source','autoslides');
 return params;
}

export function referenceInput(value){
 const ref=safeReference(value);if(!ref)throw new Error('播放目标编号无效');
 if(ref.liveId)return 'https://www.yanhekt.cn/live/'+ref.liveId;
 if(ref.sessionId)return 'https://www.yanhekt.cn/session/'+ref.sessionId;
 if(ref.legacy)return 'https://www.yanhekt.cn/course/'+ref.id;
 return 'https://aita.yanhekt.cn/'+(ref.subId?'livingroom':'coursedetail')+'?'+new URLSearchParams({course_id:ref.id,...(ref.subId?{sub_id:ref.subId}:{})});
}
