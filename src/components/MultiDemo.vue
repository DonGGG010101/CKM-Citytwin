<script setup>
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import TwinScene from './TwinScene.vue'
import { scenarios, stations, steps, stageDuration } from '../services/twinDemo'
import { exampleDistrict, parseMapFile } from '../services/mapSources'

defineEmits(['back'])

const sceneData = ref(null), error = ref(''), scenarioId = ref('structure'), step = ref(0)
const selectedStation = ref(''), showPaths = ref(true), playing = ref(false)
const mapSourceId=ref('original'), importedMaps=ref([]), importError=ref(''), fileInput=ref(null)
let timer = null
const scenario = computed(() => scenarios.find(s => s.id === scenarioId.value))
const mapOptions=computed(()=>[{id:'original',name:'原校园场景'},{id:'district',name:'示意街区'},...importedMaps.value.map(item=>({id:item.id,name:item.name}))])
const activeScene=computed(()=>mapSourceId.value==='original'?sceneData.value:mapSourceId.value==='district'?exampleDistrict():importedMaps.value.find(item=>item.id===mapSourceId.value)?.scene??sceneData.value)
const activeMapName=computed(()=>mapOptions.value.find(item=>item.id===mapSourceId.value)?.name??'原校园场景')
const visible = computed(() => step.value === 0 ? [] : step.value === 1 ? scenario.value.observations.slice(0,1) : scenario.value.observations)
const mapVersion = computed(() => step.value >= 3 ? 'V2.0' : 'V1.0')
const stageText = computed(() => [
  '已有城市底图提供建筑、道路与基站的共同坐标。',
  `${visible.value[0]?.station ?? 'BS-01'} 获得一组示意观测；当前只能描述局部可见面。`,
  `三个基站提供不同视角，形成${scenario.value.id === 'crowd' ? '区域热度' : '多个可观测侧面'}。未观测部分保持未知。`,
  `变化结果进入${scenario.value.id === 'structure' ? '城市几何层' : '城市动态层'}，地图版本更新为 V2.0。`,
][step.value])
const coverage = computed(() => scenario.value.id === 'crowd' ? ['—','局部区域','融合区域','已更新'][step.value] : `${visible.value.length}/4`)

