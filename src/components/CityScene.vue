<script setup>
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'

const props = defineProps({ data: Object, ckm: Object, events: Array, visual: Object })
const emit = defineEmits(['error', 'select'])
const host = ref(null)
let renderer, labelRenderer, scene, camera, controls, root, knowledge, observer, frame, dynamic, removeModel, addModel, moveModel, resultGroup, resultSignature, sampleButtons = [], pulseTime = 0, previousFrameTime = 0, fusionGroup, fusionId, userClouds = [], clusterRing, clusterCenter, mirrorGroup, buildingMeshes = []
// MATLAB [east, north, altitude] -> Three.js [x, y-up, z].
const point = ([x, y, z = 0]) => new THREE.Vector3(x, z, -y)
function dispose(group) {
  group?.traverse(object => {
    if (object.isCSS2DObject) object.element.remove()
    object.geometry?.dispose()
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    materials.forEach(material => material?.dispose())
  })
  group?.removeFromParent()
}
function label(text, position, parent) {
  const element = document.createElement('span'); element.className = 'map-label'; element.textContent = text
  const object = new CSS2DObject(element); object.position.copy(position); parent.add(object)
}
function shapeFrom(points, center = [0, 0]) {
  return new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x-center[0], y-center[1])))
}
function mesh(geometry, color, position, parent, opacity = 1) {
  const object = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: .45, metalness: .3, transparent: opacity < 1, opacity, depthWrite: opacity === 1 }))
  object.position.copy(position); parent.add(object)
  return object
}
function makeTarget(event, color) {
  const group=new THREE.Group(); dynamic.add(group)
  const pos=point([...event.position,0]); let geometry
  if(event.footprint){ geometry=new THREE.ExtrudeGeometry(shapeFrom(event.footprint,event.position),{depth:event.size[2],bevelEnabled:false});geometry.rotateX(-Math.PI/2) }
  else { geometry=new THREE.BoxGeometry(event.size[0],event.size[2],event.size[1]);pos.y+=event.size[2]/2 }
  const object=mesh(geometry,color,pos,group,.8)
  object.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry),new THREE.LineBasicMaterial({color,transparent:true})))
  return group
}
function setAlpha(group, value) {
  if(!group)return
  group.visible=value>.001
  group.traverse(o=>{if(o.material)o.material.opacity=value*(o.isMesh ? .8 : 1)})
}
// Preset multi-user clustering overlay. Positions are fixed, not pulled to the center.
function makeOverlayMesh(geometry, color, position, parent) {
  const object=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color,transparent:true,opacity:0,depthTest:false,depthWrite:false,side:THREE.DoubleSide}))
  object.position.copy(position);object.renderOrder=30;parent.add(object);return object
}
function updateFusion(){
  const visual=props.visual, event=visual.current, timing=visual.fusionFrame
  if(fusionId!==event?.id){
    dispose(fusionGroup);fusionGroup=new THREE.Group();dynamic.add(fusionGroup)
    fusionId=event?.id;userClouds=[];clusterRing=null;clusterCenter=null;dispose(mirrorGroup);mirrorGroup=new THREE.Group();dynamic.add(mirrorGroup)
    if(event?.fusion){
      for(const [i,user] of event.fusion.userResults.entries()){
        const group=new THREE.Group();fusionGroup.add(group);userClouds.push(group)
        for(const p of user.points){
          makeOverlayMesh(new THREE.SphereGeometry(.23,12,8),user.color,point([...p,.55]),group)
        }
      }
      const center=event.fusion.center
      clusterRing=makeOverlayMesh(new THREE.RingGeometry(event.fusion.radius-.06,event.fusion.radius,80),0xa1e6d8,point([...center,.28]),fusionGroup)
      clusterRing.rotation.x=-Math.PI/2
      clusterCenter=makeOverlayMesh(new THREE.SphereGeometry(.36,16,12),0xe5fff4,point([...center,.65]),fusionGroup)
    }
    if(event?.reflection){
      const reflection=event.reflection
      const bs=point([...reflection.baseStation, .8]), vbs=point([...reflection.virtualBaseStation, .8])
      const guideGeometry=new THREE.BufferGeometry().setFromPoints([bs,vbs])
      const guide=new THREE.Line(guideGeometry,new THREE.LineBasicMaterial({color:0xe5bb78,transparent:true,opacity:0,depthTest:false}));guide.renderOrder=31;mirrorGroup.add(guide);mirrorGroup.userData.guide=guide
      const a=reflection.guideA,b=reflection.guideB
      const facePoints=[point([...a,1.2]),point([...b,1.2]),point([...b,reflection.face.height+1.2]),point([...a,reflection.face.height+1.2]),point([...a,1.2])]
      const face=new THREE.Line(new THREE.BufferGeometry().setFromPoints(facePoints),new THREE.LineBasicMaterial({color:0xff8a82,transparent:true,opacity:0,depthTest:false}));face.renderOrder=32;mirrorGroup.add(face);mirrorGroup.userData.face=face
      const rp=point([...reflection.rp,.9]);const rpMarker=makeOverlayMesh(new THREE.SphereGeometry(.28,14,10),0xff8a82,rp,mirrorGroup);mirrorGroup.userData.rp=rpMarker
      label('共同 VBS',vbs.clone().add(new THREE.Vector3(0,1.5,0)),mirrorGroup);label('真实反射面',rp.clone().add(new THREE.Vector3(0,reflection.face.height*.35,0)),mirrorGroup)
    }
  }
  if(!event?.fusion||!timing)return
  const active=timing.userCount>0 && !timing.localized
  buildingMeshes.forEach(box=>{box.material.opacity=active ? .12 : .38})
  userClouds.forEach((group,i)=>group.traverse(o=>{if(o.material)o.material.opacity=timing.userProgress[i]*timing.fusionOpacity}))
  if(clusterRing){
    clusterRing.material.opacity=timing.clusterProgress*timing.fusionOpacity
    clusterRing.scale.setScalar(1.25-.25*timing.clusterProgress)
    clusterCenter.material.opacity=Math.max(0,(timing.clusterProgress-.65)/.35)*timing.fusionOpacity
  }
  if(mirrorGroup?.userData.guide){
    const mirrorProgress=timing.mirrorProgress*timing.fusionOpacity
    mirrorGroup.userData.guide.material.opacity=mirrorProgress*.85
    mirrorGroup.userData.face.material.opacity=timing.faceProgress*timing.fusionOpacity*.9
    mirrorGroup.userData.rp.material.opacity=timing.faceProgress*timing.fusionOpacity
    mirrorGroup.children.filter(o=>o.isCSS2DObject).forEach(o=>{o.element.style.opacity=String(Math.max(0,timing.faceProgress*timing.fusionOpacity))})
  }
}
function updateVisual(){
  if(!dynamic||!props.visual)return
  setAlpha(removeModel,props.visual.removeAlpha);setAlpha(addModel,props.visual.addAlpha);setAlpha(moveModel,props.visual.moveAlpha??0)
  if(moveModel){
    const origin=props.events.find(e=>e.type==='obstacle_remove')
    const destination=props.events.find(e=>e.type==='obstacle_move')
    const travel=props.visual.current?.type==='obstacle_move'?1-props.visual.fusionFrame.transition:0
    moveModel.position.copy(point([...origin.position,0]).sub(point([...destination.position,0])).multiplyScalar(travel))
  }
  updateFusion()
  sampleButtons.forEach((b,i)=>{
    b.classList.toggle('selected',i===props.visual.selected)
    b.classList.toggle('user-detected',!!props.visual.current && props.visual.fusionFrame.userProgress[i]>0)
    b.style.setProperty('--user-color',['#69a6ff','#e5bb78','#b998ff'][i])
  })
  const signature=props.visual.results.map(e=>e.id).join('|')
  if(signature===resultSignature)return
  resultSignature=signature;dispose(resultGroup);resultGroup=new THREE.Group();dynamic.add(resultGroup)
  for(const event of props.visual.results){
    const color=event.type==='obstacle_remove'?0x69a6ff:event.type==='obstacle_move'?0xe5bb78:0xff847e
    const position=event.mockResult.position
    const ring=mesh(new THREE.RingGeometry(2.4,2.55,64),color,point([...position,.18]),resultGroup,.9);ring.rotation.x=-Math.PI/2;ring.userData.pulse=true
    const outline=event.footprint??[[position[0]-event.size[0]/2,position[1]-event.size[1]/2],[position[0]+event.size[0]/2,position[1]-event.size[1]/2],[position[0]+event.size[0]/2,position[1]+event.size[1]/2],[position[0]-event.size[0]/2,position[1]+event.size[1]/2]]
    const marks=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(outline.map(p=>point([...p,.22]))),new THREE.LineBasicMaterial({color}));resultGroup.add(marks)
    label(event.type==='obstacle_remove'?'已感知 · 消失':event.type==='obstacle_move'?'已感知 · 位移':'已感知 · 新增',point([...position,7]),resultGroup)
  }
}
function renderKnowledge() {
  dispose(knowledge);knowledge=new THREE.Group();scene.add(knowledge);sampleButtons=[]
  for(const [i,sample] of props.ckm.samples.entries()){
    mesh(new THREE.CylinderGeometry(.55,.55,.12,24),0xffd28c,point([...sample.position,.15]),knowledge)
    const element=document.createElement('button');element.className='sample-marker';element.textContent=sample.name.replace('位置 ','');element.setAttribute('aria-label',sample.name)
    element.addEventListener('click',()=>emit('select',i));sampleButtons.push(element)
    const object=new CSS2DObject(element);object.position.copy(point([...sample.position,1.5]));knowledge.add(object)
  }
  updateVisual()
}
function rebuild() {
  if (!scene || !props.data) return
  dispose(root); root = new THREE.Group(); scene.add(root)
  const data = props.data
  root.scale.y = data.view?.verticalScale ?? 1
  const [w, l] = data.ground.size
  const center = point(data.ground.center)
  const ground = mesh(new THREE.PlaneGeometry(w, l), 0x0c2232, center, root)
  ground.rotation.x = -Math.PI / 2
  const grid = new THREE.GridHelper(Math.max(w, l), 20, 0x24586f, 0x153749)
  grid.position.copy(center); grid.position.y += .035; root.add(grid)
  for (const layer of ['greens', 'waters']) for (const item of data[layer] ?? []) {
    const area = mesh(new THREE.ShapeGeometry(shapeFrom(item.points)), layer === 'greens' ? 0x165654 : 0x165785, new THREE.Vector3(0, .08, 0), root, .65)
    area.rotation.x = -Math.PI / 2
  }
  for (const road of data.roads ?? []) {
    root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(road.points.map(p => point([...p, .12]))), new THREE.LineBasicMaterial({ color: 0x5991a5 })))
  }
  buildingMeshes=[]
  for (const item of data.buildings) {
    let geometry
    const position = point(item.position)
    if (item.footprint) {
      geometry = new THREE.ExtrudeGeometry(shapeFrom(item.footprint, item.position), { depth: item.size[2], bevelEnabled: false, steps: 1 })
      geometry.rotateX(-Math.PI / 2)
    } else {
      geometry = new THREE.BoxGeometry(item.size[0], item.size[2], item.size[1]); position.y += item.size[2] / 2
    }
    const box = mesh(geometry, item.color ?? 0x278dba, position, root, item.color ? .75 : .38)
    buildingMeshes.push(box)
    box.rotation.y = THREE.MathUtils.degToRad(item.rotation ?? 0)
    box.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color: 0x56c7ed, transparent: true, opacity: .7 })))
    label(item.name ?? item.id, point([item.position[0], item.position[1], item.position[2] + item.size[2] + 1.3]), root)
  }
  for (const station of data.baseStations) {
    const model = new THREE.Group(); model.position.copy(point(station.position)); root.add(model)
    mesh(new THREE.CylinderGeometry(.18, .35, 4, 10), 0x6ebedd, new THREE.Vector3(0, 2, 0), model)
    mesh(new THREE.BoxGeometry(.8, 1.3, .35), 0x9aeaff, new THREE.Vector3(0, 3.6, 0), model)
    mesh(new THREE.CylinderGeometry(1.2, 1.2, .12, 24), 0x368bad, new THREE.Vector3(0, .06, 0), model)
    model.scale.setScalar((station.height ?? 4.25) / 4.25)
    label(station.name ?? 'BS', point([station.position[0], station.position[1], station.position[2] + (station.height ?? 4.25) + 1.8]), root)
  }
  for (const uav of data.uavs) {
    const model = new THREE.Group(); model.position.copy(point(uav.position)); root.add(model)
    mesh(new THREE.BoxGeometry(1.4, .4, 1), 0xe9f5ff, new THREE.Vector3(), model)
    for (const x of [-1, 1]) for (const z of [-1, 1]) {
      const arm = mesh(new THREE.BoxGeometry(1.8, .12, .14), 0x75c9e7, new THREE.Vector3(x * .5, 0, z * .5), model)
      arm.rotation.y = -Math.atan2(z, x)
      const rotor = mesh(new THREE.TorusGeometry(.55, .05, 6, 24), 0x8defff, new THREE.Vector3(x, .15, z), model)
      rotor.rotation.x = Math.PI / 2
    }
  }
  dispose(dynamic);dynamic=new THREE.Group();dynamic.scale.y=root.scale.y;scene.add(dynamic);resultSignature=null;fusionId=null;fusionGroup=null;mirrorGroup=null
  removeModel=makeTarget(props.events.find(e=>e.type==='obstacle_remove'),0x397bff)
  addModel=makeTarget(props.events.find(e=>e.type==='obstacle_add'),0xff716b)
  const moveEvent=props.events.find(e=>e.type==='obstacle_move')
  moveModel=moveEvent?makeTarget(moveEvent,0x397bff):null
  const bounds = new THREE.Box3().setFromObject(root)
  const target = new THREE.Vector3(0, 3, 0)
  const span = Math.max(...bounds.getSize(new THREE.Vector3()).toArray(), 10)
  camera.position.copy(target).add(new THREE.Vector3(span * .65, span * .8, span * .8))
  if (data.view) {
    const az = THREE.MathUtils.degToRad(data.view.azimuth), el = THREE.MathUtils.degToRad(data.view.elevation)
    camera.position.copy(target).add(new THREE.Vector3(Math.sin(az)*Math.cos(el), Math.sin(el), Math.cos(az)*Math.cos(el)).multiplyScalar(span * 1.35))
  }
  camera.near = Math.max(.1, span / 200); camera.far = span * 10; camera.updateProjectionMatrix()
  controls.target.copy(target); controls.maxDistance = span * 6; controls.update()
  renderKnowledge()
}
watch(() => props.data, rebuild)
watch(() => props.visual, updateVisual)
onMounted(() => {
  try {
    scene = new THREE.Scene(); scene.background = new THREE.Color(0x07131f)
    camera = new THREE.PerspectiveCamera(42, 1, .1, 10000)
    renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.domElement.setAttribute('aria-label', '三维场景：鼠标左键旋转，滚轮缩放，右键平移')
    host.value.appendChild(renderer.domElement)
    labelRenderer = new CSS2DRenderer()
    Object.assign(labelRenderer.domElement.style, { position: 'absolute', inset: '0', pointerEvents: 'none' })
    host.value.appendChild(labelRenderer.domElement)
    controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true; controls.enablePan = true; controls.enableZoom = true
    controls.maxPolarAngle = Math.PI / 2 - .02
    scene.add(new THREE.HemisphereLight(0xb4e8ff, 0x122134, 2))
    const light = new THREE.DirectionalLight(0xc9edff, 3); light.position.set(40, 80, 20); scene.add(light)
    observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      if (!width || !height) return
      renderer.setSize(width, height); labelRenderer.setSize(width, height); camera.aspect = width / height; camera.zoom = Math.min(1, width / height); camera.updateProjectionMatrix()
    })
    observer.observe(host.value); rebuild()
    const animate = (now = 0) => {
      frame = requestAnimationFrame(animate)
      if(props.visual?.pulse && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) pulseTime += Math.min(50, Math.max(0, now-previousFrameTime)) / 1000
      previousFrameTime=now
      resultGroup?.children.forEach(object=>{if(object.userData.pulse){const wave=(pulseTime%1.5)/1.5;object.scale.setScalar(1+wave*.45);object.material.opacity=.9-wave*.6}})
      controls.update(); renderer.render(scene, camera); labelRenderer.render(scene, camera)
    }
    animate()
  } catch (error) { emit('error', `三维场景初始化失败：${error.message}`) }
})
onBeforeUnmount(() => {
  cancelAnimationFrame(frame); observer?.disconnect(); controls?.dispose()
  dispose(root); dispose(knowledge); dispose(dynamic); renderer?.dispose(); renderer?.domElement.remove(); labelRenderer?.domElement.remove()
})
</script>

<template><div ref="host" class="three-host"></div></template>
