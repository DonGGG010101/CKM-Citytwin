// Imports GeoJSON as a display layer. The demo observations are not re-estimated
// from imported geometry and must not be interpreted as geo-registered results.
const number = value => Number.isFinite(Number(value)) ? Number(value) : 0
const polygons = geometry => geometry?.type === 'Polygon' ? [geometry.coordinates] : geometry?.type === 'MultiPolygon' ? geometry.coordinates : []
const lines = geometry => geometry?.type === 'LineString' ? [geometry.coordinates] : geometry?.type === 'MultiLineString' ? geometry.coordinates : []

export function exampleDistrict() {
  const blocks = [
    [-23,-23,8,8,10],[-8,-25,9,8,16],[14,-25,10,8,13],
    [26,-5,8,8,20],[-27,14,8,8,12],[24,25,8,7,17],
    [-13,23,9,8,14],[4,23,10,8,21],[-29,6,5,6,11],
  ]
  const buildings = blocks.map(([x,y,w,d,h],i) => ({
    id:`demo-${i}`,name:`街区 ${String(i+1).padStart(2,'0')}`,position:[x,y,0],size:[w,d,h],
    footprint:[[x-w/2,y-d/2],[x+w/2,y-d/2],[x+w/2,y+d/2],[x-w/2,y+d/2]],
  }))
  const roads = [
    ...[-17,0,10].map((y,i)=>({id:`road-y-${i}`,points:[[-32,y],[32,y]]})),
    {id:'road-x-1',points:[[-17,-32],[-17,32]]},
    {id:'road-x-2',points:[[18,-19],[18,32]]},
  ]
  return {id:'example-district',coordinateSystem:'ENU_Z_UP',units:'display',ground:{center:[0,0,0],size:[66,66]},view:{},buildings,roads,greens:[],waters:[],baseStations:[],uavs:[],attribution:'内置示意街区，非真实城市地图'}
}

export function parseMapFile(raw, filename) {
  if (raw?.coordinateSystem === 'ENU_Z_UP' && Array.isArray(raw.buildings) && Array.isArray(raw.roads) && raw.ground?.size?.length === 2) {
    return {...raw, id:`import-${Date.now()}`, attribution:`用户导入：${filename}`}
  }
  if (raw?.type !== 'FeatureCollection' || !Array.isArray(raw.features)) throw new Error('请选择 GeoJSON FeatureCollection 或本项目 scene.json')
  if (raw.features.length > 500) throw new Error('地图要素超过 500 条，请先裁剪到一个街区')
  const features = raw.features.filter(f => f?.geometry && f.properties)
  const source = features.flatMap(f => polygons(f.geometry).flatMap(poly => poly[0] ?? []).concat(lines(f.geometry).flat()))
  if (!source.length) throw new Error('文件中没有可用的建筑轮廓或道路')
  if (source.length>20000) throw new Error('坐标点超过 20000 个，请简化地图几何')
  if (source.some(p => !Array.isArray(p) || !Number.isFinite(p[0]) || !Number.isFinite(p[1]) || Math.abs(p[0]) > 180 || Math.abs(p[1]) > 90)) throw new Error('GeoJSON 坐标应为经度、纬度；本地投影请先转换')
  const lon = source.reduce((s,p) => s+p[0],0)/source.length
  const lat = source.reduce((s,p) => s+p[1],0)/source.length
  const earth = 111320, cosine = Math.cos(lat*Math.PI/180)
  const project = p => [(p[0]-lon)*earth*cosine,(p[1]-lat)*earth]
  const projected = source.map(project)
  const xs=projected.map(p=>p[0]),ys=projected.map(p=>p[1])
  const x0=(Math.min(...xs)+Math.max(...xs))/2,y0=(Math.min(...ys)+Math.max(...ys))/2
  const span=Math.max(Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys))
  if (span<1 || span>20000) throw new Error('地图范围应为 1 米至 20 公里；请裁剪后导入')
  const scale=58/span
  const xy=p=>{const q=project(p);return [(q[0]-x0)*scale,(q[1]-y0)*scale]}
  const buildings=[], roads=[], greens=[]
  for (const [i,f] of features.entries()) {
    const prop=f.properties??{}, id=String(f.id??`feature-${i}`)
    for (const [polygonIndex,poly] of polygons(f.geometry).entries()) {
      const ring=(poly[0]??[]).slice(0,-1).map(xy)
      if (ring.length<3) continue
      if (prop.building || prop['building:levels'] || prop.height) {
        const x=ring.map(p=>p[0]),y=ring.map(p=>p[1]);const w=Math.max(...x)-Math.min(...x),d=Math.max(...y)-Math.min(...y)
        const physicalHeight=number(prop.height)||number(prop['building:levels'])*3||12
        const height=Math.max(2,Math.min(24,physicalHeight*scale))
        if (w>.15 && d>.15) buildings.push({id:`${id}-${polygonIndex}`,name:String(prop.name??`建筑 ${buildings.length+1}`),position:[(Math.min(...x)+Math.max(...x))/2,(Math.min(...y)+Math.max(...y))/2,0],size:[w,d,height],footprint:ring})
      } else if (prop.landuse || prop.leisure || prop.natural) greens.push({id:`${id}-${polygonIndex}`,points:ring})
    }
    for (const [j,points] of lines(f.geometry).entries()) if (points.length>=2) roads.push({id:`${id}-road-${j}`,points:points.map(xy)})
  }
  if (!buildings.length && !roads.length) throw new Error('未找到建筑或道路；建筑 Polygon 需包含 building/height 属性')
  return {id:`import-${Date.now()}`,coordinateSystem:'ENU_Z_UP',units:'display',ground:{center:[0,0,0],size:[66,66]},view:{},buildings,roads,greens,waters:[],baseStations:[],uavs:[],attribution:`用户导入 GeoJSON：${filename}（局部显示坐标）`}
}
