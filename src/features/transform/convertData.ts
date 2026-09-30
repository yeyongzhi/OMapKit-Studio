import { Format, FormatType } from 'openlayers-map-kit'
import type { Draw } from 'openlayers-map-kit'
import { transformGeoJsonCoordinates } from '@/features/coordinate/projection'
import type { CoordinateSystem } from '@/features/coordinate/projection'

export type DataFormat = 'GeoJSON' | 'WKT' | 'KML'
export type ProjectionCode = CoordinateSystem

export interface ConversionOptions {
  text: string
  sourceFormat: DataFormat
  targetFormat: DataFormat
  sourceProjection: ProjectionCode
  targetProjection: ProjectionCode
  sourceCustomProjection?: string
  targetCustomProjection?: string
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
        featureProjection: 'EPSG:4326',
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

function collectExtent(value: Record<string, unknown>): [number, number, number, number] | null {
  const extent: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity]
  let found = false

  function visitPositions(positions: unknown) {
    if (!Array.isArray(positions)) return
    if (positions.length >= 2 && typeof positions[0] === 'number' && typeof positions[1] === 'number') {
      const [x, y] = positions as [number, number]
      extent[0] = Math.min(extent[0], x)
      extent[1] = Math.min(extent[1], y)
      extent[2] = Math.max(extent[2], x)
      extent[3] = Math.max(extent[3], y)
      found = true
      return
    }
    positions.forEach(visitPositions)
  }

  function visitGeometry(geometry: unknown) {
    if (!geometry || typeof geometry !== 'object') return
    const candidate = geometry as Record<string, unknown>
    if (candidate.type === 'GeometryCollection' && Array.isArray(candidate.geometries)) {
      candidate.geometries.forEach(visitGeometry)
    } else if ('coordinates' in candidate) {
      visitPositions(candidate.coordinates)
    }
  }

  if (value.type === 'FeatureCollection' && Array.isArray(value.features)) {
    for (const feature of value.features) {
      if (feature && typeof feature === 'object') visitGeometry((feature as Record<string, unknown>).geometry)
    }
  } else if (value.type === 'Feature') {
    visitGeometry(value.geometry)
  } else {
    visitGeometry(value)
  }
  return found ? extent : null
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

  // 先将几何坐标按原数值读入，再统一使用 proj4 / coordtransform 转到目标坐标系。
  const sourceProjection = options.sourceFormat === 'KML' ? 'EPSG:4326' : options.sourceProjection
  const targetProjection = options.targetFormat === 'KML' ? 'EPSG:4326' : options.targetProjection
  const reader = createFormat(options.sourceFormat)
  const features = reader.readFeatures(text, {
    dataProjection: 'EPSG:4326',
    featureProjection: 'EPSG:4326',
  }) as KitFeature[]

  if (!Array.isArray(features) || features.length === 0) {
    throw new Error('没有读到可转换的几何要素，请检查格式和内容。')
  }

  const geoJsonWriter = createFormat('GeoJSON')
  const rawGeoJson = geoJsonWriter.writeFeatures(features, {
    dataProjection: 'EPSG:4326',
    featureProjection: 'EPSG:4326',
  })
  const transformedGeoJson = transformGeoJsonCoordinates(
    JSON.parse(rawGeoJson) as Record<string, unknown>,
    sourceProjection,
    targetProjection,
    options.sourceCustomProjection,
    options.targetCustomProjection,
  )
  if (options.targetFormat === 'GeoJSON' && targetProjection !== 'EPSG:4326') {
    transformedGeoJson.crs = {
      type: 'name',
      properties: { name: targetProjection === 'CUSTOM' ? options.targetCustomProjection ?? 'CUSTOM' : targetProjection },
    }
  }

  const transformedFeatures = geoJsonWriter.readFeatures(JSON.stringify(transformedGeoJson), {
    dataProjection: 'EPSG:4326',
    featureProjection: 'EPSG:4326',
  }) as KitFeature[]
  const output = options.targetFormat === 'GeoJSON'
    ? JSON.stringify(transformedGeoJson, null, 2)
    : createFormat(options.targetFormat).writeFeatures(transformedFeatures, {
        dataProjection: 'EPSG:4326',
        featureProjection: 'EPSG:4326',
      })
  if (!output) throw new Error('转换没有生成结果。')

  return {
    output,
    featureCount: features.length,
    geometryTypes: [...new Set(features.map((feature) => feature.getType()))],
    extent: collectExtent(transformedGeoJson),
  }
}
