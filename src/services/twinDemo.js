// All observations below are curated presentation data. They are not outputs of
// a multi-station channel inversion or a live sensor feed.
export const stations = [
  { id: 'BS-01', position: [4, 0], color: '#73dce0', role: '原场景基站' },
  { id: 'BS-02', position: [-24, -16], color: '#f3c17b', role: '演示补充基站' },
  { id: 'BS-03', position: [23, 17], color: '#aa9eff', role: '演示补充基站' },
]

export const scenarios = [
  {
    id: 'structure', number: '01', label: '建筑结构变化', icon: '▥',
    title: '从反射面到地图构件',
    summary: '在既有城市底图上发现一处新增结构；多站提供不同观测方向。',
    position: [-10, 5], size: [8, 5.5, 8.4], kind: '结构',
    outputs: ['可见反射面', '疑似体量', '地图增量'],
    observations: [
      { station: 'BS-01', face: '+x', confidence: 0.91, path: [[4, 0], [-6, 5], [6, 11]] },
      { station: 'BS-02', face: '-x', confidence: 0.86, path: [[-24, -16], [-14, 5], [-20, 13]] },
      { station: 'BS-03', face: '+z', confidence: 0.79, path: [[23, 17], [-10, 8], [11, 14]] },
    ],
    note: '融合后展示三个可观测侧面。屋顶和背面仍属未知，外框仅是示意体量。',
  },
  {
    id: 'vehicle', number: '02', label: '车辆动态', icon: '▰',
    title: '把移动目标写入动态层',
    summary: '跨站关联车辆回波，形成位置与轨迹的演示记录。',
    position: [8, -17], size: [4.4, 2.1, 1.6], kind: '车辆',
    outputs: ['位置估计', '轨迹片段', '动态对象'],
    observations: [
      { station: 'BS-01', face: '+z', confidence: 0.82, path: [[4, 0], [8, -15], [3, -22]] },
      { station: 'BS-02', face: '-x', confidence: 0.78, path: [[-24, -16], [6, -17], [20, -16]] },
      { station: 'BS-03', face: '+x', confidence: 0.73, path: [[23, 17], [10, -17], [20, -16]] },
    ],
    note: '车辆体块仅表示占用范围，不代表从无线观测恢复了车身细节。',
  },
  {
    id: 'crowd', number: '03', label: '人流变化', icon: '◌',
    title: '把群体变化写入区域层',
    summary: '融合多站观测，展示区域占用与流动趋势。',
    position: [-19, 2], size: [9, 8, 1], kind: '人流',
    outputs: ['区域占用', '相对热度', '流动方向'],
    observations: [
      { station: 'BS-01', face: 'east', confidence: 0.76, path: [[4, 0], [-15, 2], [-25, 3]] },
      { station: 'BS-02', face: 'west', confidence: 0.84, path: [[-24, -16], [-20, 0], [-25, 3]] },
      { station: 'BS-03', face: 'north', confidence: 0.71, path: [[23, 17], [-19, 6], [-25, 3]] },
    ],
    note: '热区与人数变化为预设示例，不表示识别了个人身份或精确人体轮廓。',
  },
]

export const steps = [
  { id: 0, label: '城市底图', short: '已有几何' },
  { id: 1, label: '逐站观测', short: '局部视角' },
  { id: 2, label: '多站融合', short: '多个可见面' },
  { id: 3, label: '地图图层', short: '写入结果' },
]

export const stageDuration = 2700
