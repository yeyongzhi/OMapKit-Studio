import { onBeforeUnmount, onMounted, shallowRef } from 'vue'
import type { ShallowRef } from 'vue'
import {
  Draw,
  DrawMode,
  Format,
  FormatType,
  GaodeLayer,
  GaodeLayerType,
  Map as KitMap,
  Measure,
  MeasureMode,
  ProjUtil,
  VectorLayer,
} from 'openlayers-map-kit'
import { useMapWorkspaceStore } from '@/stores/mapWorkspace'
import type { DrawingMode, MapTool, MeasuringMode } from '@/stores/mapWorkspace'
import { captureMap } from './captureMap'

export type DrawingItem = {
  id: string
  label: string
  type: string
  coordinate: string
  geoJson: string
}

const formatGeoJson = () => new Format(FormatType.GeoJSON, {
  dataProjection: 'EPSG:4326',
  extractGeometryName: false,
})

export function useMapWorkspace(element: Readonly<ShallowRef<HTMLElement | null>>) {
  const store = useMapWorkspaceStore()
  const ready = shallowRef(false)
  const notice = shallowRef('')
  const drawingCount = shallowRef(0)
  const drawingEnabled = shallowRef(false)
  const drawingItems = shallowRef<DrawingItem[]>([])
  const selectedDrawingIds = shallowRef<string[]>([])
  const selectedDrawing = shallowRef<DrawingItem | null>(null)
  const measureResult = shallowRef('')
  const fullscreen = shallowRef(false)
  const zoomLevel = shallowRef(store.zoom)

  let map: KitMap | null = null
  let baseLayer: GaodeLayer | null = null
  let drawingsLayer: VectorLayer | null = null
  let draw: Draw | null = null
  let measure: Measure | null = null
  let drawMode: DrawingMode | null = null
  let measureMode: MeasuringMode | null = null
  let noticeTimeout: number | undefined
  let drawEndTimeout: number | undefined
  let clickListener: ReturnType<KitMap['on']> | undefined

  function showNotice(message: string) {
    notice.value = message
    window.clearTimeout(noticeTimeout)
    noticeTimeout = window.setTimeout(() => { notice.value = '' }, 4200)
  }

  function saveViewport() {
    if (!map) return
    const center = map.getCenter()
    if (center) {
      const [longitude, latitude] = ProjUtil.toLonLat(center).toArray()
      store.center = [longitude, latitude]
    }
    const zoom = map.getZoom()
    if (zoom !== undefined) {
      store.zoom = zoom
      zoomLevel.value = zoom
    }
  }

  function saveDrawings() {
    if (!drawingsLayer) return
    const features = drawingsLayer.getFeatures()
    const labels: Record<string, string> = {
      Point: '点', LineString: '线', Polygon: '面',
      MultiPoint: '多点', MultiLineString: '多线', MultiPolygon: '多面',
    }
    drawingItems.value = features.map((feature, index) => {
      if (feature.getId() === null) feature.setId(`drawing-${crypto.randomUUID?.() ?? `${Date.now()}-${index}`}`)
      const serialized = formatGeoJson().writeFeature(feature, {
        dataProjection: 'EPSG:4326',
        featureProjection: 'EPSG:3857',
      })
      const geoJson = JSON.parse(serialized) as { geometry?: { coordinates?: unknown } }
      const findCoordinate = (coordinates: unknown): number[] | null => {
        if (!Array.isArray(coordinates)) return null
        if (coordinates.length >= 2 && typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
          return coordinates as number[]
        }
        for (const value of coordinates) {
          const coordinate = findCoordinate(value)
          if (coordinate) return coordinate
        }
        return null
      }
      const coordinate = findCoordinate(geoJson.geometry?.coordinates)
      return {
        id: String(feature.getId()),
        label: `${labels[feature.getType()] ?? feature.getType()} ${String(index + 1).padStart(2, '0')}`,
        type: feature.getType(),
        coordinate: coordinate ? `${coordinate[0].toFixed(5)}, ${coordinate[1].toFixed(5)}` : '坐标不可用',
        geoJson: JSON.stringify(JSON.parse(serialized), null, 2),
      }
    })
    drawingCount.value = features.length
    const liveIds = new Set(drawingItems.value.map((item) => item.id))
    selectedDrawingIds.value = selectedDrawingIds.value.filter((id) => liveIds.has(id))
    if (selectedDrawing.value && !liveIds.has(selectedDrawing.value.id)) selectedDrawing.value = null
    store.drawingsGeoJson = features.length
      ? formatGeoJson().writeFeatures(features, {
          dataProjection: 'EPSG:4326',
          featureProjection: 'EPSG:3857',
        })
      : ''
  }

  function restoreDrawings() {
    if (!drawingsLayer || !store.drawingsGeoJson) return
    try {
      const features = formatGeoJson().readFeatures(store.drawingsGeoJson, {
        dataProjection: 'EPSG:4326',
        featureProjection: 'EPSG:3857',
      }) as ReturnType<VectorLayer['getFeatures']>
      if (Array.isArray(features) && features.length) drawingsLayer.addFeatures(features)
      saveDrawings()
    } catch {
      store.drawingsGeoJson = ''
      showNotice('之前的绘制数据无法恢复，已清空。')
    }
  }

  function stopDrawing(remove = false) {
    drawingEnabled.value = false
    if (!draw) return
    if (remove) {
      map?.removeInteraction(draw)
      draw.dispose()
      draw = null
      drawMode = null
      return
    }
    draw.setActive(false)
  }

  function startDrawing(mode: DrawingMode) {
    if (!map || !drawingsLayer) return
    stopMeasuring()
    drawingsLayer.setVisible(true)
    store.drawingsVisible = true

    if (draw && drawMode !== mode) stopDrawing(true)
    if (!draw) {
      // Draw 会将传入的 OMap VectorLayer 挂到地图；共享该图层以保留已完成的要素。
      if (drawingsLayer.getTarget() === map) map.removeLayer(drawingsLayer)
      draw = new Draw(DrawMode[mode], { layer: drawingsLayer })
      drawMode = mode
      draw.on('drawend', () => {
        // SDK 的 drawend 在要素写入图层前触发，下一轮事件循环再保存快照。
        window.clearTimeout(drawEndTimeout)
        drawEndTimeout = window.setTimeout(saveDrawings, 0)
      })
      map.addInteraction(draw)
    }
    draw.setActive(true)
    drawingEnabled.value = true
  }

  function stopMeasuring(remove = false) {
    if (!measure) return
    if (remove) {
      map?.removeInteraction(measure)
      measure.dispose()
      measure = null
      measureMode = null
      return
    }
    measure.setActive(false)
  }

  function startMeasuring(mode: MeasuringMode) {
    if (!map) return
    stopDrawing()
    if (measure && measureMode !== mode) stopMeasuring(true)
    if (!measure) {
      measure = new Measure(MeasureMode[mode])
      measureMode = mode
      measure.on('measure:end', (event) => {
        if (event.result) {
          const precision = event.result.value >= 100 ? 0 : 2
          measureResult.value = `${event.result.value.toFixed(precision)} ${event.result.unit}`
        }
      })
      map.addInteraction(measure)
    }
    measure.setActive(true)
  }

  function selectTool(tool: MapTool) {
    store.activeTool = tool
    store.panelOpen = true
    if (tool === 'draw') startDrawing(store.drawingMode)
    else if (tool === 'measure') startMeasuring(store.measuringMode)
    else {
      stopDrawing()
      stopMeasuring()
    }
  }

  function selectDrawingMode(mode: DrawingMode) {
    store.drawingMode = mode
    if (store.activeTool === 'draw') startDrawing(mode)
  }

  function selectMeasuringMode(mode: MeasuringMode) {
    store.measuringMode = mode
    measureResult.value = ''
    if (store.activeTool === 'measure') startMeasuring(mode)
  }

  function finishCurrent() {
    if (store.activeTool === 'draw') draw?.finish()
    if (store.activeTool === 'measure') measure?.finish()
  }

  function cancelCurrent() {
    if (store.activeTool === 'draw') draw?.abort()
    if (store.activeTool === 'measure') measure?.cancel()
  }

  function stopDrawingNow() {
    draw?.abort()
    draw?.setActive(false)
    drawingEnabled.value = false
  }

  function startDrawingNow() {
    startDrawing(store.drawingMode)
  }

  function deleteDrawing(id: string) {
    const feature = drawingsLayer?.getFeatureById(id)
    if (!feature) return
    drawingsLayer?.removeFeature(feature)
    if (selectedDrawing.value?.id === id) selectedDrawing.value = null
    saveDrawings()
  }

  function deleteDrawings(ids: string[]) {
    if (!drawingsLayer || ids.length === 0) return
    const features = ids.map((id) => drawingsLayer?.getFeatureById(id)).filter((feature): feature is NonNullable<typeof feature> => Boolean(feature))
    drawingsLayer.removeFeatures(features)
    if (selectedDrawing.value && ids.includes(selectedDrawing.value.id)) selectedDrawing.value = null
    saveDrawings()
  }

  function inspectDrawing(id: string) {
    selectedDrawing.value = drawingItems.value.find((item) => item.id === id) ?? null
  }

  function toggleDrawingSelection(id: string) {
    selectedDrawingIds.value = selectedDrawingIds.value.includes(id)
      ? selectedDrawingIds.value.filter((selectedId) => selectedId !== id)
      : [...selectedDrawingIds.value, id]
  }

  function selectAllDrawings() {
    selectedDrawingIds.value = selectedDrawingIds.value.length === drawingItems.value.length
      ? []
      : drawingItems.value.map((item) => item.id)
  }

  function clearDrawings() {
    drawingsLayer?.clear()
    saveDrawings()
    showNotice('绘制结果已清空。')
  }

  function clearMeasurement() {
    stopMeasuring(true)
    measureResult.value = ''
    if (store.activeTool === 'measure') startMeasuring(store.measuringMode)
    showNotice('测量结果已清空。')
  }

  function exportDrawings() {
    if (!store.drawingsGeoJson) {
      showNotice('地图上还没有可导出的绘制结果。')
      return
    }
    const file = new Blob([store.drawingsGeoJson], { type: 'application/geo+json;charset=utf-8' })
    const url = URL.createObjectURL(file)
    const link = document.createElement('a')
    link.href = url
    link.download = `omap-drawings-${new Date().toISOString().slice(0, 10)}.geojson`
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    showNotice('绘制结果已导出为 GeoJSON。')
  }

  function setBaseVisible(visible: boolean) {
    store.baseVisible = visible
    baseLayer?.setVisible(visible)
  }

  function setDrawingsVisible(visible: boolean) {
    store.drawingsVisible = visible
    drawingsLayer?.setVisible(visible)
  }

  function locate(longitude: number, latitude: number) {
    if (!map) return
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)
      || longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
      showNotice('请输入有效的经度（-180～180）和纬度（-90～90）。')
      return
    }
    map.animate({
      center: ProjUtil.fromLonLat([longitude, latitude]).toArray(),
      zoom: Math.max(map.getZoom() ?? 12, 13),
      duration: 680,
      easing: 'inAndOut',
    })
    showNotice(`已定位到 ${longitude.toFixed(5)}, ${latitude.toFixed(5)}`)
  }

  async function screenshot() {
    if (!map || !element.value) return
    try {
      await captureMap(map, element.value)
      showNotice('地图截图已保存。')
    } catch (error) {
      const detail = error instanceof Error ? error.message : '未知错误'
      showNotice(`截图失败：${detail}。高德瓦片也可能限制跨域导出。`)
    }
  }

  function syncFullscreen() {
    fullscreen.value = document.fullscreenElement !== null
    window.setTimeout(() => map?.updateSize(), 80)
  }

  async function toggleFullscreen(container: HTMLElement) {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await container.requestFullscreen()
    } catch {
      showNotice('浏览器无法切换全屏。')
    }
  }

  onMounted(() => {
    if (!element.value) return
    try {
      map = new KitMap(element.value, {
        view: {
          center: ProjUtil.fromLonLat(store.center).toArray(),
          zoom: store.zoom,
        },
      })
      baseLayer = new GaodeLayer(GaodeLayerType.Vec, {
        id: 'gaode-base',
        name: '高德矢量底图',
        preload: 0,
        useInterimTilesOnError: true,
        cacheSize: 512,
        source: { crossOrigin: 'anonymous' },
      })
      drawingsLayer = new VectorLayer({
        id: 'drawings',
        name: '绘制结果',
        zIndex: 20,
      })
      map.addLayer(baseLayer)
      map.addLayer(drawingsLayer)
      baseLayer.setVisible(store.baseVisible)
      drawingsLayer.setVisible(store.drawingsVisible)
      restoreDrawings()
      map.on('map:moveend', saveViewport)
      clickListener = map.on('map:singleclick', (event) => {
        if (drawingEnabled.value || !event.pixel || !drawingsLayer) return
        const feature = map?.getFeaturesAtPixel(event.pixel.toArray(), {
          layerFilter: (layer) => layer === drawingsLayer,
          hitTolerance: 8,
          checkWrapped: false,
        })[0]
        const id = feature?.getId()
        if (id !== undefined && id !== null) inspectDrawing(String(id))
      })
      if (store.activeTool === 'draw') startDrawing(store.drawingMode)
      if (store.activeTool === 'measure') startMeasuring(store.measuringMode)
      document.addEventListener('fullscreenchange', syncFullscreen)
      ready.value = true
    } catch (error) {
      showNotice(error instanceof Error ? error.message : '地图初始化失败。')
    }
  })

  onBeforeUnmount(() => {
    window.clearTimeout(noticeTimeout)
    window.clearTimeout(drawEndTimeout)
    document.removeEventListener('fullscreenchange', syncFullscreen)
    if (clickListener && map) map.un(clickListener)
    saveViewport()
    saveDrawings()
    map?.dispose()
    if (drawingsLayer && !drawingsLayer.isDisposed()) drawingsLayer.dispose()
    map = null
  })

  return {
    store,
    ready,
    notice,
    drawingCount,
    drawingEnabled,
    drawingItems,
    selectedDrawingIds,
    selectedDrawing,
    measureResult,
    fullscreen,
    zoomLevel,
    selectTool,
    selectDrawingMode,
    selectMeasuringMode,
    finishCurrent,
    cancelCurrent,
    stopDrawingNow,
    startDrawingNow,
    deleteDrawing,
    deleteDrawings,
    inspectDrawing,
    toggleDrawingSelection,
    selectAllDrawings,
    clearDrawings,
    clearMeasurement,
    exportDrawings,
    setBaseVisible,
    setDrawingsVisible,
    locate,
    screenshot,
    toggleFullscreen,
  }
}
