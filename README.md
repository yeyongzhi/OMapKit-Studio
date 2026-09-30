# OMapKit Studio

基于 Vue 3、TypeScript、Vite、Pinia、Vue Router、Tailwind CSS 与 shadcn-vue 的地图工作台。地图与地理数据操作由 `openlayers-map-kit` 提供。

## 运行

```sh
pnpm install
pnpm dev
```

打开开发服务器显示的本地地址，默认进入 `/map`。

## 页面

- `/map`：杭州默认视图、高德矢量底图、拖放或选择 GeoJSON/KML/WKT 导入、统一源坐标系选择、逐文件导入结果、图层显隐/透明度/排序/重命名、要素属性查看/复制坐标/缩放到要素、点线面绘制、距离/面积测量、经纬度定位、视图收藏、仅地图截图和全屏。导入与绘制结果在页面切换时保留；绘制结果支持 GeoJSON 导出。
- `/transform`：粘贴文本或导入单个本地文件，在 GeoJSON、WKT、KML 之间转换，坐标系选择涵盖 WGS 84、GCJ-02、BD-09、CGCS2000、Web Mercator、UTM 与高斯-克吕格分带。结果可预览、复制、下载或直接加载到地图，处理仅在浏览器内完成。
- `/coordinate`：转换文本、CSV、Excel 和 GeoJSON 坐标；统一坐标系选择器支持 WGS 84、GCJ-02、BD-09、CGCS2000、Web Mercator、UTM、高斯-克吕格 3°/6°带及自定义 EPSG/PROJ。

界面和交互范围见 [项目功能清单.md](./项目功能清单.md)。

## 构建

```sh
pnpm build
pnpm preview
```

当前依赖链中的 Vite 8 要求 Node.js `^20.19.0 || >=22.12.0`。建议使用 Node.js 22.12 或更高版本。地图截图依赖浏览器允许将高德瓦片绘制到 Canvas；如果瓦片跨域策略阻止导出，页面会提示失败。
