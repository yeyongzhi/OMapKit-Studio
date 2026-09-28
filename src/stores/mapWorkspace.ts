import { defineStore } from 'pinia'
import { shallowRef } from 'vue'

export type MapTool = 'layers' | 'draw' | 'measure'
export type DrawingMode = 'Point' | 'LineString' | 'Polygon'
export type MeasuringMode = 'Distance' | 'Area'

export const useMapWorkspaceStore = defineStore('map-workspace', () => {
  const center = shallowRef<[number, number]>([120.1551, 30.2741])
  const zoom = shallowRef(11)
  const activeTool = shallowRef<MapTool>('layers')
  const drawingMode = shallowRef<DrawingMode>('Point')
  const measuringMode = shallowRef<MeasuringMode>('Distance')
  const panelOpen = shallowRef(true)
  const baseVisible = shallowRef(true)
  const drawingsVisible = shallowRef(true)
  const drawingsGeoJson = shallowRef('')

  return {
    center,
    zoom,
    activeTool,
    drawingMode,
    measuringMode,
    panelOpen,
    baseVisible,
    drawingsVisible,
    drawingsGeoJson,
  }
})
