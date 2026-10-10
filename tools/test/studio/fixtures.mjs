export const layout = () => ({x:.5,y:.5,scale:1,rotation:0,anchor:'canvas',fit:'contain',focus:{x:.5,y:.5},backdrop:'solid',textWidth:.84,fontScale:.06,breaks:[]});
export function mixedProject(){
 const clips=[['cImage','s1','image',8e6,'image'],['cVideo','s2','video',6e6,'video'],['cUnfold','s3','unfold',8e6,null],['cOther','s4','video',8e6,'other']].map(([id,sceneId,kind,endUs,assetId])=>({id,name:id,sceneId,kind,startUs:0,endUs,sourceInUs:0,effectOriginUs:0,...(assetId?{assetId}:{unfoldId:'u1'}),opacity:1,z:0,seed:7}));
 const audio=(id,role,assetId,startUs,endUs,linkClipId=null)=>({id,role,assetId,startUs,endUs,sourceInUs:0,linkClipId,muted:false,gain:1,envelope:{originUs:startUs,points:[]}});
 return {format:'unfold-studio',version:1,id:'p',revision:0,durationUs:30e6,fps:30,bg:'#111718',scenes:[[0,8],[8,14],[14,22],[22,30]].map(([a,b],i)=>({id:'s'+(i+1),startUs:a*1e6,endUs:b*1e6,originUs:a*1e6})),clips,
 lyrics:[{id:'l1',startUs:12e6,endUs:16e6,text:'光をつなぐ',runs:[],motion:{},timingSource:'timed',opacity:1,z:0}],
 audio:[audio('m1','music','song',0,30e6),audio('a1','sfx','sound',14e6,15e6),audio('aVideo','source','video',8e6,14e6,'cVideo')],locks:{music:true,lyrics:true},
 views:Object.fromEntries([['wide',1920,1080],['tall',1080,1920]].map(([id,width,height])=>[id,{id,width,height,safe:{left:.08,right:.08,top:.1,bottom:.1},layout:Object.fromEntries([...clips.map(c=>c.id),'l1'].map(id=>[id,layout()]))}])),shorts:[],
 assets:Object.fromEntries(['image','video','other','song','sound'].map(id=>[id,{id,projectId:'p',type:id==='image'?'image/png':id==='video'||id==='other'?'video/mp4':'audio/wav',byteLength:1,hash:'0'.repeat(64),durationUs:30e6}])),unfolds:{u1:{id:'u1',version:1,state:{durationUs:8e6},dependencies:[]}}};
}
