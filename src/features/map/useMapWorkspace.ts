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
  Point,
  ProjUtil,
  Style,
  VectorLayer,
} from 'openlayers-map-kit'
import { useMapWorkspaceStore } from '@/stores/mapWorkspace'
import type { DrawingMode, ImportFormat, ImportProjection, ImportedLayerData, MapAnnotation, MapAnnotationDraft, MapTool, MeasuringMode, PendingMapImport, SavedMapView } from '@/stores/mapWorkspace'
import { convertData } from '@/features/transform/convertData'
import { captureMap } from './captureMap'
import { useMapTools } from './useMapTools'

export type DrawingItem = {
  id: string
  label: string
  type: string
  coordinate: string
  geoJson: string
}

export type FeaturePopupProperty = {
  name: string
  value: string
  isComplex: boolean
}

export type FeaturePopup = {
  layerId: string
  layerName: string
  featureId: string
  geometryType: string
  coordinate: string
  extent: [number, number, number, number] | null
  properties: FeaturePopupProperty[]
  geoJson: string
}

export type ImportFileReport = {
  id: string
  fileName: string
  format?: ImportFormat
  status: 'loading' | 'success' | 'error'
  featureCount: number
  layerName?: string
  error?: string
}

export type WorkspaceLayerItem = {
  id: string
  name: string
  kind: 'basemap' | 'drawings' | 'annotations' | 'imported'
  subtitle: string
  visible: boolean
  opacity: number
  canRename: boolean
  canRemove: boolean
  canReorder: boolean
  canZoom: boolean
}

type RuntimeImportedLayer = {
  data: ImportedLayerData
  layer: VectorLayer
}

type OrderedLayer = {
  id: string
  layer: VectorLayer
}

type ImportSource = {
  fileName: string
  sourceProjection: ImportProjection
  sourceCustomProjection?: string
  read: () => Promise<string>
  format?: ImportFormat
}

const DEFAULT_CENTER: [number, number] = [120.1551, 30.2741]
const DEFAULT_ZOOM = 11
const SAVED_VIEWS_STORAGE_KEY = 'omapkit-studio-map-saved-views'

const formatGeoJson = () => new Format(FormatType.GeoJSON, {
  dataProjection: 'EPSG:4326',
  featureProjection: 'EPSG:3857',
  extractGeometryName: false,
})

function createId(prefix: string) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`}`
}

function findFirstCoordinate(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null
  if (value.length >= 2 && typeof value[0] === 'number' && typeof value[1] === 'number') return value as number[]
  for (const child of value) {
    const coordinate = findFirstCoordinate(child)
    if (coordinate) return coordinate
  }
  return null
}

function createFeaturePopup(
  geoJson: string,
  layerId: string,
  layerName: string,
  featureId: string,
  extent: [number, number, number, number] | null = null,
): FeaturePopup {
  const feature = JSON.parse(geoJson) as {
    geometry?: { type?: unknown; coordinates?: unknown } | null
    properties?: Record<string, unknown> | null
  }
  const coordinate = findFirstCoordinate(feature.geometry?.coordinates)
  const properties = feature.properties && typeof feature.properties === 'object'
    ? Object.entries(feature.properties).map(([name, value]) => ({
        name,
        value: value !== null && typeof value === 'object'
          ? JSON.stringify(value, null, 2)
          : String(value ?? ''),
        isComplex: value !== null && typeof value === 'object',
      }))
    : []

  return {
    layerId,
    layerName,
    featureId,
    geometryType: String(feature.geometry?.type ?? '无几何图形'),
    coordinate: coordinate ? `${coordinate[0].toFixed(6)}, ${coordinate[1].toFixed(6)}` : '坐标不可用',
    extent,
    properties,
    geoJson: JSON.stringify(feature, null, 2),
  }
}

function getImportFormat(fileName: string): ImportFormat {
  const extension = fileName.split('.').pop()?.toLowerCase()
  if (extension === 'geojson' || extension === 'json') return 'GeoJSON'
  if (extension === 'kml') return 'KML'
  if (extension === 'wkt' || extension === 'txt') return 'WKT'
  throw new Error('仅支持 GeoJSON、KML 和 WKT 文件。')
}

