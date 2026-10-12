const vector = (value, n) => Array.isArray(value) && value.length === n && value.every(Number.isFinite)
const fail = (message) => { throw new Error(message) }
export function validateData(scene, ckm, changes) {
  if (scene.coordinateSystem !== 'ENU_Z_UP' || !['m', 'matlab_display'].includes(scene.units)) fail('场景坐标系或单位无效')
  if (!vector(scene.ground?.center, 3) || !vector(scene.ground?.size, 2) || scene.ground.size.some(v => v <= 0)) fail('地面坐标或尺寸无效')
  const ids = new Set()
  for (const key of ['buildings', 'obstacles', 'baseStations', 'uavs']) {
    if (!Array.isArray(scene[key])) fail(`scene.${key} 必须为数组`)
    for (const item of scene[key]) {
      if (!item.id || ids.has(item.id) || !vector(item.position, 3)) fail(`${key} 的 ID 或三维位置无效`)
      ids.add(item.id)
      if (['buildings', 'obstacles'].includes(key) && (!vector(item.size, 3) || item.size.some(v => v <= 0))) fail(`${item.id} 尺寸须为正数 [宽, 长, 高]`)
      if (item.rotation !== undefined && !Number.isFinite(item.rotation)) fail(`${item.id} 旋转角无效`)
      if (item.footprint !== undefined && (!Array.isArray(item.footprint) || item.footprint.length < 3 || !item.footprint.every(p => vector(p, 2)))) fail(`${item.id} 的建筑轮廓无效`)
      if (item.height !== undefined && (!Number.isFinite(item.height) || item.height <= 0)) fail(`${item.id} 高度无效`)
    }
  }
  for (const layer of ['roads', 'greens', 'waters']) {
    if (scene[layer] !== undefined && (!Array.isArray(scene[layer]) || scene[layer].some(item => !Array.isArray(item.points) || item.points.length < (layer === 'roads' ? 2 : 3) || !item.points.every(p => vector(p, 2))))) fail(`${layer} 的轮廓无效`)
  }
  if (ckm.sceneId !== scene.id || changes.sceneId !== scene.id) fail('三个数据文件的 sceneId 不一致')
  if (ckm.pathType !== 'single_reflection' || !Array.isArray(ckm.samples)) fail('CKM 必须是单次反射路径数据')
  const vbsIds = new Set()
  for (const sample of ckm.samples) {
    if (!vector(sample.position, 2) || !Array.isArray(sample.vbs)) fail('CKM 采样格式无效')
    if (!sample.id || !sample.name || !Array.isArray(sample.paths) || sample.paths.some(path => !['stable', 'remove', 'add'].includes(path.kind) || !Array.isArray(path.points) || path.points.length !== 3 || !path.points.every(p => vector(p, 2)))) fail('代表位置的演示路径格式无效')
    const localIds = new Set()
    for (const vbs of sample.vbs) {
      if (vbs.id === undefined || localIds.has(vbs.id) || !vector(vbs.position, 2)) fail('VBS ID 或位置无效')
      localIds.add(vbs.id); vbsIds.add(vbs.id)
    }
  }
  if (!Array.isArray(changes.events)) fail('events 必须为数组')
  for (const event of changes.events) {
    if (!['obstacle_add', 'obstacle_remove'].includes(event.type) || !vector(event.position, 2) || !vector(event.size, 3) || event.size.some(v => v <= 0) || !event.obstacleId || !Array.isArray(event.affectedVBS) || event.affectedVBS.some(id => !vbsIds.has(id))) fail('变化事件格式或 affectedVBS 引用无效')
  }
  if (!['obstacle_add', 'obstacle_remove'].every(type => changes.events.some(e => e.type === type))) fail('缺少新增或消失事件')
  for (const event of changes.events) { if (!vector(event.mockResult?.position, 2)) fail('预设感知结果坐标无效') }
  return { scene, ckm, changes }
}
export async function loadDemoData(signal) {
  const [scene, ckm, changes] = await Promise.all(['scene.json', 'ckm_database.json', 'change_event.json'].map(async name => {
    const response = await fetch(`${import.meta.env.BASE_URL}data/${name}`, { signal, cache: 'no-store' })
    if (!response.ok) throw new Error(`${name} 加载失败 (${response.status})`)
    try { return await response.json() } catch { throw new Error(`${name} 不是有效 JSON`) }
  }))
  return validateData(scene, ckm, changes)
}
