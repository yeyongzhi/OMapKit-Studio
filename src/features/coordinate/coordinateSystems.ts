export type CoordinateSystemCategory = 'geographic' | 'projected'

export function getCoordinateSystemLabel(value: string, customDefinition = '') {
  if (value === 'EPSG:4326') return 'WGS 84 · 经纬度'
  if (value === 'EPSG:4490') return 'CGCS2000 · 经纬度'
  if (value === 'GCJ-02') return 'GCJ-02 · 火星坐标'
  if (value === 'BD-09') return 'BD-09 · 百度坐标'
  if (value === 'EPSG:3857') return 'Web Mercator'
  const gaussKruger = value.match(/^CGCS2000_GK_([36])_(\d{2,3})$/)
  if (gaussKruger) return `CGCS2000 · 高斯-克吕格 ${gaussKruger[1]}°带 · ${gaussKruger[2]}°E`
  const utm = value.match(/^EPSG:(32[67])(\d{2})$/)
  if (utm) return `WGS 84 · UTM ${Number(utm[2])}${utm[1] === '326' ? 'N' : 'S'}`
  if (value === 'CUSTOM') return customDefinition.trim() || '自定义投影'
  return value || '选择坐标系'
}

export function getCoordinateSystemCode(value: string, customDefinition = '') {
  if (value === 'CUSTOM') return customDefinition.trim() || '自定义 EPSG / PROJ'
  const gaussKruger = value.match(/^CGCS2000_GK_([36])_(\d{2,3})$/)
  if (gaussKruger) return `中央经线 ${gaussKruger[2]}°E`
  return value
}
