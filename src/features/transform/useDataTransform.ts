import { computed, shallowRef, watch } from 'vue'
import { convertData } from './convertData'
import type { ConversionResult, DataFormat, ProjectionCode } from './convertData'

const SAMPLE_GEOJSON = JSON.stringify({
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    properties: { name: '杭州 · 西湖' },
    geometry: { type: 'Point', coordinates: [120.1495, 30.2463] },
  }],
}, null, 2)

export function useDataTransform() {
  const sourceText = shallowRef('')
  const sourceFormat = shallowRef<DataFormat>('GeoJSON')
  const targetFormat = shallowRef<DataFormat>('WKT')
  const sourceProjection = shallowRef<ProjectionCode>('EPSG:4326')
  const targetProjection = shallowRef<ProjectionCode>('EPSG:4326')
  const sourceCustomProjection = shallowRef('')
  const targetCustomProjection = shallowRef('')
  const fileName = shallowRef('')
  const result = shallowRef<ConversionResult | null>(null)
  const error = shallowRef('')
  const message = shallowRef('')

  const sourceSize = computed(() => {
    const bytes = new Blob([sourceText.value]).size
    return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`
  })
  const canConvert = computed(() => sourceText.value.trim().length > 0)
  const resultName = computed(() => {
    const base = fileName.value.replace(/\.(geojson|json|wkt|kml)$/i, '') || 'omap-result'
    const extension = { GeoJSON: 'geojson', WKT: 'wkt', KML: 'kml' }[targetFormat.value]
    return `${base}.${extension}`
  })

  watch(sourceFormat, (format) => {
    if (format === 'KML') sourceProjection.value = 'EPSG:4326'
    result.value = null
  })
  watch(targetFormat, (format) => {
    if (format === 'KML') targetProjection.value = 'EPSG:4326'
    result.value = null
  })
  watch([sourceText, sourceProjection, targetProjection, sourceCustomProjection, targetCustomProjection], () => { result.value = null })

  async function readFile(file: File) {
    error.value = ''
    message.value = ''
    result.value = null
    if (file.size > 8 * 1024 * 1024) {
      error.value = '单个文件暂时不能超过 8 MB。'
      return
    }
    const extension = file.name.split('.').pop()?.toLowerCase()
    const inferred = extension === 'geojson' || extension === 'json' ? 'GeoJSON'
      : extension === 'wkt' ? 'WKT'
        : extension === 'kml' ? 'KML' : null
    if (!inferred) {
      error.value = '请选择 .geojson、.json、.wkt 或 .kml 文件。'
      return
    }
    try {
      sourceText.value = await file.text()
      sourceFormat.value = inferred
      fileName.value = file.name
      message.value = `已读取 ${file.name}`
    } catch {
      error.value = '文件读取失败，请重试。'
    }
  }

  function loadSample() {
    sourceText.value = SAMPLE_GEOJSON
    sourceFormat.value = 'GeoJSON'
    sourceProjection.value = 'EPSG:4326'
    fileName.value = 'hangzhou-example.geojson'
    error.value = ''
    message.value = '已载入杭州示例数据。'
  }

  function clearInput() {
    sourceText.value = ''
    fileName.value = ''
    result.value = null
    error.value = ''
    message.value = ''
  }

  function convert() {
    error.value = ''
    message.value = ''
    result.value = null
    try {
      result.value = convertData({
        text: sourceText.value,
        sourceFormat: sourceFormat.value,
        targetFormat: targetFormat.value,
        sourceProjection: sourceProjection.value,
        targetProjection: targetProjection.value,
        sourceCustomProjection: sourceCustomProjection.value,
        targetCustomProjection: targetCustomProjection.value,
      })
      message.value = `转换完成，共 ${result.value.featureCount} 个要素。`
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : '转换失败，请检查数据格式与坐标系。'
    }
  }

  async function copyResult() {
    if (!result.value) return
    try {
      await navigator.clipboard.writeText(result.value.output)
      message.value = '结果已复制到剪贴板。'
    } catch {
      error.value = '复制失败，请手动选择结果文本。'
    }
  }

  function downloadResult() {
    if (!result.value) return
    const contentType = targetFormat.value === 'GeoJSON' ? 'application/geo+json'
      : targetFormat.value === 'KML' ? 'application/vnd.google-earth.kml+xml'
        : 'text/plain'
    const blob = new Blob([result.value.output], { type: `${contentType};charset=utf-8` })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = resultName.value
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    message.value = `已下载 ${resultName.value}`
  }

  return {
    sourceText,
    sourceFormat,
    targetFormat,
    sourceProjection,
    targetProjection,
    sourceCustomProjection,
    targetCustomProjection,
    fileName,
    sourceSize,
    canConvert,
    result,
    resultName,
    error,
    message,
    readFile,
    loadSample,
    clearInput,
    convert,
    copyResult,
    downloadResult,
  }
}
