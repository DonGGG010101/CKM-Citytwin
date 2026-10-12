<script setup>
import { computed, ref } from 'vue'
const props=defineProps({scene:Object,sample:Object,history:Object,live:Object,event:Object,frame:Object,paused:Boolean})
const expanded=ref(false)
const xy=p=>[p[0]+34,34-p[1]]
const points=ps=>ps.map(p=>xy(p).join(',')).join(' ')
const active=(path,env)=>path.kind==='stable'||(path.kind==='remove'?!env.removed:env.added)
const mapView=computed(()=>{
  const coords=props.sample.paths.flatMap(path=>path.points)
  const xs=coords.map(point=>point[0]),ys=coords.map(point=>point[1])
  const minX=Math.min(...xs)-3,maxX=Math.max(...xs)+3
  const minY=Math.min(...ys)-3,maxY=Math.max(...ys)+3
  return `${minX+34} ${34-maxY} ${maxX-minX} ${maxY-minY}`
})
const paths=computed(()=>props.sample.paths.map(path=>{
 const before=active(path,props.history),after=active(path,props.live)
 const changed=!!props.event && before!==after
 return {...path,before,after,changed,color:changed?(path.kind==='remove'?'#69a6ff':'#ff847e'):'#68d9d0'}
}).filter(p=>p.before||p.after))
const stateText=computed(()=>!props.event?'历史路径':props.frame.commit?'CKM 已更新':props.event.type==='obstacle_move'?'旧径消失 · 新径出现':props.event.type==='obstacle_remove'?'一条路径正在消失':'一条路径正在新增')

