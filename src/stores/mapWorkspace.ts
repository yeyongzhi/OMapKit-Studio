import { defineStore } from 'pinia'
import { shallowRef } from 'vue'

export type MapTool = 'layers' | 'import' | 'draw' | 'measure' | 'annotations'
export type DrawingMode = 'Point' | 'LineString' | 'Polygon'
export type MeasuringMode = 'Distance' | 'Area'
export type ImportFormat = 'GeoJSON' | 'KML' | 'WKT'
export type ImportProjection = string
export type AnnotationShape = 'circle' | 'square' | 'triangle'

export type MapAnnotation = {
  id: string
  longitude: number
  latitude: number
  label: string
  color: string
  size: number
  shape: AnnotationShape
}

export type MapAnnotationDraft = Omit<MapAnnotation, 'id'> & { id?: string }

export type PendingMapImport = {
  fileName: string
  format: ImportFormat
  sourceProjection: ImportProjection
  sourceCustomProjection?: string
  content: string
}

export type ImportedLayerData = {
  id: string
  name: string
  format: ImportFormat
  geoJson: string
  visible: boolean
  opacity: number
}

export type SavedMapView = {
  id: string
  name: string
  center: [number, number]
  zoom: number
}

export const useMapWorkspaceStore = defineStore('map-workspace', () => {
  const center = shallowRef<[number, number]>([120.1551, 30.2741])
  const zoom = shallowRef(11)
  const activeTool = shallowRef<MapTool>('layers')
  const drawingMode = shallowRef<DrawingMode>('Point')
  const measuringMode = shallowRef<MeasuringMode>('Distance')
  const panelOpen = shallowRef(true)
  const baseVisible = shallowRef(true)
  const drawingsVisible = shallowRef(true)
  const baseOpacity = shallowRef(1)
  const drawingsOpacity = shallowRef(1)
  const drawingsName = shallowRef('绘制结果')
  const drawingsGeoJson = shallowRef('')
  const annotations = shallowRef<MapAnnotation[]>([])
  const annotationsVisible = shallowRef(true)
  const annotationsOpacity = shallowRef(1)
  const annotationsName = shallowRef('标注')
  const importedLayers = shallowRef<ImportedLayerData[]>([])
  const layerOrder = shallowRef<string[]>(['drawings', 'annotations'])
  const savedViews = shallowRef<SavedMapView[]>([])
  const pendingMapImport = shallowRef<PendingMapImport | null>(null)

  return {
    center,
    zoom,
    activeTool,
    drawingMode,
    measuringMode,
    panelOpen,
    baseVisible,
    drawingsVisible,
    baseOpacity,
    drawingsOpacity,
    drawingsName,
    drawingsGeoJson,
    annotations,
    annotationsVisible,
    annotationsOpacity,
    annotationsName,
    importedLayers,
    layerOrder,
    savedViews,
    pendingMapImport,
  }
})
