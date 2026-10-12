export function movingEvent(disappearEvent) {
  const center=[12.85,8.85]
  const oldCenter=disappearEvent.fusion.center
  const shift=p=>[p[0]+center[0]-oldCenter[0],p[1]+center[1]-oldCenter[1]]
  return {
    id:'move-demo',type:'obstacle_move',obstacleId:'moving-blue-target',position:[6,5],size:[3.7,3.7,5],
    footprint:[[6,6.85],[7.85,5],[6,3.15],[4.15,5]],
    affectedVBS:disappearEvent.affectedVBS,
    fusion:{...disappearEvent.fusion,center,userResults:disappearEvent.fusion.userResults.map(user=>({...user,points:user.points.map(shift)}))},
    reflection:{baseStation:[4,0,1.5],virtualBaseStation:[12.85,8.85,1.5],face:{a:[6,6.85],b:[7.85,5],height:5},rp:[6.925,5.925,1.5],guideA:[3,9.85],guideB:[10,2.85]},
    mockResult:{hausdorffDistance:6.3,threshold:2,votes:[true,true,true,false,true,true,true,true,false,true],requiredVotes:7,position:[6.925,5.925]},
  }
}

export function pathsForEvent(ckm,type) {
  if(type!=='obstacle_move') return ckm
  return {...ckm,samples:ckm.samples.map(sample=>({...sample,paths:sample.paths.map(path=>path.kind==='add'?{...path,id:'moved-reflection',points:[[4,0],[6.925,5.925],sample.position]}:path)}))}
}

export const singleEvents=[
  {type:'obstacle_add',number:'01',title:'目标出现',subtitle:'新增反射路径',color:'coral'},
  {type:'obstacle_remove',number:'02',title:'目标消失',subtitle:'原有路径消失',color:'blue'},
  {type:'obstacle_move',number:'03',title:'目标移动',subtitle:'旧径消失 · 新径出现',color:'gold'},
]

export const singlePhases=[
  {name:'历史 CKM',time:0,detail:'保存初始场景与各位置的参考路径。'},
  {name:'环境变化',time:1000,detail:'目标在三维现场出现、消失或移动。'},
  {name:'路径差异',time:3400,detail:'对照历史和当前信道，标出新增与消失的单次反射径。'},
  {name:'多位置确认',time:5700,detail:'A/B/C 位置的预设观测依次出现，并形成共同候选区域。'},
  {name:'单面定位',time:10300,detail:'根据镜像基站与反射点的关系显示可见反射面。'},
  {name:'CKM 更新',time:13500,detail:'确认变化后，更新路径记录并形成新版本。'},
]
