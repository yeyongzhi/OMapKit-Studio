import proj4 from 'proj4'
import coordtransform from 'coordtransform'

const { bd09togcj02, gcj02tobd09, gcj02towgs84, wgs84togcj02 } = coordtransform

export type CoordinateSystem = string

const wgs84 = '+proj=longlat +datum=WGS84 +no_defs +type=crs'
const projectionDefinitions: Record<string, string> = {
  'EPSG:4326': wgs84,
  'EPSG:3857': '+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +no_defs +type=crs',
  'EPSG:4490': '+proj=longlat +ellps=GRS80 +no_defs +type=crs',
  'EPSG:4269': '+proj=longlat +datum=NAD83 +no_defs +type=crs',
  'EPSG:4258': '+proj=longlat +ellps=GRS80 +no_defs +type=crs',
  'EPSG:4267': '+proj=longlat +datum=NAD27 +no_defs +type=crs',
  'EPSG:3413': '+proj=stere +lat_0=90 +lat_ts=70 +lon_0=-45 +datum=WGS84 +units=m +no_defs +type=crs',
  'EPSG:3031': '+proj=stere +lat_0=-90 +lat_ts=-71 +lon_0=0 +datum=WGS84 +units=m +no_defs +type=crs',
  'EPSG:3395': '+proj=merc +lon_0=0 +k=1 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs +type=crs',
  'EPSG:27700': '+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +towgs84=446.448,-125.157,542.06,0.15,0.247,0.842,-20.489 +units=m +no_defs +type=crs',
  'EPSG:2154': '+proj=lcc +lat_0=46.5 +lon_0=3 +lat_1=49 +lat_2=44 +x_0=700000 +y_0=6600000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs',
}

for (const [code, definition] of Object.entries(projectionDefinitions)) {
  proj4.defs(code, definition)
}

function epsgDefinition(code: number): string | undefined {
  if (code === 900913 || code === 102100 || code === 102113) return projectionDefinitions['EPSG:3857']
  if (code >= 32601 && code <= 32660) {
    return `+proj=utm +zone=${code - 32600} +datum=WGS84 +units=m +no_defs +type=crs`
  }
  if (code >= 32701 && code <= 32760) {
    return `+proj=utm +zone=${code - 32700} +south +datum=WGS84 +units=m +no_defs +type=crs`
  }
  if (code >= 26901 && code <= 26923) {
    return `+proj=utm +zone=${code - 26900} +datum=NAD83 +units=m +no_defs +type=crs`
  }
  if (code >= 25828 && code <= 25838) {
    return `+proj=utm +zone=${code - 25800} +ellps=GRS80 +units=m +no_defs +type=crs`
  }
  if (code >= 23028 && code <= 23038) {
    return `+proj=utm +zone=${code - 23000} +ellps=intl +towgs84=-87,-98,-121,0,0,0,0 +units=m +no_defs +type=crs`
  }
  return undefined
}

export function resolveProjection(value: CoordinateSystem, customDefinition = ''): string {
  const normalized = value.trim().toUpperCase()
  if (normalized === 'GCJ-02' || normalized === 'BD-09') return normalized
  const custom = customDefinition.trim()
  const definitionInput = normalized === 'CUSTOM' ? custom : normalized
  if (definitionInput.startsWith('+')) return definitionInput

  const epsgMatch = definitionInput.match(/^(?:EPSG\s*:\s*)?(\d+)$/i)
  if (!epsgMatch) throw new Error('请填写有效的 EPSG 编号或以 +proj= 开头的 PROJ 字符串。')
  const code = Number(epsgMatch[1])
  const key = `EPSG:${code}`
  const definition = projectionDefinitions[key] ?? epsgDefinition(code)
  if (!definition) {
    throw new Error(`暂未内置 EPSG:${code} 定义。请在自定义坐标系中粘贴该坐标系的 PROJ 字符串。`)
  }
  proj4.defs(key, definition)
  return key
}

function intoWgs84(position: [number, number], source: string): [number, number] {
  if (source === 'GCJ-02') return gcj02towgs84(position[0], position[1])
  if (source === 'BD-09') {
    const [lng, lat] = bd09togcj02(position[0], position[1])
    return gcj02towgs84(lng, lat)
  }
  const result = proj4(source, 'EPSG:4326', position)
  return [result[0], result[1]]
}

function outOfWgs84(position: [number, number], target: string): [number, number] {
  if (target === 'GCJ-02') return wgs84togcj02(position[0], position[1])
  if (target === 'BD-09') {
    const [lng, lat] = wgs84togcj02(position[0], position[1])
    return gcj02tobd09(lng, lat)
  }
  const result = proj4('EPSG:4326', target, position)
  return [result[0], result[1]]
}

export function transformCoordinate(
  x: number,
  y: number,
  source: CoordinateSystem,
  target: CoordinateSystem,
  sourceCustom = '',
  targetCustom = '',
): [number, number] {
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('坐标值必须是有效数字。')
  const sourceProjection = resolveProjection(source, sourceCustom)
  const targetProjection = resolveProjection(target, targetCustom)
  const wgsCoordinate = intoWgs84([x, y], sourceProjection)
  return outOfWgs84(wgsCoordinate, targetProjection)
}
