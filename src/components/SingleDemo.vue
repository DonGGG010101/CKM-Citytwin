<script setup>
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import CityScene from './CityScene.vue'
import CkmWindow from './CkmWindow.vue'
import { loadDemoData } from '../services/demoData'
import { DURATION, frameAt, initialEnvironment } from '../services/playback'
import { movingEvent, pathsForEvent, singleEvents, singlePhases } from '../services/singleDemo'
import './SingleDemo.css'

const emit=defineEmits(['next'])
const data=ref(null), error=ref(''), type=ref('obstacle_add'), elapsed=ref(0), playing=ref(false), paused=ref(false), selected=ref(0), resetKey=ref(0)
let raf, last=0, controller
const events=computed(()=>data.value?[...data.value.changes.events,movingEvent(data.value.changes.events.find(e=>e.type==='obstacle_remove'))]:[])
const event=computed(()=>events.value.find(e=>e.type===type.value))
const scenario=computed(()=>singleEvents.find(e=>e.type===type.value))
const ckm=computed(()=>data.value?pathsForEvent(data.value.ckm,type.value):null)
const sample=computed(()=>ckm.value?.samples[selected.value])
const frame=computed(()=>frameAt(elapsed.value))
const phaseIndex=computed(()=>singlePhases.reduce((index,item,i)=>elapsed.value>=item.time?i:index,0))
const baseline=initialEnvironment()
const after=computed(()=>type.value==='obstacle_add'?{removed:false,added:true}:type.value==='obstacle_remove'?{removed:true,added:false}:{removed:true,added:true})
const live=computed(()=>elapsed.value>=1400?after.value:baseline)
const visual=computed(()=>({
  removeAlpha:type.value==='obstacle_remove'||type.value==='obstacle_move'?1-frame.value.transition:1,
  addAlpha:type.value==='obstacle_add'?frame.value.transition:0,
  moveAlpha:type.value==='obstacle_move'?frame.value.transition:0,
  results:frame.value.localized&&event.value?[event.value]:[],
  pulse:playing.value&&!paused.value,localized:frame.value.localized,
  current:elapsed.value>0?event.value:null,fusionFrame:frame.value,selected:selected.value,
}))
async function load() {
  error.value='';controller?.abort();controller=new AbortController()
  try { data.value=await loadDemoData(controller.signal) } catch(e) { if(e.name!=='AbortError')error.value=e.message }
}
function stop() { playing.value=false;paused.value=false;last=0 }
function reset() { stop();elapsed.value=0;selected.value=0;resetKey.value++ }
function choose(value) { type.value=value;reset() }
function jump(ms) { stop();elapsed.value=ms;selected.value=Math.max(0,frame.value.userCount-1) }
function play() { reset();playing.value=true }
function tick(now) {
  if(playing.value&&!paused.value){
    const previous=frame.value.userCount
    elapsed.value=Math.min(DURATION,elapsed.value+(last?Math.min(now-last,100):0))
    if(frame.value.userCount>previous)selected.value=frame.value.userCount-1
    if(frame.value.done)stop()
  }
  last=now;raf=requestAnimationFrame(tick)
}
onMounted(()=>{load();raf=requestAnimationFrame(tick)})
onBeforeUnmount(()=>{cancelAnimationFrame(raf);controller?.abort()})
</script>

