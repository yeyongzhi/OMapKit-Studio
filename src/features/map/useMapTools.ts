import { reactive } from 'vue'
import { Format, FormatType, HeatmapLayer, LayerGroup, Modify, Select, VectorLayer, VectorSource, WMSLayer, WMTSLayer } from 'openlayers-map-kit'
import type { Map as KitMap } from 'openlayers-map-kit'
import { unByKey } from 'ol/Observable'
import type { EventsKey } from 'ol/events'

type Feature = ReturnType<VectorLayer['getFeatures']>[number]
type Layer = Parameters<KitMap['addLayer']>[0]
export type ServiceConfig = { type: 'WMS' | 'WMTS'; url: string; layer: string; version: string; projection: string; format: string; matrixSet: string; style: string; grid: string }
type Context = { map: () => KitMap | null; vectors: () => VectorLayer[]; sync: (layer: VectorLayer) => void; notice: (message: string) => void; preferences: (layer: VectorLayer, visible: boolean, opacity: number) => void }
const formatter = () => new Format(FormatType.GeoJSON, { dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857', extractGeometryName: false })
const projectionOptions = { dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857' }
const readFeatures = (data: unknown) => formatter().readFeatures(JSON.stringify(data), projectionOptions) as Feature[]
const writeFeature = (feature: Feature) => formatter().writeFeature(feature, projectionOptions)
const writeFeatures = (features: Feature[]) => formatter().writeFeatures(features, projectionOptions)
const id = () => `map-${crypto.randomUUID()}`
export type FeatureRow = { key: string; id: string; type: string; name: string; json: string; properties: Record<string, unknown> }
export function useMapTools(context: Context) {
  const state = reactive({
    targetId: '', targets: [] as { id: string; name: string; count: number; points: number }[],
    selected: [] as { key: string; id: string; type: string; json: string }[],
    rows: [] as FeatureRow[], query: '', geometryFilter: 'all',
    editing: false, history: 0, error: '',
    heatTargetId: '', weightField: '__uniform', weightFields: [] as string[], heatCreated: false,
    radius: 22, blur: 18, heatOpacity: .8, heatVisible: true, heatPoints: 0, heatName: '',
    groupVisible: true, groupOpacity: 1, groupName: '', groupIds: [] as string[],
    children: [] as { id: string; name: string; visible: boolean; opacity: number }[],
    services: [] as { id: string; name: string; visible: boolean; opacity: number; loaded: number; errors: number; status: string }[],
  })
  let selection: Select | null = null
  let modify: Modify | null = null
  let editingLayer: VectorLayer | null = null
  let editSnapshots: string[] = []
  let group: LayerGroup | null = null
  let applyingGroup = false
  let heatmap: HeatmapLayer | null = null
  let heatSource: VectorSource | null = null
  const services = new Map<string, { layer: Layer; keys: EventsKey[] }>()
  const vectors = () => context.vectors()
  const target = () => vectors().find(layer => String(layer.getId()) === state.targetId)
  function refreshRows() {
    state.rows = (target()?.getFeatures() ?? []).map((feature, index) => {
      const json = writeFeature(feature), data = JSON.parse(json)
      return { key: String(index), id: String(feature.getId() ?? index + 1), type: feature.getType(), name: String(data.properties?.name ?? data.properties?.label ?? feature.getId() ?? `要素 ${index + 1}`), json, properties: data.properties ?? {} }
    })
  }
  function refreshTargets() {
    state.targets = vectors().map(layer => ({ id: String(layer.getId()), name: layer.getName(), count: layer.getFeatures().length, points: layer.getFeatures().filter(feature => ['Point', 'MultiPoint'].includes(feature.getType())).length }))
    if (!state.targets.some(layer => layer.id === state.targetId)) state.targetId = state.targets.find(layer => layer.count > 0)?.id ?? state.targets[0]?.id ?? ''
    if (!state.targets.some(layer => layer.id === state.heatTargetId)) state.heatTargetId = state.targets.find(layer => layer.points > 0)?.id ?? ''
    refreshRows(); refreshWeightFields()
  }
  function syncEdited() {
    if (editingLayer) context.sync(editingLayer)
    state.history = Math.max(0, editSnapshots.length - 1)
    refreshTargets()
  }
  function stop() {
    const map = context.map()
    if (modify) { syncEdited(); map?.removeInteraction(modify); modify.dispose(); modify = null }
    if (selection) { selection.clearSelection(); map?.removeInteraction(selection); selection.dispose(); selection = null }
    editingLayer = null
    editSnapshots = []
    state.editing = false
    state.history = 0
    state.selected = []
  }
  function updateSelection() {
    const features = target()?.getFeatures() ?? []
    state.selected = (selection?.getSelection() ?? []).map((feature, index) => ({
      key: String(features.indexOf(feature)), id: String(feature.getId() ?? index + 1), type: feature.getType(), json: writeFeature(feature),
    }))
  }
  function activate(mode: 'select' | 'edit') {
    stop(); refreshTargets(); state.error = ''
    const map = context.map(), layer = target()
    if (!map || !layer) return
    try {
      if (!layer.getVisible()) throw new Error('目标图层已隐藏，请先显示图层。')
      if (mode === 'select') {
        selection = new Select({ layers: [layer], hitTolerance: 8, filter: (_feature, candidate) => candidate.getVisible() && candidate.getOpacity() > 0 })
        selection.on('select', updateSelection)
        map.addInteraction(selection)
      } else {
        if (!layer.getFeatures().length) throw new Error('图层没有要素，请先绘制或导入数据。')
        for (const feature of layer.getFeatures()) if (feature.getId() === null) feature.setId(id())
        editingLayer = layer
        editSnapshots = [writeFeatures(layer.getFeatures())]
        modify = new Modify({ layer })
        modify.on('modifyend', () => {
          if (editingLayer) editSnapshots.push(writeFeatures(editingLayer.getFeatures()))
          syncEdited()
        })
        map.addInteraction(modify)
        state.editing = true
      }
    } catch (error) { stop(); fail(error) }
  }
  function fail(error: unknown) { state.error = error instanceof Error ? error.message : String(error); context.notice(state.error) }
  function clearSelection() { selection?.clearSelection(); updateSelection() }
  function selectAll() { const layer = target(); if (layer?.getVisible() && layer.getOpacity() > 0) selection?.select(layer.getFeatures()); updateSelection() }
  function inspectSelected(key: string) {
    const item = state.selected.find(item => item.key === key)
    const feature = selection?.getSelection().find(feature => writeFeature(feature) === item?.json)
    if (feature) context.map()?.fit(feature, { padding: [80, 380, 80, 80], maxZoom: 16, duration: 300, nearest: true, minResolution: 0, easing: 'inAndOut' })
  }
  function restoreEditSnapshot(snapshot: string) {
    const features = readFeatures(JSON.parse(snapshot))
    for (const feature of editingLayer?.getFeatures() ?? []) {
      const saved = features.find(saved => saved.getId() === feature.getId())
      const coordinates = saved?.getCoordinates()
      if (coordinates !== undefined) feature.setCoordinates(coordinates)
    }
  }
  function undo() {
    try {
      if (!modify || editSnapshots.length <= 1) return
      modify.revoke(); editSnapshots.pop(); restoreEditSnapshot(editSnapshots.at(-1)!); syncEdited()
    } catch (error) { fail(error) }
  }
  function resetEdit() {
    try {
      if (!modify || !editSnapshots[0]) return
      modify.cancel(); restoreEditSnapshot(editSnapshots[0]); editSnapshots = [editSnapshots[0]]; syncEdited()
    } catch (error) { fail(error) }
  }
  function exportTarget() { const layer = target(); if (layer) download(`${layer.getName()}.geojson`, writeFeatures(layer.getFeatures())) }

  function filteredRows() {
    const query = state.query.trim().toLocaleLowerCase()
    return state.rows.filter(row => (state.geometryFilter === 'all' || row.type === state.geometryFilter) && (!query || `${row.name} ${row.id} ${JSON.stringify(row.properties)}`.toLocaleLowerCase().includes(query)))
  }
  function toggleRow(key: string) {
    const feature = target()?.getFeatures()[Number(key)]
    if (!feature || !selection || !target()?.getVisible() || target()!.getOpacity() === 0) return
    if (selection.getSelection().includes(feature)) selection.deselect(feature); else selection.select(feature)
    updateSelection()
  }
  function locateRow(key: string) {
    const feature = target()?.getFeatures()[Number(key)]
    if (feature) context.map()?.fit(feature, { padding: [80, 400, 80, 80], maxZoom: 16, duration: 300, nearest: true, minResolution: 0, easing: 'inAndOut' })
  }
  function selectFiltered() {
    if (!selection || !target()?.getVisible() || target()!.getOpacity() === 0) return
    selection.select(filteredRows().map(row => target()!.getFeatures()[Number(row.key)]!).filter(Boolean)); updateSelection()
  }
  function exportSelected() {
    const features = selection?.getSelection() ?? []
    if (features.length) download(`${target()?.getName() ?? '地图'}-选中要素.geojson`, writeFeatures(features))
  }
  function exportFiltered() {
    const features = filteredRows().map(row => target()!.getFeatures()[Number(row.key)]!).filter(Boolean)
    if (features.length) download(`${target()?.getName() ?? '地图'}-筛选结果.geojson`, writeFeatures(features))
  }
  function refreshWeightFields() {
    const layer = vectors().find(layer => String(layer.getId()) === state.heatTargetId)
    const fields = new Set<string>()
    for (const feature of layer?.getFeatures() ?? []) for (const [name, value] of Object.entries(feature.getProperties())) if (typeof value === 'number' && Number.isFinite(value)) fields.add(name)
    state.weightFields = [...fields]
    if (state.weightField !== '__uniform' && !fields.has(state.weightField)) state.weightField = '__uniform'
  }
  function generateHeat() {
    const map = context.map(), layer = vectors().find(layer => String(layer.getId()) === state.heatTargetId)
    if (!map || !layer) return
    state.error = ''
    try {
      const data = JSON.parse(writeFeatures(layer.getFeatures())) as { features: { properties: Record<string, unknown>; geometry: { type: string; coordinates: unknown } }[] }
      const entries = data.features.filter(feature => ['Point', 'MultiPoint'].includes(feature.geometry?.type))
      if (!entries.length) throw new Error('这个图层没有点要素，请先导入或绘制点数据。')
      const maxWeight = entries.reduce((max, feature) => Math.max(max, Number(feature.properties?.[state.weightField]) || 0), 0)
      const flattened = entries.flatMap(feature => {
        const coordinates = feature.geometry.type === 'Point' ? [feature.geometry.coordinates] : feature.geometry.coordinates as unknown[]
        const value = state.weightField === '__uniform' ? 1 : Math.max(0, Number(feature.properties?.[state.weightField]) || 0) / (maxWeight || 1)
        return coordinates.map(coordinate => ({ type: 'Feature', geometry: { type: 'Point', coordinates: coordinate }, properties: { weight: value } }))
      })
      if (state.weightField !== '__uniform' && maxWeight <= 0) throw new Error('所选权重字段没有大于零的数值，请换一个字段或使用等权重。')
      removeHeat()
      heatSource = new VectorSource(); heatSource.addFeatures(readFeatures({ type: 'FeatureCollection', features: flattened }))
      heatmap = new HeatmapLayer({ id: id(), name: `${layer.getName()} · 热力图`, source: heatSource, radius: state.radius, blur: state.blur, weight: 'weight', opacity: state.heatOpacity, visible: state.heatVisible, zIndex: 90 })
      map.addLayer(heatmap)
      state.heatCreated = true; state.heatPoints = flattened.length; state.heatName = layer.getName()
      map.fit(layer.getSourceExtent(), { padding: [80, 400, 80, 80], maxZoom: 15, duration: 300, nearest: true, minResolution: 0, easing: 'inAndOut' })
      context.notice('热力图已生成。数据修改后可点击更新热力图。')
    } catch (error) { fail(error) }
  }
  function updateHeat() {
    const native = heatmap?.getLayer() as unknown as { setRadius(value: number): void; setBlur(value: number): void } | undefined
    native?.setRadius(state.radius); native?.setBlur(state.blur)
    heatmap?.setVisible(state.heatVisible); heatmap?.setOpacity(state.heatOpacity)
  }
  function removeHeat() {
    const native = heatmap?.getLayer()
    if (native?.hasRenderer()) native.getRenderer()?.dispose()
    if (heatmap) { context.map()?.removeLayer(heatmap); heatmap.dispose() }
    heatSource?.dispose(); heatSource = null; heatmap = null
    state.heatCreated = false; state.heatPoints = 0
  }
  function createGroup(name: string, layerIds: string[]) {
    const map = context.map(), layers = vectors().filter(layer => layerIds.includes(String(layer.getId())))
    if (!map) return
    if (!name.trim() || layers.length < 2) { fail('请填写分组名称，并选择至少两个图层。'); return }
    ungroup()
    group = new LayerGroup(id(), layers); map.addLayerGroup(group)
    state.groupName = name.trim(); state.groupVisible = true; state.groupOpacity = 1
    state.children = layers.map(layer => ({ id: String(layer.getId()), name: layer.getName(), visible: layer.getVisible(), opacity: layer.getOpacity() }))
    applyGroup()
  }
  function applyGroup() {
    applyingGroup = true
    for (const layer of group?.getAll() ?? []) {
      const child = state.children.find(child => child.id === String(layer.getId()))
      if (child) context.preferences(layer as VectorLayer, state.groupVisible && child.visible, state.groupOpacity * child.opacity)
    }
    applyingGroup = false
    if (target() && (!target()!.getVisible() || target()!.getOpacity() === 0)) stop()
  }
  function changeGroupChild(layerId: string, preference: { visible?: boolean; opacity?: number }) {
    if (applyingGroup) return false
    const child = state.children.find(child => child.id === layerId)
    if (!child) return false
    Object.assign(child, preference); applyGroup(); return true
  }
  function ungroup() {
    if (!group) return
    const layers = [...group.getAll()] as VectorLayer[], map = context.map()
    applyingGroup = true
    for (const layer of layers) {
      const child = state.children.find(child => child.id === String(layer.getId()))
      if (child) context.preferences(layer, child.visible, child.opacity)
    }
    applyingGroup = false
    if (map) { map.removeLayerGroup(group); map.addLayers(layers) }
    group.clear(); group = null; state.children = []; state.groupName = ''
  }
  function beforeRemoveLayer(layerId: string) {
    stop()
    if (state.children.some(child => child.id === layerId)) ungroup()
    if (state.heatTargetId === layerId) removeHeat()
  }
  function addService(config: ServiceConfig) {
    const map = context.map()
    if (!map) return
    state.error = ''
    let layer: WMSLayer | WMTSLayer | undefined
    try {
      const url = new URL(config.url)
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('服务地址必须是 HTTP 或 HTTPS。')
      if (!config.layer.trim()) throw new Error('请填写图层名称。')
      if (!['EPSG:3857', 'EPSG:4326'].includes(config.projection)) throw new Error('当前接入支持 EPSG:3857 或 EPSG:4326。')
      const common = { id: id(), name: `${config.type} · ${config.layer}`, preload: 0, cacheSize: 256, zIndex: 5 }
      if (config.type === 'WMS') {
        layer = new WMSLayer({ ...common, source: {
          url: url.href, params: { LAYERS: config.layer, VERSION: config.version, FORMAT: config.format, TRANSPARENT: true },
          projection: config.projection, crossOrigin: 'anonymous', attributionsCollapsible: true, interpolate: true,
          gutter: 0, hidpi: false, reprojectionErrorThreshold: .5, wrapX: false, transition: 0, zDirection: 0,
        } })
      } else {
        const grid = JSON.parse(config.grid) as { origin?: number[]; resolutions?: number[]; matrixIds?: string[]; tileSize?: number; sizes?: [number, number][] }
        if (!config.matrixSet.trim() || !grid.origin || grid.origin.length !== 2 || !grid.origin.every(Number.isFinite)
          || !grid.resolutions?.length || !grid.resolutions.every(value => Number.isFinite(value) && value > 0)
          || !grid.matrixIds?.every(value => typeof value === 'string') || grid.matrixIds.length !== grid.resolutions.length
          || !Number.isInteger(grid.tileSize ?? 256) || (grid.tileSize ?? 256) <= 0
          || (grid.sizes && (grid.sizes.length !== grid.resolutions.length || !grid.sizes.every(size => Array.isArray(size) && size.length === 2 && size.every(value => Number.isInteger(value) && value > 0))))) throw new Error('瓦片网格需包含 origin、正数 resolutions 和等长 matrixIds；tileSize 为正整数，sizes 为各层矩阵宽高。')
        layer = new WMTSLayer({ ...common, source: {
          url: url.href, layer: config.layer, version: config.version, format: config.format, matrixSet: config.matrixSet, style: config.style || 'default',
          projection: config.projection, crossOrigin: 'anonymous', requestEncoding: 'KVP',
          tileGrid: { origin: grid.origin as [number, number], resolutions: grid.resolutions, matrixIds: grid.matrixIds, sizes: grid.sizes ?? grid.resolutions.map(resolution => {
            const width = config.projection === 'EPSG:3857' ? 40075016.68557849 : 360
            const height = config.projection === 'EPSG:3857' ? width : 180
            return [Math.ceil(width / resolution / (grid.tileSize ?? 256)), Math.ceil(height / resolution / (grid.tileSize ?? 256))]
          }), tileSize: grid.tileSize ?? 256 },
          attributionsCollapsible: true, interpolate: true, reprojectionErrorThreshold: .5, tilePixelRatio: 1, wrapX: false, transition: 0, zDirection: 0,
        } })
      }
      const serviceId = String(layer.getId())
      state.services.push({ id: serviceId, name: layer.getName(), visible: true, opacity: 1, loaded: 0, errors: 0, status: '正在连接服务…' })
      const keys: EventsKey[] = []
      const source = layer instanceof WMSLayer ? layer.getWMSSource() : layer.getWMTSSource()
      const update = (failed: boolean) => {
        const item = state.services.find(item => item.id === serviceId)
        if (!item) return
        if (failed) item.errors++; else item.loaded++
        item.status = item.errors ? '部分地图内容加载失败，请检查服务配置或网络。' : '服务已连接'
      }
      if (source) { keys.push(source.onTileLoadEnd(() => update(false))); keys.push(source.onTileLoadError(() => update(true))) }
      services.set(serviceId, { layer, keys }); map.addLayer(layer)
    } catch (error) {
      if (layer) { const serviceId = String(layer.getId()); removeService(serviceId); if (!layer.isDisposed()) layer.dispose() }
      fail(error)
    }
  }
  function updateService(serviceId: string) {
    const item = state.services.find(item => item.id === serviceId), layer = services.get(serviceId)?.layer
    if (item && layer) { layer.setVisible(item.visible); layer.setOpacity(item.opacity) }
  }
  function removeService(serviceId: string) {
    const entry = services.get(serviceId)
    if (entry) { unByKey(entry.keys); context.map()?.removeLayer(entry.layer); entry.layer.dispose(); services.delete(serviceId) }
    state.services = state.services.filter(item => item.id !== serviceId)
  }

  function download(name: string, content: string) {
    const url = URL.createObjectURL(new Blob([content], { type: 'application/geo+json;charset=utf-8' })), link = document.createElement('a')
    link.href = url; link.download = name; document.body.append(link); link.click(); link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  function dispose() { stop(); ungroup(); removeHeat(); for (const serviceId of services.keys()) removeService(serviceId) }
  return { state, refreshTargets, refreshRows, activate, stop, clearSelection, selectAll, inspectSelected, undo, resetEdit, exportTarget, filteredRows, toggleRow, locateRow, selectFiltered, exportSelected, exportFiltered, refreshWeightFields, generateHeat, updateHeat, removeHeat, createGroup, applyGroup, changeGroupChild, ungroup, beforeRemoveLayer, addService, updateService, removeService, dispose }
}
export type MapTools = ReturnType<typeof useMapTools>