// Illustrative channel records; independent of the scaled scene geometry.
const channelPresets = {
  p1: [[18,42,-61],[36,78,-73],[64,105,-79],[-28,91,-76],[112,164,-89]],
  p2: [[-12,55,-64],[25,92,-76],[48,119,-82],[-41,108,-78],[126,182,-92]],
  p3: [[132,63,-66],[108,110,-78],[76,126,-81],[151,117,-80],[-94,205,-94]]
}
const movedRecords={p1:[42,86,-71],p2:[31,96,-76],p3:[-18,121,-79]}
const channelRows = computed(() => {
  const values = channelPresets[props.sample.id]
  const make = (id, type, index, status = '保留', single = false) => {
    const record = props.event?.type==='obstacle_move' && index===3 ? movedRecords[props.sample.id] : values?.[index]
    return { id, type, angle: record?.[0] ?? '—', delay: record?.[1] ?? '—', gain: record?.[2] ?? '—', status, single }
  }
  const rows = [make('P01', '直达径', 0)]
  for (const path of paths.value) {
    const index = { stable: 1, remove: 2, add: 3 }[path.kind]
    rows.push(make(`P0${index + 1}`, '单次反射', index,
      path.before && !path.after ? '消失' : !path.before && path.after ? '新增' : '保留', true))
  }
  rows.push(make('P05', '多次反射', 4))
  return rows
})
</script>
<template>
  <div class="ckm-content" :class="{paused}">
    <div class="ckm-summary"><div><span class="eyebrow">{{sample.name}} · 路径视图</span><strong>{{stateText}}</strong></div><div class="path-counter">{{sample.paths.filter(p=>active(p,live)).length}}<small>条当前单次反射径</small></div></div>

    <section class="knowledge-matrix" aria-label="多径信道知识矩阵">
      <div class="matrix-heading"><b>{{ sample.name }} · 多径知识矩阵</b></div>
      <div class="matrix-scroll">
        <table>
          <thead><tr><th>路径</th><th>类型</th><th>到达角 / °</th><th>时延 / ns</th><th>功率增益 / dB</th><th>状态</th></tr></thead>
          <tbody>
            <tr v-for="row in channelRows" :key="sample.id + row.id" :class="{ 'single-row': row.single, 'removed-row': row.status === '消失', 'added-row': row.status === '新增' }">
              <td>{{ row.id }}</td><td>{{ row.type }}</td><td>{{ row.angle }}</td><td>{{ row.delay }}</td><td>{{ row.gain }}</td><td><span class="row-status">{{ row.status }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>高亮行对应下方的路径变化</p>
    </section>
    <template v-for="zoom in [false,true]" :key="String(zoom)"><div v-if="!zoom || expanded" :class="['path-compare-wrap',{large:zoom}]" :role="zoom?'dialog':undefined" :aria-modal="zoom?'true':undefined" :aria-label="zoom?'放大路径对照':undefined">
      <div class="path-compare-head"><strong>单次反射径 · 左右对照</strong><button v-if="!zoom" @click="expanded=true">⤢ 放大对照</button><button v-else @click="expanded=false">✕ 关闭</button></div>
      <div class="path-compare">
        <div v-for="side in ['before','after']" :key="side" class="path-pane"><div class="path-pane-label"><b>{{side==='before'?'历史 CKM':'当前观测'}}</b><span>{{side==='before'?'V1.0':frame.commit?'V2.0':'实时'}}</span></div>
          <svg :viewBox="mapView" role="img" :aria-label="sample.name+(side==='before'?'历史路径':'当前路径')">
            <rect x="0" y="0" width="68" height="68" fill="#102635"/>
            <polygon v-for="building in scene.buildings" :key="building.id" :points="points(building.footprint)" fill="#20394a" stroke="#3a5a69" stroke-width=".1"/>
            <polyline v-for="road in scene.roads" :key="road.id" :points="points(road.points)" fill="none" stroke="#345160" stroke-width=".17"/>
            <g v-for="path in paths.filter(item=>item[side])" :key="path.id">
              <polyline :points="points(path.points)" fill="none" :stroke="path.color" stroke-width=".95" opacity=".2"/>
              <polyline :points="points(path.points)" fill="none" :stroke="path.color" stroke-width=".42" :stroke-dasharray="path.changed&&side==='before'?'1 .65':undefined"/>
              <circle :cx="xy(path.points[1])[0]" :cy="xy(path.points[1])[1]" r=".6" :fill="path.color"/>
            </g>
            <circle :cx="xy(sample.position)[0]" :cy="xy(sample.position)[1]" r=".85" fill="#f0c98a"/>
            <circle cx="38" cy="34" r=".8" fill="#f5f9ff"/>
            <text x="39.5" y="33.5" fill="#d1e7f0" font-size="1.5">BS</text>
          </svg>
        </div>
      </div>
      <div class="path-compare-key"><span><i class="key-dot turquoise"></i>保留</span><span><i class="key-dot blue-key"></i>消失</span><span><i class="key-dot orange-key"></i>新增</span></div>
    </div></template>
    <div class="comparison"><span>历史单次反射 <b>{{sample.paths.filter(p=>active(p,history)).length}} 条</b></span><span class="comparison-arrow">→</span><span>当前单次反射 <b>{{sample.paths.filter(p=>active(p,live)).length}} 条</b></span></div>
  </div>
</template>

<style scoped>
.knowledge-matrix{margin:16px 0 8px;border:1px solid #344651;border-radius:6px;overflow:hidden;background:#0a1823}
.matrix-heading{display:flex;justify-content:space-between;gap:12px;padding:12px;background:#13232f;font-size:13px}
.matrix-heading b{font-weight:500;color:#d8e8f0}.matrix-heading span{font-size:12px;color:#8a9fab}
.matrix-scroll{overflow-x:auto}table{width:100%;border-collapse:collapse;white-space:nowrap;font-size:12px;font-variant-numeric:tabular-nums}
th,td{padding:10px 9px;text-align:center;border-bottom:1px solid #243640}th{color:#91aaba;font-weight:400;background:#10202c}td{color:#a9bdc9}
.single-row{background:#243e4850}.single-row td{color:#b8e2e2}.single-row td:first-child{box-shadow:inset 3px 0 #68d9d0}
.removed-row{background:#263e6570}.removed-row td{color:#a4c5ff}.removed-row td:first-child{box-shadow:inset 3px 0 #69a6ff}.removed-row .row-status{border:1px solid #668fca;border-radius:3px;padding:2px 5px}
.added-row{background:#613d3770}.added-row td{color:#ffb4a8}.added-row td:first-child{box-shadow:inset 3px 0 #ff847e}.added-row .row-status{border:1px solid #d98879;border-radius:3px;padding:2px 5px}
.knowledge-matrix p{margin:0;padding:9px 12px;font-size:12px;color:#c88c93;line-height:1.5}
.path-compare-wrap{background:#0c1d29;border:1px solid #2e5060;border-radius:5px;overflow:hidden;min-height:0}
.path-compare-head,.path-pane-label{display:flex;justify-content:space-between;align-items:center;gap:6px;padding:5px 9px;color:#a9c6cf;font-size:10px}
.path-compare-head strong{color:#dbf1ee;font-weight:600}.path-compare-head button{border:1px solid #5b868b;background:#16404a;color:#c3ebe7;padding:3px 7px;border-radius:3px;font-size:10px}
.path-compare{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px;padding:0 5px}.path-pane{min-width:0;background:#102635;border:1px solid #2b4956}.path-pane-label{background:#163545;padding:4px 7px}.path-pane-label span{color:#80cabb}.path-pane svg{display:block;width:100%;height:190px;object-fit:contain}.path-compare-key{display:flex;justify-content:center;gap:16px;font-size:10px;color:#a8c6cc;padding:5px}
.path-compare-wrap.large{position:fixed;z-index:1000;inset:4vh 4vw;background:#0c2230;border:1px solid #82d7cd;border-radius:10px;padding:16px;display:flex;flex-direction:column;box-shadow:0 0 0 100vmax #020d17dc}.path-compare-wrap.large .path-compare-head{padding:4px 0 12px;font-size:15px}.path-compare-wrap.large .path-compare{flex:1;min-height:0}.path-compare-wrap.large .path-pane{display:flex;flex-direction:column}.path-compare-wrap.large .path-pane-label{padding:10px;font-size:13px}.path-compare-wrap.large .path-pane svg{flex:1;min-height:0;height:100%}.path-compare-wrap.large .path-compare-key{font-size:13px;padding:14px}
@media(max-width:600px){.path-pane svg{height:145px}.path-compare-wrap.large{inset:3vh 2vw;padding:8px}.path-compare-wrap.large .path-compare{grid-template-columns:1fr}.path-compare-wrap.large .path-pane svg{max-height:38vh}}
@media(max-width:600px){.matrix-heading{flex-wrap:wrap}th,td{padding:9px 7px}}
@media (min-width:1001px) and (max-height:950px){
  .ckm-content{
    min-height:0
  }

  .knowledge-matrix{
    margin:8px 0 4px
  }

  .matrix-heading{
    padding:7px 9px
  }

  th,td{
    padding:5px 6px
  }

  .knowledge-matrix p{
    padding:5px 8px
  }
}
</style>