export function useMapWorkspace(element: Readonly<ShallowRef<HTMLElement | null>>) {
  const store = useMapWorkspaceStore()
  const ready = shallowRef(false)
  const notice = shallowRef('')
  const drawingCount = shallowRef(0)
  const drawingEnabled = shallowRef(false)
  const drawingItems = shallowRef<DrawingItem[]>([])
  const selectedDrawingIds = shallowRef<string[]>([])
  const featurePopup = shallowRef<FeaturePopup | null>(null)
  const measureResult = shallowRef('')
  const fullscreen = shallowRef(false)
  const zoomLevel = shallowRef(store.zoom)
  const layerItems = shallowRef<WorkspaceLayerItem[]>([])
  const importBusy = shallowRef(false)
  const importReports = shallowRef<ImportFileReport[]>([])
  const importedRuntimeLayers = shallowRef<RuntimeImportedLayer[]>([])
  const annotationPickMode = shallowRef(false)
  const pickedAnnotationCoordinate = shallowRef<[number, number] | null>(null)

  let map: KitMap | null = null
  let baseLayer: GaodeLayer | null = null
  let drawingsLayer: VectorLayer | null = null
  let annotationsLayer: VectorLayer | null = null
  let draw: Draw | null = null
  let measure: Measure | null = null
  let drawMode: DrawingMode | null = null
  let measureMode: MeasuringMode | null = null
  let noticeTimeout: number | undefined
  let drawEndTimeout: number | undefined
  let clickListener: ReturnType<KitMap['on']> | undefined

  const tools = useMapTools({
    map: () => map,
    vectors: () => [drawingsLayer, ...importedRuntimeLayers.value.map(entry => entry.layer)].filter((layer): layer is VectorLayer => layer !== null),
    sync: (layer) => {
      if (layer === drawingsLayer) saveDrawings()
      const entry = importedRuntimeLayers.value.find(entry => entry.layer === layer)
      if (entry) {
        entry.data.geoJson = formatGeoJson().writeFeatures(layer.getFeatures(), { dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857' })
        persistImportedLayers()
      }
      featurePopup.value = null
      refreshLayerItems()
    },
    notice: showNotice,
    preferences: (layer, visible, opacity) => {
      setLayerVisible(String(layer.getId()), visible)
      setLayerOpacity(String(layer.getId()), opacity)
    },
  })

  function showNotice(message: string) {
    notice.value = message
    window.clearTimeout(noticeTimeout)
    noticeTimeout = window.setTimeout(() => { notice.value = '' }, 5000)
  }

  function setBasemap(style: 'vec' | 'img') {
    if (!map || !baseLayer || store.baseStyle === style) return
    const replacement = new GaodeLayer(style === 'img' ? GaodeLayerType.Img : GaodeLayerType.Vec, {
      id: 'gaode-base', name: style === 'img' ? '高德卫星影像' : '高德街道底图',
      preload: 0, useInterimTilesOnError: true, cacheSize: 512,
      visible: store.baseVisible, opacity: store.baseOpacity, source: { crossOrigin: 'anonymous' },
    })
    map.removeLayer(baseLayer); baseLayer.dispose(); baseLayer = replacement
    map.addLayer(baseLayer); store.baseStyle = style; refreshLayerItems()
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

  function orderedVectorLayers(): OrderedLayer[] {
    const layers: OrderedLayer[] = []
    if (drawingsLayer) layers.push({ id: 'drawings', layer: drawingsLayer })
    if (annotationsLayer) layers.push({ id: 'annotations', layer: annotationsLayer })
    for (const entry of importedRuntimeLayers.value) layers.push({ id: entry.data.id, layer: entry.layer })

    const rank = new Map(store.layerOrder.map((id, index) => [id, index]))
    return layers.sort((left, right) => (rank.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(right.id) ?? Number.MAX_SAFE_INTEGER))
  }

  function applyLayerOrder() {
    const ordered = orderedVectorLayers()
    store.layerOrder = ordered.map((entry) => entry.id)
    ordered.forEach((entry, index) => entry.layer.setZIndex((ordered.length - index) * 10 + 20))
  }

  function refreshLayerItems() {
    const managedItems: WorkspaceLayerItem[] = orderedVectorLayers().map(({ id, layer }) => {
      if (id === 'drawings') {
        const count = layer.getFeatures().length
        return {
          id,
          name: layer.getName(),
          kind: 'drawings',
          subtitle: `绘制 · ${count} 个要素`,
          visible: layer.getVisible(),
          opacity: layer.getOpacity(),
          canRename: true,
          canRemove: false,
          canReorder: true,
          canZoom: count > 0,
        }
      }

      if (id === 'annotations') {
        const count = layer.getFeatures().length
        return {
          id,
          name: layer.getName(),
          kind: 'annotations',
          subtitle: `坐标标注 · ${count} 个标记`,
          visible: layer.getVisible(),
          opacity: layer.getOpacity(),
          canRename: true,
          canRemove: false,
          canReorder: true,
          canZoom: count > 0,
        }
      }

      const entry = importedRuntimeLayers.value.find((item) => item.data.id === id)
      const count = layer.getFeatures().length
      return {
        id,
        name: layer.getName(),
        kind: 'imported',
        subtitle: `${entry?.data.format ?? '导入'} · ${count} 个要素`,
        visible: layer.getVisible(),
        opacity: layer.getOpacity(),
        canRename: true,
        canRemove: true,
        canReorder: true,
        canZoom: count > 0,
      }
    })

    if (baseLayer) {
      managedItems.push({
        id: 'gaode-base',
        name: baseLayer.getName(),
        kind: 'basemap',
        subtitle: store.baseStyle === 'img' ? '底图 · 卫星影像' : '底图 · 街道',
        visible: baseLayer.getVisible(),
        opacity: baseLayer.getOpacity(),
        canRename: false,
        canRemove: false,
        canReorder: false,
        canZoom: false,
      })
    }
    layerItems.value = managedItems
  }

  function saveDrawings() {
    if (!drawingsLayer) return
    const features = drawingsLayer.getFeatures()
    const labels: Record<string, string> = {
      Point: '点', LineString: '线', Polygon: '面',
      MultiPoint: '多点', MultiLineString: '多线', MultiPolygon: '多面',
    }
    drawingItems.value = features.map((feature, index) => {
      if (feature.getId() === null) feature.setId(createId('drawing'))
      const serialized = formatGeoJson().writeFeature(feature, {
        dataProjection: 'EPSG:4326',
        featureProjection: 'EPSG:3857',
      })
      const geoJson = JSON.parse(serialized) as { geometry?: { coordinates?: unknown } }
      const coordinate = findFirstCoordinate(geoJson.geometry?.coordinates)
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
    if (featurePopup.value?.layerId === 'drawings' && !liveIds.has(featurePopup.value.featureId)) featurePopup.value = null
    store.drawingsGeoJson = features.length
      ? formatGeoJson().writeFeatures(features, {
          dataProjection: 'EPSG:4326',
          featureProjection: 'EPSG:3857',
        })
      : ''
    refreshLayerItems()
  }

  function createAnnotationFeature(annotation: MapAnnotation) {
    const feature = new Point(ProjUtil.fromLonLat([annotation.longitude, annotation.latitude]).toArray(), {
      name: annotation.label,
      longitude: annotation.longitude,
      latitude: annotation.latitude,
      color: annotation.color,
      size: annotation.size,
      shape: annotation.shape,
    })
    feature.setId(annotation.id)
    const fill = { color: annotation.color }
    const stroke = { color: '#ffffff', width: 2 }
    const markerStyle = annotation.shape === 'circle'
      ? new Style({ circle: { radius: annotation.size / 2, fill, stroke } })
      : new Style({ regularShape: {
          points: annotation.shape === 'square' ? 4 : 3,
          radius: annotation.size / 2,
          angle: annotation.shape === 'square' ? Math.PI / 4 : 0,
          fill,
          stroke,
        } })
    feature.setStyle(markerStyle)
    return feature
  }

  function refreshAnnotationFeatures() {
    if (!annotationsLayer) return
    annotationsLayer.clear()
    const features = store.annotations.map(createAnnotationFeature)
    if (features.length) annotationsLayer.addFeatures(features)
    refreshLayerItems()
  }

  function saveAnnotation(draft: MapAnnotationDraft) {
    if (!annotationsLayer || !map) {
      showNotice('地图尚未准备好，标注没有添加，请稍后重试。')
      return
    }
    const existing = draft.id ? store.annotations.find((annotation) => annotation.id === draft.id) : undefined
    const annotation: MapAnnotation = {
      id: existing?.id ?? createId('annotation'),
      longitude: draft.longitude,
      latitude: draft.latitude,
      label: draft.label.trim() || existing?.label || `标注 ${store.annotations.length + 1}`,
      color: draft.color,
      size: Math.min(24, Math.max(6, draft.size)),
      shape: draft.shape,
    }
    store.annotations = existing
      ? store.annotations.map((item) => item.id === annotation.id ? annotation : item)
      : [...store.annotations, annotation]
    annotationsLayer.setVisible(true)
    store.annotationsVisible = true
    refreshAnnotationFeatures()
    map?.animate({
      center: ProjUtil.fromLonLat([annotation.longitude, annotation.latitude]).toArray(),
      zoom: Math.max(map.getZoom() ?? 12, 14),
      duration: 600,
      easing: 'inAndOut',
    })
    showNotice(existing ? `标注“${annotation.label}”已更新。` : `已添加标注“${annotation.label}”。`)
  }

  function deleteAnnotation(id: string) {
    const target = store.annotations.find((annotation) => annotation.id === id)
    if (!target) return
    store.annotations = store.annotations.filter((annotation) => annotation.id !== id)
    if (featurePopup.value?.layerId === 'annotations' && featurePopup.value.featureId === id) featurePopup.value = null
    refreshAnnotationFeatures()
    showNotice(`标注“${target.label}”已删除。`)
  }

  function zoomToAnnotation(id: string) {
    const annotation = store.annotations.find((item) => item.id === id)
    if (!map || !annotation) return
    map.animate({
      center: ProjUtil.fromLonLat([annotation.longitude, annotation.latitude]).toArray(),
      zoom: Math.max(map.getZoom() ?? 12, 14),
      duration: 600,
      easing: 'inAndOut',
    })
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

  function restoreImportedLayers() {
    if (!store.importedLayers.length) return
    const restored: RuntimeImportedLayer[] = []
    for (const data of store.importedLayers) {
      try {
        const features = formatGeoJson().readFeatures(data.geoJson, {
          dataProjection: 'EPSG:4326',
          featureProjection: 'EPSG:3857',
        }) as ReturnType<VectorLayer['getFeatures']>
        if (!Array.isArray(features) || features.length === 0) continue
        const layer = new VectorLayer({ id: data.id, name: data.name, zIndex: 20 })
        layer.addFeatures(features)
        layer.setVisible(data.visible)
        layer.setOpacity(data.opacity)
        map?.addLayer(layer)
        restored.push({ data: { ...data }, layer })
      } catch {
        showNotice(`图层“${data.name}”无法恢复，已跳过。`)
      }
    }
    importedRuntimeLayers.value = restored
    store.importedLayers = restored.map((entry) => entry.data)
    const validIds = new Set(['drawings', 'annotations', ...restored.map((entry) => entry.data.id)])
    store.layerOrder = [
      ...store.layerOrder.filter((id) => validIds.has(id)),
      ...restored.map((entry) => entry.data.id).filter((id) => !store.layerOrder.includes(id)),
      ...(!store.layerOrder.includes('drawings') ? ['drawings'] : []),
    ]
    applyLayerOrder()
    refreshLayerItems()
  }

  function persistImportedLayers() {
    store.importedLayers = importedRuntimeLayers.value.map((entry) => ({ ...entry.data }))
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
    tools.stop()
    stopMeasuring()
    drawingsLayer.setVisible(true)
    store.drawingsVisible = true
    refreshLayerItems()

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
    tools.stop()
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
    tools.stop()
    tools.state.error = ''
    store.activeTool = tool
    store.panelOpen = true
    annotationPickMode.value = false
    if (tool === 'draw') startDrawing(store.drawingMode)
    else if (tool === 'measure') startMeasuring(store.measuringMode)
    else {
      stopDrawing()
      stopMeasuring()
    }
    tools.refreshTargets()
    if (tool === 'select' || tool === 'edit') tools.activate(tool)
  }

  function startAnnotationPick() {
    tools.stop()
    if (!map || !annotationsLayer) {
      showNotice('地图尚未准备好，请稍后再选点。')
      return
    }
    stopDrawing()
    stopMeasuring()
    store.activeTool = 'annotations'
    store.panelOpen = true
    annotationPickMode.value = true
    featurePopup.value = null
    showNotice('请在地图上单击标注位置。')
  }

  function cancelAnnotationPick() {
    annotationPickMode.value = false
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
    if (featurePopup.value?.layerId === 'drawings' && featurePopup.value.featureId === id) featurePopup.value = null
    saveDrawings()
  }

  function deleteDrawings(ids: string[]) {
    if (!drawingsLayer || ids.length === 0) return
    const features = ids.map((id) => drawingsLayer?.getFeatureById(id)).filter((feature): feature is NonNullable<typeof feature> => Boolean(feature))
    drawingsLayer.removeFeatures(features)
    if (featurePopup.value?.layerId === 'drawings' && ids.includes(featurePopup.value.featureId)) featurePopup.value = null
    saveDrawings()
  }

  function openFeaturePopup(feature: ReturnType<VectorLayer['getFeatures']>[number], layerId: string, layerName: string) {
    const id = feature.getId() === null ? createId('feature') : String(feature.getId())
    const geoJson = formatGeoJson().writeFeature(feature, {
      dataProjection: 'EPSG:4326',
      featureProjection: 'EPSG:3857',
    })
    const extent = feature.getGeometry()?.getExtent() as [number, number, number, number] | undefined
    featurePopup.value = createFeaturePopup(geoJson, layerId, layerName, id, extent ?? null)
  }

  async function copyFeatureCoordinate() {
    const coordinate = featurePopup.value?.coordinate
    if (!coordinate || coordinate === '坐标不可用') return
    try {
      await navigator.clipboard.writeText(coordinate)
      showNotice('要素坐标已复制。')
    } catch {
      showNotice('复制坐标失败，请手动选择坐标。')
    }
  }

  function zoomToFeature() {
    const extent = featurePopup.value?.extent
    if (!map || !extent) {
      showNotice('这个要素没有可缩放的几何范围。')
      return
    }
    map.fit(extent, {
      padding: [80, store.panelOpen ? 340 : 80, 80, 80],
      nearest: true,
      minResolution: 0,
      maxZoom: 17,
      duration: 650,
      easing: 'inAndOut',
    })
  }

  function inspectDrawing(id: string) {
    const item = drawingItems.value.find((drawing) => drawing.id === id)
    if (!item) return
    const feature = drawingsLayer?.getFeatureById(id)
    if (feature) openFeaturePopup(feature, 'drawings', drawingsLayer?.getName() ?? store.drawingsName)
    else featurePopup.value = createFeaturePopup(item.geoJson, 'drawings', store.drawingsName, item.id)
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
    featurePopup.value = featurePopup.value?.layerId === 'drawings' ? null : featurePopup.value
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

  function getManagedVectorLayer(id: string) {
    if (id === 'drawings') return drawingsLayer
    if (id === 'annotations') return annotationsLayer
    return importedRuntimeLayers.value.find((entry) => entry.data.id === id)?.layer ?? null
  }

  function setLayerVisible(id: string, visible: boolean) {
    if (tools.changeGroupChild(id, { visible })) return
    const layer = id === 'gaode-base' ? baseLayer : getManagedVectorLayer(id)
    if (!layer) return
    layer.setVisible(visible)
    if (id === 'gaode-base') store.baseVisible = visible
    else if (id === 'drawings') store.drawingsVisible = visible
    else if (id === 'annotations') store.annotationsVisible = visible
    else {
      const entry = importedRuntimeLayers.value.find((item) => item.data.id === id)
      if (entry) entry.data.visible = visible
      persistImportedLayers()
    }
    refreshLayerItems()
  }

  function setLayerOpacity(id: string, opacity: number) {
    const value = Math.min(1, Math.max(0, opacity))
    if (tools.changeGroupChild(id, { opacity: value })) return
    const layer = id === 'gaode-base' ? baseLayer : getManagedVectorLayer(id)
    if (!layer) return
    layer.setOpacity(value)
    if (id === 'gaode-base') store.baseOpacity = value
    else if (id === 'drawings') store.drawingsOpacity = value
    else if (id === 'annotations') store.annotationsOpacity = value
    else {
      const entry = importedRuntimeLayers.value.find((item) => item.data.id === id)
      if (entry) entry.data.opacity = value
      persistImportedLayers()
    }
    refreshLayerItems()
  }

  function renameLayer(id: string, name: string) {
    const trimmedName = name.trim()
    if (!trimmedName) return
    const layer = getManagedVectorLayer(id)
    if (!layer) return
    layer.setName(trimmedName)
    const child = tools.state.children.find(child => child.id === id)
    if (child) child.name = trimmedName
    if (id === 'drawings') store.drawingsName = trimmedName
    else if (id === 'annotations') store.annotationsName = trimmedName
    else {
      const entry = importedRuntimeLayers.value.find((item) => item.data.id === id)
      if (entry) entry.data.name = trimmedName
      persistImportedLayers()
    }
    refreshLayerItems()
  }

  function moveLayer(id: string, direction: -1 | 1) {
    const ordered = orderedVectorLayers()
    const index = ordered.findIndex((entry) => entry.id === id)
    const target = index + direction
    if (index < 0 || target < 0 || target >= ordered.length) return
    const next = [...ordered]
    ;[next[index], next[target]] = [next[target], next[index]]
    store.layerOrder = next.map((entry) => entry.id)
    applyLayerOrder()
    refreshLayerItems()
  }

  function removeLayer(id: string) {
    const entry = importedRuntimeLayers.value.find((item) => item.data.id === id)
    if (!entry || !map) return
    tools.beforeRemoveLayer(id)
    map.removeLayer(entry.layer)
    entry.layer.dispose()
    importedRuntimeLayers.value = importedRuntimeLayers.value.filter((item) => item.data.id !== id)
    store.importedLayers = store.importedLayers.filter((item) => item.id !== id)
    store.layerOrder = store.layerOrder.filter((layerId) => layerId !== id)
    if (featurePopup.value?.layerId === id) featurePopup.value = null
    applyLayerOrder()
    refreshLayerItems()
    tools.refreshTargets()
    showNotice(`图层“${entry.data.name}”已移除。`)
  }

  function zoomToLayer(id: string) {
    if (!map) return
    const layer = getManagedVectorLayer(id)
    if (!layer || layer.getFeatures().length === 0) {
      showNotice('这个图层还没有可缩放到的要素。')
      return
    }
    map.fit(layer.getSourceExtent(), {
      padding: [80, store.panelOpen ? 340 : 80, 80, 80],
      nearest: true,
      minResolution: 0,
      maxZoom: 16,
      duration: 650,
      easing: 'inAndOut',
    })
  }

  function makeImportedLayerName(format: ImportFormat) {
    const baseName = `导入-${format}`
    const usedNames = new Set(importedRuntimeLayers.value.map((entry) => entry.data.name))
    if (!usedNames.has(baseName)) return baseName
    let suffix = 2
    while (usedNames.has(`${baseName} ${suffix}`)) suffix += 1
    return `${baseName} ${suffix}`
  }

  function updateImportReport(index: number, report: ImportFileReport) {
    importReports.value = importReports.value.map((item, reportIndex) => reportIndex === index ? report : item)
  }

  async function importSources(sources: ImportSource[]) {
    if (!map || sources.length === 0 || importBusy.value) return
    importBusy.value = true
    importReports.value = sources.map((source, index) => ({
      id: createId(`import-report-${index}`),
      fileName: source.fileName,
      status: 'loading',
      featureCount: 0,
    }))
    let importedCount = 0
    let importedFeatureCount = 0
    const failures: string[] = []
    let lastImportedId = ''

    for (const [index, source] of sources.entries()) {
      const report = importReports.value[index]
      try {
        const format = source.format ?? getImportFormat(source.fileName)
        const content = await source.read()
        const converted = convertData({
          text: content,
          sourceFormat: format,
          targetFormat: 'GeoJSON',
          sourceProjection: source.sourceProjection,
          targetProjection: 'EPSG:4326',
          sourceCustomProjection: source.sourceCustomProjection,
        })
        const parsed = formatGeoJson().readFeatures(converted.output, {
          dataProjection: 'EPSG:4326',
          featureProjection: 'EPSG:3857',
        })
        if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('文件中没有可显示的地图要素。')
        const features = parsed as ReturnType<VectorLayer['getFeatures']>
        const id = createId('import')
        const name = makeImportedLayerName(format)
        const layer = new VectorLayer({ id, name, zIndex: 30 })
        layer.addFeatures(features)
        const geoJson = formatGeoJson().writeFeatures(features, {
          dataProjection: 'EPSG:4326',
          featureProjection: 'EPSG:3857',
        })
        const data: ImportedLayerData = { id, name, format, geoJson, visible: true, opacity: 1 }
        map.addLayer(layer)
        importedRuntimeLayers.value = [...importedRuntimeLayers.value, { data, layer }]
        store.importedLayers = [...store.importedLayers, data]
        store.layerOrder = [id, ...store.layerOrder.filter((layerId) => layerId !== id)]
        applyLayerOrder()
        refreshLayerItems()
        importedCount += 1
        importedFeatureCount += features.length
        lastImportedId = id
        updateImportReport(index, {
          ...report,
          format,
          status: 'success',
          featureCount: features.length,
          layerName: name,
        })
      } catch (error) {
        const detail = error instanceof Error ? error.message : '读取文件时发生错误。'
        failures.push(`${source.fileName}：${detail}`)
        updateImportReport(index, { ...report, status: 'error', error: detail })
      }
    }

    importBusy.value = false
    if (lastImportedId) {
      tools.state.targetId = lastImportedId
      tools.refreshTargets()
      if (store.activeTool === 'select' || store.activeTool === 'edit') tools.activate(store.activeTool)
      zoomToLayer(lastImportedId)
    }
    if (failures.length) {
      showNotice(`${importedCount ? `成功导入 ${importedCount} 个文件、${importedFeatureCount} 个要素；` : ''}${failures.slice(0, 2).join('；')}`)
    } else if (importedCount) {
      showNotice(`已导入 ${importedCount} 个文件、${importedFeatureCount} 个要素，并添加为独立图层。`)
    }
  }

  function importFiles(files: File[], sourceProjection: ImportProjection, sourceCustomProjection = '') {
    void importSources(files.map((file) => ({
      fileName: file.name,
      sourceProjection,
      sourceCustomProjection,
      read: () => file.text(),
    })))
  }

  function importConvertedResult(pending: PendingMapImport) {
    void importSources([{
      fileName: pending.fileName,
      format: pending.format,
      sourceProjection: pending.sourceProjection,
      sourceCustomProjection: pending.sourceCustomProjection,
      read: async () => pending.content,
    }])
  }

  function restoreSavedViews() {
    try {
      const raw = window.localStorage.getItem(SAVED_VIEWS_STORAGE_KEY)
      if (!raw) return
      const parsed: unknown = JSON.parse(raw)
      if (!Array.isArray(parsed)) return
      store.savedViews = parsed.filter((item): item is SavedMapView => Boolean(
        item
        && typeof item.id === 'string'
        && typeof item.name === 'string'
        && Array.isArray(item.center)
        && item.center.length === 2
        && item.center.every((coordinate: unknown) => typeof coordinate === 'number' && Number.isFinite(coordinate))
        && typeof item.zoom === 'number'
        && Number.isFinite(item.zoom),
      ))
    } catch {
      showNotice('视图收藏读取失败，将使用当前工作区内的收藏。')
    }
  }

  function persistSavedViews() {
    try {
      window.localStorage.setItem(SAVED_VIEWS_STORAGE_KEY, JSON.stringify(store.savedViews))
      return true
    } catch {
      showNotice('浏览器无法保存视图收藏。')
      return false
    }
  }

  function saveView(name: string) {
    if (!map) return
    const center = map.getCenter()
    if (!center) return
    const savedCenter = ProjUtil.toLonLat(center).toArray() as [number, number]
    const view: SavedMapView = {
      id: createId('view'),
      name: name.trim() || `视图 ${store.savedViews.length + 1}`,
      center: savedCenter,
      zoom: map.getZoom() ?? store.zoom,
    }
    store.savedViews = [view, ...store.savedViews]
    persistSavedViews()
    showNotice(`视图“${view.name}”已收藏。`)
  }

  function openSavedView(id: string) {
    const view = store.savedViews.find((savedView) => savedView.id === id)
    if (!map || !view) return
    map.animate({
      center: ProjUtil.fromLonLat(view.center).toArray(),
      zoom: view.zoom,
      duration: 700,
      easing: 'inAndOut',
    })
    showNotice(`已打开视图“${view.name}”。`)
  }

  function deleteSavedView(id: string) {
    store.savedViews = store.savedViews.filter((view) => view.id !== id)
    persistSavedViews()
  }

  function resetView() {
    if (!map) return
    map.animate({
      center: ProjUtil.fromLonLat(DEFAULT_CENTER).toArray(),
      zoom: DEFAULT_ZOOM,
      duration: 700,
      easing: 'inAndOut',
    })
    showNotice('已恢复杭州默认视图。')
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
    restoreSavedViews()
    try {
      map = new KitMap(element.value, {
        view: {
          center: ProjUtil.fromLonLat(store.center).toArray(),
          zoom: store.zoom,
        },
      })
      baseLayer = new GaodeLayer(store.baseStyle === 'img' ? GaodeLayerType.Img : GaodeLayerType.Vec, {
        id: 'gaode-base',
        name: store.baseStyle === 'img' ? '高德卫星影像' : '高德街道底图',
        preload: 0,
        useInterimTilesOnError: true,
        cacheSize: 512,
        source: { crossOrigin: 'anonymous' },
      })
      drawingsLayer = new VectorLayer({
        id: 'drawings',
        name: store.drawingsName,
        zIndex: 20,
      })
      annotationsLayer = new VectorLayer({
        id: 'annotations',
        name: store.annotationsName,
        zIndex: 10,
      })
      map.addLayer(baseLayer)
      map.addLayer(drawingsLayer)
      map.addLayer(annotationsLayer)
      baseLayer.setVisible(store.baseVisible)
      baseLayer.setOpacity(store.baseOpacity)
      drawingsLayer.setVisible(store.drawingsVisible)
      drawingsLayer.setOpacity(store.drawingsOpacity)
      annotationsLayer.setVisible(store.annotationsVisible)
      annotationsLayer.setOpacity(store.annotationsOpacity)
      restoreDrawings()
      refreshAnnotationFeatures()
      restoreImportedLayers()
      applyLayerOrder()
      refreshLayerItems()
      map.on('map:moveend', saveViewport)
      clickListener = map.on('map:singleclick', (event) => {
        if (!event.pixel || !map) return
        if (store.activeTool === 'select' || store.activeTool === 'edit') return
        if (annotationPickMode.value && store.activeTool === 'annotations') {
          if (!event.coordinate) {
            showNotice('无法读取所选位置，请在地图上再选一次。')
            return
          }
          const [longitude, latitude] = ProjUtil.toLonLat(event.coordinate).toArray()
          if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
            showNotice('无法读取所选位置的经纬度，请再选一次。')
            return
          }
          pickedAnnotationCoordinate.value = [longitude, latitude]
          annotationPickMode.value = false
          featurePopup.value = null
          showNotice(`已选取 ${longitude.toFixed(6)}, ${latitude.toFixed(6)}；确认样式后点击“添加到地图”。`)
          return
        }
        if (drawingEnabled.value) return
        for (const entry of orderedVectorLayers()) {
          const feature = map.getFeaturesAtPixel(event.pixel.toArray(), {
            layerFilter: (layer) => layer === entry.layer,
            hitTolerance: 8,
            checkWrapped: false,
          })[0]
          if (feature) {
            openFeaturePopup(feature, entry.id, entry.layer.getName())
            return
          }
        }
        featurePopup.value = null
      })
      if (store.activeTool === 'draw') startDrawing(store.drawingMode)
      if (store.activeTool === 'measure') startMeasuring(store.measuringMode)
      document.addEventListener('fullscreenchange', syncFullscreen)
      ready.value = true
      tools.refreshTargets()
      if (store.activeTool === 'select' || store.activeTool === 'edit') tools.activate(store.activeTool)
      const pendingImport = store.pendingMapImport
      if (pendingImport) {
        store.pendingMapImport = null
        store.activeTool = 'import'
        store.panelOpen = true
        importConvertedResult(pendingImport)
      }
    } catch (error) {
      showNotice(error instanceof Error ? error.message : '地图初始化失败。')
    }
  })

  onBeforeUnmount(() => {
    tools.dispose()
    window.clearTimeout(noticeTimeout)
    window.clearTimeout(drawEndTimeout)
    document.removeEventListener('fullscreenchange', syncFullscreen)
    if (clickListener && map) map.un(clickListener)
    saveViewport()
    saveDrawings()
    map?.dispose()
    for (const entry of importedRuntimeLayers.value) {
      if (!entry.layer.isDisposed()) entry.layer.dispose()
    }
    if (drawingsLayer && !drawingsLayer.isDisposed()) drawingsLayer.dispose()
    if (annotationsLayer && !annotationsLayer.isDisposed()) annotationsLayer.dispose()
    map = null
  })

  return {
    tools,
    store,
    ready,
    notice,
    drawingCount,
    drawingEnabled,
    drawingItems,
    selectedDrawingIds,
    featurePopup,
    measureResult,
    fullscreen,
    zoomLevel,
    layerItems,
    importBusy,
    importReports,
    annotationPickMode,
    pickedAnnotationCoordinate,
    selectTool,
    selectDrawingMode,
    selectMeasuringMode,
    finishCurrent,
    cancelCurrent,
    stopDrawingNow,
    startDrawingNow,
    deleteDrawing,
    deleteDrawings,
    saveAnnotation,
    deleteAnnotation,
    zoomToAnnotation,
    startAnnotationPick,
    cancelAnnotationPick,
    inspectDrawing,
    copyFeatureCoordinate,
    zoomToFeature,
    toggleDrawingSelection,
    selectAllDrawings,
    clearDrawings,
    clearMeasurement,
    exportDrawings,
    setLayerVisible,
    setLayerOpacity,
    renameLayer,
    moveLayer,
    zoomToLayer,
    removeLayer,
    importFiles,
    saveView,
    openSavedView,
    deleteSavedView,
    resetView,
    locate,
    screenshot,
    toggleFullscreen,
    setBasemap,
  }
}
