# OMapKit Studio

基于 Vue 3、TypeScript、Vite、Pinia、Vue Router、Tailwind CSS 与 shadcn-vue 的地图工作台。地图与地理数据操作由 `openlayers-map-kit` 提供。

## 运行

```sh
pnpm install
pnpm dev
```

打开开发服务器显示的本地地址，默认进入 `/map`。

## 页面

- `/map`：杭州默认视图、高德矢量底图、图层显隐、点线面绘制、距离/面积测量、经纬度定位、仅地图截图和全屏。绘制结果在页面切换时保留，支持手动清空及 GeoJSON 导出。
- `/transform`：粘贴文本或导入单个本地文件，在 GeoJSON、WKT、KML 之间转换，并支持 EPSG:4326 与 EPSG:3857。结果可预览、复制和下载，处理仅在浏览器内完成。

界面和交互范围见 [项目功能清单.md](./项目功能清单.md)。

## 构建

```sh
pnpm build
pnpm preview
```

当前依赖链中的 Vite 8 要求 Node.js `^20.19.0 || >=22.12.0`。建议使用 Node.js 22.12 或更高版本。地图截图依赖浏览器允许将高德瓦片绘制到 Canvas；如果瓦片跨域策略阻止导出，页面会提示失败。
