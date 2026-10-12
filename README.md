# AirSense–CKM 城市无线数字孪生演示

网页分成两步，可以先完整讲解单基站如何感知障碍物，再进入多基站的城市空间描述。两步各有自己的场景、控制与阶段，不共用同一条时间轴。

## 本地运行

需要 Node.js 22.12 或更高版本。在含有 `package.json` 和 `package-lock.json` 的项目目录中运行：

```bash
npm ci
npm run dev
```

打开终端显示的 Local 地址。若解压后没有 `package-lock.json`，先确认当前目录是否为项目根目录；也可运行 `npm install` 生成锁文件。生产构建使用 `npm run build`。

## 第一步：单基站障碍物感知

页面左边是原版三维现场，右边是历史 CKM 与当前观测。选择“目标出现”“目标消失”或“目标移动”后，点击播放或直接点选六个阶段：历史 CKM、环境变化、路径差异、多位置确认、单面定位、CKM 更新。位置 A/B/C 是同一个基站与不同用户位置的观测，不是三个基站。

右侧的多径矩阵标出保留、消失和新增路径；下方将历史路径和当前路径左右并排显示，支持放大。移动事件中，旧目标移到新位置，旧反射径消失且新反射径出现。讲完后点击“进入第二步”。

## 第二步：多基站城市描述

分别选择建筑结构、车辆和人流场景。按阶段查看城市底图、逐站观测、多站融合、地图图层；点击基站可高亮对应的观测。建筑只展示被观测到的侧面，车辆展示占用体块和轨迹，人流展示区域热度。原校园场景和内置示意街区可切换，也可导入 GeoJSON FeatureCollection 或本项目的 `scene.json`。三维视图支持拖动、缩放、平移和隐藏路径。右上方“返回第一步”可重新演示单站过程。

GeoJSON 导入读取 Polygon/MultiPolygon 中带 `building`、`height` 或 `building:levels` 属性的建筑，LineString/MultiLineString 道路，以及带 `landuse`、`leisure`、`natural` 属性的绿地。经纬度会转换成以导入区域为中心的局部显示坐标。建议先裁剪到一个街区；文件上限 10 MB、500 个要素和 20000 个坐标点。导入地图只保留在当前浏览器会话中。

## 演示数据范围

- 第一步读取原项目的 `public/data/scene.json`、`ckm_database.json` 和 `change_event.json`；移动事件与其路径变化在 `src/services/singleDemo.js` 中补充。第二步的 BS-02、BS-03、路径、可见面、轨迹和热区在 `src/services/twinDemo.js` 中预设。
- 信道角度、时延、功率增益以及感知和融合阶段属于讲解用的预设数据。页面没有接入实时测量，也没有运行真实的 Hausdorff 判决、VBS 估计、多基站信道反演、目标关联、几何重建或 CKM 在线更新算法。
- 导入地图仅替换几何底图；基站与目标的示意位置不会自动配准，也不会对新地图重新计算传播。原场景单位是 MATLAB 展示坐标 `matlab_display`，不应直接解释为物理米数。

入口在 `src/App.vue`；两步分别在 `src/components/SingleDemo.vue` 与 `src/components/MultiDemo.vue`。地图适配器在 `src/services/mapSources.js`。
