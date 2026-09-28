import { Format, FormatType, ProjUtil } from 'openlayers-map-kit'
import type { Draw } from 'openlayers-map-kit'

export type DataFormat = 'GeoJSON' | 'WKT' | 'KML'
export type ProjectionCode = 'EPSG:4326' | 'EPSG:3857'

export interface ConversionOptions {
  text: string
  sourceFormat: DataFormat
  targetFormat: DataFormat
  sourceProjection: ProjectionCode
  targetProjection: ProjectionCode
}

export interface ConversionResult {
  output: string
  featureCount: number
  geometryTypes: string[]
  extent: [number, number, number, number] | null
}

type KitFeature = ReturnType<Draw['getFeatures']>[number]

export function createFormat(type: DataFormat): Format {
  switch (type) {
    case 'GeoJSON':
      return new Format(FormatType.GeoJSON, {
        dataProjection: 'EPSG:4326',
        extractGeometryName: false,
      })
    case 'WKT':
      return new Format(FormatType.WKT, { splitCollection: true })
    case 'KML':
      return new Format(FormatType.KML, {
        extractStyles: false,
        showPointNames: false,
        writeStyles: false,
        crossOrigin: 'anonymous',
      })
  }
}

export function convertData(options: ConversionOptions): ConversionResult {
  const text = options.text.trim()
  if (!text) throw new Error('请先粘贴数据或选择文件。')
  if (options.sourceFormat === 'GeoJSON') {
    try {
      JSON.parse(text)
    } catch {
      throw new Error('GeoJSON 不是有效的 JSON。')
    }
  }

  // KML 的坐标按格式规范固定为经纬度，其余格式使用用户选择的坐标系。
  const sourceProjection = options.sourceFormat === 'KML' ? 'EPSG:4326' : options.sourceProjection
  const targetProjection = options.targetFormat === 'KML' ? 'EPSG:4326' : options.targetProjection
  const readOptions = { dataProjection: sourceProjection, featureProjection: 'EPSG:3857' }
  const writeOptions = { dataProjection: targetProjection, featureProjection: 'EPSG:3857' }
  const reader = createFormat(options.sourceFormat)
  const features = reader.readFeatures(text, readOptions) as KitFeature[]

  if (!Array.isArray(features) || features.length === 0) {
    throw new Error('没有读到可转换的几何要素，请检查格式和内容。')
  }

  const writer = createFormat(options.targetFormat)
  const output = writer.writeFeatures(features, writeOptions)
  if (!output) throw new Error('转换没有生成结果。')

  const projectedExtent: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity]
  for (const feature of features) {
    const extent = feature.getExtent().toArray()
    projectedExtent[0] = Math.min(projectedExtent[0], extent[0])
    projectedExtent[1] = Math.min(projectedExtent[1], extent[1])
    projectedExtent[2] = Math.max(projectedExtent[2], extent[2])
    projectedExtent[3] = Math.max(projectedExtent[3], extent[3])
  }
  let extent: ConversionResult['extent'] = null
  if (projectedExtent.every(Number.isFinite)) {
    if (targetProjection === 'EPSG:4326') {
      const lower = ProjUtil.toLonLat([projectedExtent[0], projectedExtent[1]]).toArray()
      const upper = ProjUtil.toLonLat([projectedExtent[2], projectedExtent[3]]).toArray()
      extent = [lower[0], lower[1], upper[0], upper[1]]
    } else {
      extent = projectedExtent
    }
  }

  return {
    output: options.targetFormat === 'GeoJSON' ? JSON.stringify(JSON.parse(output), null, 2) : output,
    featureCount: features.length,
    geometryTypes: [...new Set(features.map((feature) => feature.getType()))],
    extent,
  }
}