async function load() {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}data/scene.json`)
    if (!response.ok) throw new Error(`场景数据加载失败 (${response.status})`)
    const data = await response.json()
    if (!Array.isArray(data.buildings) || !Array.isArray(data.roads)) throw new Error('场景数据格式错误')
    sceneData.value = data
  } catch (e) { error.value = e.message }
}
function stop() { clearInterval(timer); timer = null; playing.value = false }
function chooseScenario(id) { stop(); scenarioId.value=id; step.value=0; selectedStation.value='' }
function chooseStep(value) { stop(); step.value=value; selectedStation.value='' }
function chooseMap() { stop(); step.value=0; selectedStation.value=''; importError.value='' }
async function importMap(event) {
  const file=event.target.files?.[0]; event.target.value=''
  if (!file) return
  try {
    if (file.size>10_000_000) throw new Error('文件超过 10 MB，请先裁剪地图')
    const scene=parseMapFile(JSON.parse(await file.text()),file.name)
    const id=`map-${Date.now()}`
    importedMaps.value=[...importedMaps.value,{id,name:file.name,scene}]
    mapSourceId.value=id; chooseMap()
  } catch(e) { importError.value=e instanceof SyntaxError?'文件不是有效 JSON':e.message }
}
function play() {
  stop(); step.value=0; selectedStation.value=''; playing.value=true
  timer=setInterval(() => {
    if (step.value >= 3) { stop(); return }
    step.value++
    if (step.value >= 3) stop()
  }, stageDuration)
}
function selectStation(id) {
  if (step.value < 2) return
  selectedStation.value = selectedStation.value === id ? '' : id
}
onMounted(load)
onBeforeUnmount(stop)
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <div class="brand"><span class="brand-symbol">◈</span><div><strong>AirSense <em>CKM</em></strong><small>CITY DIGITAL TWIN LAB</small></div></div>
      <div class="topbar-right"><span class="status-light"></span>城市无线数字孪生 <span class="prototype-tag">交互演示</span></div>
    </header>
    <main class="dashboard">
      <div class="journey"><span class="journey-done">✓ 第一步 · 单站障碍物感知</span><span class="journey-line"></span><span class="journey-current">02 第二步 · 多基站城市描述</span><button @click="$emit('back')">← 返回第一步</button></div>
      <section class="intro">
        <div><div class="eyebrow">MULTI-STATION CITY TWIN</div><h1>多基站城市空间描述</h1><p>建筑表面 · 车辆轨迹 · 人流区域</p></div>
        <div class="intro-actions"><button class="quiet-button" @click="chooseStep(0)">↺ 重置</button><button class="primary-button" :disabled="!sceneData" @click="play">{{ playing ? '↻ 重新播放' : '▷ 播放演示' }}</button></div>
      </section>
      <div v-if="error" class="error-box" role="alert">{{ error }} <button @click="load">重新载入</button></div>
      <div v-else-if="!sceneData" class="loading">正在读取城市场景…</div>
      <template v-else>
        <div class="map-source-bar"><span>地图数据源</span><select v-model="mapSourceId" aria-label="选择地图数据源" @change="chooseMap"><option v-for="option in mapOptions" :key="option.id" :value="option.id">{{option.name}}</option></select><button @click="fileInput.click()">＋ 导入地图</button><input ref="fileInput" class="visually-hidden" type="file" accept=".json,.geojson,application/json,application/geo+json" @change="importMap"></div>
        <p v-if="importError" class="import-error" role="alert">{{importError}}</p>
        <section class="scenario-nav" aria-label="感知场景">
          <button v-for="item in scenarios" :key="item.id" :class="['scenario-card', {active:scenarioId===item.id}]" :aria-pressed="scenarioId===item.id" @click="chooseScenario(item.id)">
            <span class="scenario-icon">{{ item.icon }}</span><span class="scenario-copy"><small>{{ item.number }} / SCENARIO</small><b>{{ item.label }}</b></span><span class="scenario-arrow">↗</span>
          </button>
          <div class="scenario-summary"><span>当前地图版本</span><strong>{{ mapVersion }}</strong><small>{{ step>=3 ? '已生成演示增量' : '等待变更写入' }}</small></div>
        </section>
        <div class="workspace-grid">
          <section class="map-panel">
            <div class="panel-heading"><div><span class="section-index">01 / 城市空间</span><h2>多基站观测与三维场景</h2></div><span class="panel-pill">既有底图 + 无线变化层</span></div>
            <div class="scene-stage">
              <TwinScene :scene-data="activeScene" :scenario="scenario" :step="step" :selected-station="selectedStation" :show-paths="showPaths" />
              <div class="map-overlay"><span class="map-live-dot"></span> {{ steps[step].label }} <span class="overlay-divider">/</span> {{ scenario.kind }}</div>
              <div class="map-key"><span><i class="key-dot turquoise"></i>原场景基站</span><span><i class="key-dot amber"></i>补充基站</span><span><i class="key-dot violet"></i>补充基站</span></div>
              <div class="map-controls"><button :aria-pressed="showPaths" @click="showPaths=!showPaths">{{ showPaths ? '◉' : '○' }} 传播路径</button></div>
            </div>
            <div class="map-bottom"><div><small>当前地图</small><strong>{{activeMapName}} <span class="map-credit">{{activeScene.attribution}}</span></strong></div><div><small>可观测面</small><strong>{{ coverage }}</strong></div></div>
          </section>
          <aside class="insight-panel">
            <div class="panel-heading"><div><span class="section-index">02 / 多站结果</span><h2>可观测空间信息</h2></div><span class="signal-mark">⌁</span></div>
            <div class="insight-body">
              <div class="case-heading"><span class="case-type">{{ scenario.label }}</span><h3>{{ scenario.title }}</h3><p>{{ scenario.summary }}</p></div>
              <div class="station-heading"><b>基站观测</b><span>{{ visible.length }} / 3 已接入</span></div>
              <div class="station-list">
                <button v-for="(station,i) in stations" :key="station.id" :disabled="step<2 || i>=visible.length" :class="['station-row',{active:visible.some(o=>o.station===station.id),selected:selectedStation===station.id}]" @click="selectStation(station.id)">
                  <span class="station-swatch" :style="{background:station.color}"></span><span class="station-name"><b>{{ station.id }}</b><small>{{ station.role }}</small></span><span class="station-value">{{ visible[i] ? (scenario.id==='crowd' ? '区域回波' : '可见面 '+visible[i].face) : '等待观测' }}</span><span class="station-check">{{ visible[i] ? '✓' : '—' }}</span>
                </button>
              </div>
              <p class="station-hint">{{ step>=2 ? (selectedStation ? '当前只高亮 '+selectedStation+' 的示意观测；再次点击恢复全部。' : '点击基站查看对应的路径与可见面。') : '继续到多站融合，即可查看各基站的观测。' }}</p>
              <div class="fusion-results"><span class="section-index">融合可视结果</span><div><b>{{scenario.id==='crowd'?'区域热度':coverage}}</b><small>{{scenario.id==='structure'?'可观测侧面':scenario.id==='vehicle'?'示意侧面':'占用范围'}}</small></div><p>{{ stageText }}</p></div>
            </div>
          </aside>
        </div>
        <section class="timeline-panel"><div class="timeline-heading"><div><span class="section-index">03 / 地图更新流程</span><h2>从观测到地图版本</h2></div><span>点击任一阶段，查看对应的三维结果</span></div><div class="step-list"><button v-for="item in steps" :key="item.id" :class="['step-item',{active:step===item.id,completed:step>item.id}]" :aria-current="step===item.id?'step':undefined" @click="chooseStep(item.id)"><span class="step-number">{{ String(item.id+1).padStart(2,'0') }}</span><span><b>{{ item.label }}</b><small>{{ item.short }}</small></span></button></div></section>
        <footer>AirSense–CKM / 城市无线数字孪生演示</footer>
      </template>
    </main>
  </div>
</template>
