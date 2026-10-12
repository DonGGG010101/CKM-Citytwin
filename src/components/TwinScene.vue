<script setup>
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import { stations } from '../services/twinDemo'

const props = defineProps({ sceneData: Object, scenario: Object, step: Number, selectedStation: String, showPaths: Boolean })
const host = ref(null)
let scene, camera, renderer, labels, controls, observer, raf, base, overlay
const to3 = (xy, height = 0) => new THREE.Vector3(xy[0], height, -xy[1])
function material(color, opacity = 1) {
  return new THREE.MeshStandardMaterial({ color, roughness: .42, metalness: .12, transparent: opacity < 1, opacity, side: THREE.DoubleSide, depthWrite: opacity === 1 })
}
function addLabel(text, position, parent, kind = '') {
  const el = document.createElement('span'); el.className = `twin-map-label ${kind}`; el.textContent = text
  const object = new CSS2DObject(el); object.position.copy(position); parent.add(object)
}
function dispose(group) {
  group?.traverse(o => {
    if (o.isCSS2DObject) o.element.remove()
    o.geometry?.dispose()
    const mats = Array.isArray(o.material) ? o.material : [o.material]
    mats.forEach(m => m?.dispose())
  })
  group?.removeFromParent()
}
function polygon(points, color, parent, height = .06) {
  const shape = new THREE.Shape(points.map(p => new THREE.Vector2(p[0], p[1])))
  const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), material(color, .75))
  mesh.rotation.x = -Math.PI / 2; mesh.position.y = height; parent.add(mesh)
}
function buildBase() {
  dispose(base); base = new THREE.Group(); scene.add(base)
  const data = props.sceneData
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(...data.ground.size), material('#0b2031'))
  ground.rotation.x = -Math.PI / 2; base.add(ground)
  const grid = new THREE.GridHelper(66, 22, '#26536a', '#17384b'); grid.position.y = .035; base.add(grid)
  for (const green of data.greens ?? []) polygon(green.points, '#19504b', base)
  for (const road of data.roads ?? []) {
    const curve = new THREE.BufferGeometry().setFromPoints(road.points.map(p => to3(p, .1)))
    base.add(new THREE.Line(curve, new THREE.LineBasicMaterial({ color: '#507b91', transparent: true, opacity: .72 })))
  }
  for (const item of data.buildings) {
    let geometry, position = to3(item.position, 0)
    if (item.footprint) {
      const shape = new THREE.Shape(item.footprint.map(([x, y]) => new THREE.Vector2(x-item.position[0], y-item.position[1])))
      geometry = new THREE.ExtrudeGeometry(shape, { depth: item.size[2], bevelEnabled: false })
      geometry.rotateX(-Math.PI/2)
    } else {
      geometry = new THREE.BoxGeometry(item.size[0], item.size[2], item.size[1]); position.y = item.size[2]/2
    }
    const building = new THREE.Mesh(geometry, material('#2b687f')); building.position.copy(position); base.add(building)
    building.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color: '#68b2c5', transparent: true, opacity: .6 })))
    addLabel(item.name, to3(item.position, item.size[2] + 1.8), base, 'building-label')
  }
  for (const station of stations) {
    const model = new THREE.Group(); model.position.copy(to3(station.position)); base.add(model)
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(.18, .32, 3.6, 10), material(station.color)); mast.position.y = 1.8; model.add(mast)
    const beacon = new THREE.Mesh(new THREE.OctahedronGeometry(.75), new THREE.MeshBasicMaterial({ color: station.color }))
    beacon.position.y = 4.2; model.add(beacon)
    const halo = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.18, 48), new THREE.MeshBasicMaterial({ color: station.color, transparent: true, opacity: .65, side: THREE.DoubleSide }))
    halo.rotation.x = -Math.PI/2; halo.position.y = .12; model.add(halo)
    addLabel(station.id, to3(station.position, 5.8), base, 'station-label')
  }
}
function line(points, color, parent, dashed = false) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points)
  const mat = dashed ? new THREE.LineDashedMaterial({ color, dashSize: .7, gapSize: .45, transparent: true, opacity: .8 }) : new THREE.LineBasicMaterial({ color, transparent: true, opacity: .9 })
  const object = new THREE.Line(geometry, mat); if (dashed) object.computeLineDistances(); parent.add(object); return object
}
function faceGeometry(s, face) {
  const [w, d, h] = s
  const a = new THREE.PlaneGeometry(face.includes('x') ? d : w, h)
  if (face === '+x') a.rotateY(Math.PI/2)
  if (face === '-x') a.rotateY(-Math.PI/2)
  if (face === '-z') a.rotateY(Math.PI)
  return a
}
function faceOffset(s, face) {
  return { '+x':[s[0]/2+.04, 0, 0], '-x':[-s[0]/2-.04,0,0], '+z':[0,0,s[1]/2+.04], '-z':[0,0,-s[1]/2-.04] }[face]
}
function updateOverlay() {
  if (!scene || !props.scenario) return
  dispose(overlay); overlay = new THREE.Group(); scene.add(overlay)
  const sc = props.scenario, active = props.step > 0
  if (!active) return
  const observations = props.step === 1 ? sc.observations.slice(0, 1) : sc.observations
  for (const [i, obs] of observations.entries()) {
    const station = stations.find(s => s.id === obs.station)
    const isSelected = !props.selectedStation || props.selectedStation === obs.station
    if (props.showPaths && isSelected) {
      line(obs.path.map((p, j) => to3(p, j === 1 ? Math.max(1.4, sc.size[2]/2) : 3.3)), station.color, overlay, true)
      const marker = new THREE.Mesh(new THREE.SphereGeometry(.35, 12, 8), new THREE.MeshBasicMaterial({ color: station.color }))
      marker.position.copy(to3(obs.path[1], Math.max(1.4, sc.size[2]/2))); overlay.add(marker)
    }
    if (sc.id === 'crowd') continue
    if (isSelected && obs.face in { '+x':1, '-x':1, '+z':1, '-z':1 }) {
      const s = sc.size
      const face = new THREE.Mesh(faceGeometry(s, obs.face), new THREE.MeshBasicMaterial({ color: station.color, transparent: true, opacity: .47, side: THREE.DoubleSide, depthWrite: false }))
      const offset = faceOffset(s, obs.face)
      face.position.copy(to3(sc.position, s[2]/2)).add(new THREE.Vector3(...offset)); overlay.add(face)
    }
  }
  if (sc.id === 'crowd') {
    const heat = new THREE.Mesh(new THREE.CircleGeometry(props.step === 1 ? 3.2 : 5.4, 48), new THREE.MeshBasicMaterial({ color: props.step === 1 ? '#73dce0' : '#f3a873', transparent: true, opacity: .32, side: THREE.DoubleSide, depthWrite: false }))
    heat.rotation.x = -Math.PI/2; heat.position.copy(to3(sc.position, .18)); overlay.add(heat)
    if (props.step >= 2) {
      for (const [dx,dy] of [[-2,-1],[1,1],[3,-2],[-1,3],[0,-3]]) {
        const dot = new THREE.Mesh(new THREE.SphereGeometry(.34, 10, 8), new THREE.MeshBasicMaterial({ color:'#ffcb95' }))
        dot.position.copy(to3([sc.position[0]+dx,sc.position[1]+dy], .7)); overlay.add(dot)
      }
      line([[-22,-2],[-19,2],[-15,7]].map(p => to3(p,.45)), '#ffcb95', overlay, true)
    }
  } else {
    const [w, d, h] = sc.size
    const cube = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), new THREE.MeshBasicMaterial({ color: sc.id === 'vehicle' ? '#f2b16f' : '#6bdbce', transparent: true, opacity: props.step >= 3 ? .19 : .055, depthWrite:false }))
    cube.position.copy(to3(sc.position, h/2)); overlay.add(cube)
    if (props.step >= 2) {
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(cube.geometry), new THREE.LineDashedMaterial({ color: '#d4f4ef', dashSize:.7, gapSize:.45, transparent:true, opacity:.6 }))
      edges.position.copy(cube.position); edges.computeLineDistances(); overlay.add(edges)
    }
    if (sc.id === 'vehicle' && props.step >= 2) line([[1,-17],[4,-17],[8,-17],[13,-18]].map(p=>to3(p,.28)), '#f5c581', overlay, true)
  }
  if (props.step >= 3) addLabel(sc.id === 'structure' ? '新增结构 · 已记入地图' : sc.id === 'vehicle' ? '车辆轨迹 · 动态层' : '人流热区 · 动态层', to3(sc.position, sc.id === 'structure' ? sc.size[2]+2 : 3), overlay, 'target-label')
}
watch(() => props.sceneData, buildBase)
watch(() => [props.scenario, props.step, props.selectedStation, props.showPaths], updateOverlay)
onMounted(() => {
  scene = new THREE.Scene(); scene.background = new THREE.Color('#081725')
  camera = new THREE.PerspectiveCamera(45, 1, .1, 600)
  camera.position.set(56, 75, 76)
  renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.domElement.setAttribute('aria-label', '城市数字孪生三维场景'); host.value.append(renderer.domElement)
  labels = new CSS2DRenderer(); Object.assign(labels.domElement.style, { position:'absolute', inset:0, pointerEvents:'none' }); host.value.append(labels.domElement)
  controls = new OrbitControls(camera, renderer.domElement); controls.target.set(0,2,0); controls.enableDamping = true; controls.maxPolarAngle = Math.PI/2-.04
  scene.add(new THREE.HemisphereLight('#cefaff', '#0a233a', 2.8))
  const light = new THREE.DirectionalLight('#c7f6ff', 2.4); light.position.set(15,55,20); scene.add(light)
  observer = new ResizeObserver(([entry]) => {
    const {width,height} = entry.contentRect; if (!width || !height) return
    renderer.setSize(width,height); labels.setSize(width,height); camera.aspect=width/height; camera.updateProjectionMatrix()
  }); observer.observe(host.value)
  buildBase(); updateOverlay()
  const render = () => { raf=requestAnimationFrame(render); controls.update(); renderer.render(scene,camera); labels.render(scene,camera) }; render()
})
onBeforeUnmount(() => { cancelAnimationFrame(raf); observer?.disconnect(); controls?.dispose(); dispose(base); dispose(overlay); renderer?.dispose(); renderer?.domElement.remove(); labels?.domElement.remove() })
</script>
<template><div ref="host" class="twin-three-host"></div></template>