<template>
  <div class="app-shell single-page">
    <header class="topbar"><div class="brand"><span class="brand-symbol">◈</span><div><strong>AirSense <em>CKM</em></strong><small>CITY DIGITAL TWIN LAB</small></div></div><div class="topbar-right"><span class="status-light"></span>城市无线数字孪生 <span class="prototype-tag">交互演示</span></div></header>
    <main class="dashboard single-dashboard">
      <div class="journey"><span class="journey-current">01 第一步 · 单站障碍物感知</span><span class="journey-line"></span><span>02 第二步 · 多基站城市描述</span><button class="journey-next" @click="emit('next')">进入第二步 →</button></div>
      <section class="intro single-intro"><div><div class="eyebrow">SINGLE-STATION CKM SENSING</div><h1>单基站 CKM 辅助障碍物感知</h1><p>左侧看现场变化，右侧看路径和信道数据怎样改变。</p></div><div class="intro-actions"><button @click="reset">↺ 重置</button><button class="primary-button" :disabled="!data" @click="play">▷ 播放本事件</button></div></section>
      <div v-if="error" class="error-box" role="alert">{{error}} <button @click="load">重新加载</button></div>
      <div v-else-if="!data" class="loading">正在载入场景与 CKM…</div>
      <template v-else>
        <div class="single-events" aria-label="选择障碍物变化事件"><button v-for="item in singleEvents" :key="item.type" :class="['single-event',{active:type===item.type}]" :aria-pressed="type===item.type" @click="choose(item.type)"><span :class="['event-dot',item.color]"></span><span><small>{{item.number}} / EVENT</small><b>{{item.title}}</b><em>{{item.subtitle}}</em></span></button></div>
        <div class="single-grid">
          <section class="single-window"><div class="single-heading"><div><span class="section-index">01 / 环境现场</span><h2>{{scenario.title}}</h2></div><span class="version-stamp">{{singlePhases[phaseIndex].name}}</span></div>
            <div class="single-scene"><CityScene :key="resetKey" :data="data.scene" :ckm="ckm" :events="events" :visual="visual" @select="selected=$event" @error="error=$event" />
              <div class="single-scene-label"><span class="map-live-dot"></span>{{scenario.subtitle}}</div>
              <div v-if="frame.userCount>0&&!frame.localized" class="single-observers"><b>多位置观测</b><span v-for="(name,i) in ['A','B','C']" :key="name" :class="{ready:frame.userProgress[i]>0}">{{name}}</span></div>
            </div><div class="single-legend"><span><i class="key-dot turquoise"></i>已有建筑</span><span><i class="key-dot blue-key"></i>原有目标</span><span><i class="key-dot orange-key"></i>新增目标</span><span>高亮轮廓：定位结果</span></div>
          </section>
          <section class="single-window single-ckm-panel"><div class="single-heading"><div><span class="section-index">02 / 信道知识地图</span><h2>历史 CKM 与当前观测</h2></div><span class="version-stamp">{{frame.commit?'V2.0':'V1.0'}}</span></div>
            <div class="single-sample-tabs"><span>观测位置</span><button v-for="(item,i) in ckm.samples" :key="item.id" :class="{active:selected===i}" :aria-pressed="selected===i" @click="selected=i">{{item.name}}</button></div>
            <CkmWindow :scene="data.scene" :sample="sample" :history="baseline" :live="live" :event="elapsed>0?event:null" :frame="frame" :paused="paused" />
            <div class="single-legend"><span><i class="key-dot turquoise"></i>保留路径</span><span><i class="key-dot blue-key"></i>消失路径</span><span><i class="key-dot orange-key"></i>新增路径</span></div>
          </section>
        </div>
        <section class="single-playback"><div class="single-playback-head"><div><span class="section-index">感知过程 · {{String(phaseIndex+1).padStart(2,'0')}} / 06</span><strong>{{singlePhases[phaseIndex].detail}}</strong></div><button :disabled="!playing" @click="paused=!paused">{{paused?'▷ 继续':'Ⅱ 暂停'}}</button></div><div class="single-progress"><div :style="{width:frame.progress*100+'%'}"></div></div><div class="single-phase-list"><button v-for="(phase,i) in singlePhases" :key="phase.name" :class="{active:phaseIndex===i,done:phaseIndex>i}" @click="jump(phase.time)"><b>{{String(i+1).padStart(2,'0')}}</b><span>{{phase.name}}</span></button></div></section>
        <footer>AirSense–CKM / 城市无线数字孪生演示</footer>
      </template>
    </main>
  </div>
</template>
