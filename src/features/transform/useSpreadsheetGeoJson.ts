import { computed, ref, shallowRef, watch } from 'vue'
import * as XLSX from 'xlsx'

type CellValue = string | number | boolean
type DataRow = Record<string, CellValue>
type CsvEncoding = 'auto' | 'utf-8' | 'gbk' | 'gb18030' | 'utf-16le' | 'utf-16be'
type GeometryKind = 'Point' | 'LineString'
type FieldCase = 'preserve' | 'upper' | 'lower'

interface FilterRule {
  id: number
  field: string
  values: string[]
}

interface GeoJsonFeature {
  type: 'Feature'
  properties: Record<string, CellValue>
  geometry: {
    type: GeometryKind
    coordinates: [number, number] | [[number, number], [number, number]]
  }
}

function cellValue(value: unknown): CellValue {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value
  return String(value)
}

function makeHeaders(row: unknown[]): string[] {
  const used = new Set<string>()
  return row.map((value, index) => {
    const base = String(value ?? '').trim() || '字段' + (index + 1)
    let candidate = base
    let suffix = 2
    while (used.has(candidate)) {
      candidate = base + '_' + suffix
      suffix += 1
    }
    used.add(candidate)
    return candidate
  })
}

function parseWorksheet(workbook: XLSX.WorkBook, sheetName: string) {
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) throw new Error('无法读取所选工作表。')
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: true,
    blankrows: false,
  })
  if (matrix.length < 2) throw new Error('工作表至少需要一行表头和一行数据。')
  const headers = makeHeaders(matrix[0] ?? [])
  if (!headers.length) throw new Error('没有识别到表头字段。')
  const rows = matrix.slice(1)
    .filter((row) => headers.some((_, index) => cellValue(row[index]) !== ''))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, cellValue(row[index])])) as DataRow)
  if (!rows.length) throw new Error('工作表中没有可转换的数据行。')
  return { headers, rows }
}

function decodeCsv(bytes: Uint8Array, encoding: CsvEncoding) {
  const startsWith = (prefix: number[]) => prefix.every((byte, index) => bytes[index] === byte)
  if (encoding === 'auto') {
    if (startsWith([0xef, 0xbb, 0xbf])) return { text: new TextDecoder('utf-8').decode(bytes), encoding: 'UTF-8（BOM）' }
    if (startsWith([0xff, 0xfe])) return { text: new TextDecoder('utf-16le').decode(bytes), encoding: 'UTF-16 LE' }
    if (startsWith([0xfe, 0xff])) return { text: new TextDecoder('utf-16be').decode(bytes), encoding: 'UTF-16 BE' }
    try {
      return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), encoding: 'UTF-8' }
    } catch {
      return { text: new TextDecoder('gb18030').decode(bytes), encoding: 'GB18030（自动回退）' }
    }
  }

  const labels: Record<Exclude<CsvEncoding, 'auto'>, string> = {
    'utf-8': 'UTF-8',
    gbk: 'GBK',
    gb18030: 'GB18030',
    'utf-16le': 'UTF-16 LE',
    'utf-16be': 'UTF-16 BE',
  }
  try {
    return { text: new TextDecoder(encoding, { fatal: encoding === 'utf-8' }).decode(bytes), encoding: labels[encoding] }
  } catch {
    throw new Error('CSV 编码无法解析，请切换编码后重新读取。')
  }
}

function normalizeValue(value: CellValue) {
  return String(value).trim()
}

function guessField(headers: string[], kind: 'longitude' | 'latitude', endpoint?: 'start' | 'end') {
  const normalized = headers.map((header) => ({ header, value: header.toLowerCase().replace(/[\s_-]+/g, '') }))
  const coordinate = kind === 'longitude'
    ? /(longitude|long|lon|lng|经度)/
    : /(latitude|lat|纬度)/
  const endpointPattern = endpoint === 'start'
    ? /(start|from|起点|起始|开始)/
    : endpoint === 'end'
      ? /(end|to|终点|结束)/
      : null
  const match = normalized.find(({ value }) => coordinate.test(value) && (!endpointPattern || endpointPattern.test(value)))
  if (match) return match.header
  if (!endpoint) {
    const exact = kind === 'longitude' ? /^(x|xcoord|easting|经度x)$/ : /^(y|ycoord|northing|纬度y)$/
    return normalized.find(({ value }) => exact.test(value))?.header ?? ''
  }
  return ''
}

function parseCoordinate(value: CellValue | undefined, min: number, max: number) {
  if (typeof value === 'boolean' || value === undefined || value === '') return null
  const coordinate = typeof value === 'number' ? value : Number(value.trim().replace(/,/g, ''))
  if (!Number.isFinite(coordinate) || coordinate < min || coordinate > max) return null
  return coordinate
}

function safeBaseName(fileName: string) {
  const base = fileName.replace(/\.(xlsx|xls|csv)$/i, '').replace(/[<>:"/\\|?*]/g, '_').trim()
  return base || 'table-data'
}

export function useSpreadsheetGeoJson() {
  const file = shallowRef<File | null>(null)
  const workbook = shallowRef<XLSX.WorkBook | null>(null)
  const fileName = ref('')
  const sheetNames = ref<string[]>([])
  const selectedSheet = ref('')
  const fileKind = ref<'csv' | 'excel' | ''>('')
  const csvEncoding = ref<CsvEncoding>('auto')
  const detectedEncoding = ref('')
  const outputBom = ref(true)
  const headers = ref<string[]>([])
  const rows = shallowRef<DataRow[]>([])
  const geometryKind = ref<GeometryKind>('Point')
  const fieldCase = ref<FieldCase>('preserve')
  const selectedProperties = ref<string[]>([])
  const filters = ref<FilterRule[]>([])
  const reading = ref(false)
  const error = ref('')
  const notice = ref('')
  let nextFilterId = 1

  const longitudeField = ref('')
  const latitudeField = ref('')
  const startLongitudeField = ref('')
  const startLatitudeField = ref('')
  const endLongitudeField = ref('')
  const endLatitudeField = ref('')

  const totalRows = computed(() => rows.value.length)
  const activeFilters = computed(() => filters.value.filter((rule) => rule.field && rule.values.length > 0))
  const filteredRows = computed(() => rows.value.filter((row) => activeFilters.value.every(
    (rule) => rule.values.includes(normalizeValue(row[rule.field] ?? '')),
  )))

  function valuesFor(field: string) {
    if (!field) return []
    const values = new Set<string>()
    for (const row of rows.value) {
      const value = normalizeValue(row[field] ?? '')
      if (value) values.add(value)
      if (values.size >= 100) break
    }
    return Array.from(values)
  }

  const filterRuleData = computed(() => filters.value.map((rule) => {
    const matchingRows = rule.field && rule.values.length
      ? rows.value.filter((row) => rule.values.includes(normalizeValue(row[rule.field] ?? ''))).length
      : rows.value.length
    const allValues = rule.field ? new Set(rows.value.map((row) => normalizeValue(row[rule.field] ?? '')).filter(Boolean)).size : 0
    return {
      ...rule,
      options: valuesFor(rule.field),
      matchingRows,
      allValues,
      truncated: allValues > 100,
    }
  }))

  const hasCoordinateFields = computed(() => geometryKind.value === 'Point'
    ? Boolean(longitudeField.value && latitudeField.value)
    : Boolean(startLongitudeField.value && startLatitudeField.value && endLongitudeField.value && endLatitudeField.value))

  function propertyKey(field: string) {
    if (fieldCase.value === 'upper') return field.toUpperCase()
    if (fieldCase.value === 'lower') return field.toLowerCase()
    return field
  }

  const propertyKeyCollisions = computed(() => {
    const keys = selectedProperties.value.map(propertyKey)
    return keys.some((key, index) => keys.indexOf(key) !== index)
  })

  function createFeature(row: DataRow): GeoJsonFeature | null {
    let coordinates: [number, number] | [[number, number], [number, number]]
    if (geometryKind.value === 'Point') {
      const longitude = parseCoordinate(row[longitudeField.value], -180, 180)
      const latitude = parseCoordinate(row[latitudeField.value], -90, 90)
      if (longitude === null || latitude === null) return null
      coordinates = [longitude, latitude]
    } else {
      const startLongitude = parseCoordinate(row[startLongitudeField.value], -180, 180)
      const startLatitude = parseCoordinate(row[startLatitudeField.value], -90, 90)
      const endLongitude = parseCoordinate(row[endLongitudeField.value], -180, 180)
      const endLatitude = parseCoordinate(row[endLatitudeField.value], -90, 90)
      if (startLongitude === null || startLatitude === null || endLongitude === null || endLatitude === null) return null
      coordinates = [[startLongitude, startLatitude], [endLongitude, endLatitude]]
    }

    const properties = Object.fromEntries(selectedProperties.value.map((field) => [propertyKey(field), row[field] ?? ''])) as Record<string, CellValue>
    return { type: 'Feature', properties, geometry: { type: geometryKind.value, coordinates } }
  }

  const summary = computed(() => {
    let validCount = 0
    let skippedCount = 0
    const previewFeatures: GeoJsonFeature[] = []
    if (!hasCoordinateFields.value) return { validCount, skippedCount, previewFeatures }
    for (const row of filteredRows.value) {
      const feature = createFeature(row)
      if (!feature) {
        skippedCount += 1
        continue
      }
      validCount += 1
      if (previewFeatures.length < 3) previewFeatures.push(feature)
    }
    return { validCount, skippedCount, previewFeatures }
  })

  const filteredCount = computed(() => filteredRows.value.length)
  const canExport = computed(() => hasCoordinateFields.value && summary.value.validCount > 0 && !propertyKeyCollisions.value && !reading.value)
  const previewJson = computed(() => JSON.stringify({ type: 'FeatureCollection', features: summary.value.previewFeatures }, null, 2))
  const outputName = computed(() => safeBaseName(fileName.value) + '.geojson')
  const previewMessage = computed(() => {
    if (!rows.value.length) return '上传表格后，选择几何类型与坐标字段，即可生成 GeoJSON 预览。'
    if (!hasCoordinateFields.value) return geometryKind.value === 'Point'
      ? '请选择经度和纬度字段。'
      : '请选择起点经纬度与终点经纬度字段。'
    if (propertyKeyCollisions.value) return '字段名格式化后发生重复，请调整字段选择或字段名格式。'
    if (filteredCount.value === 0) return '当前筛选条件没有匹配的行。'
    if (summary.value.validCount === 0) return '没有可导出的要素，请检查坐标字段是否选择正确、数据中是否为有效经纬度。'
    if (summary.value.skippedCount > 0) return '无效坐标行会跳过；下载文件只包含有效要素。'
    return '预览显示前 3 个要素，导出文件包含全部有效要素。'
  })

  function setGuessedFields(nextHeaders: string[]) {
    longitudeField.value = guessField(nextHeaders, 'longitude')
    latitudeField.value = guessField(nextHeaders, 'latitude')
    startLongitudeField.value = guessField(nextHeaders, 'longitude', 'start')
    startLatitudeField.value = guessField(nextHeaders, 'latitude', 'start')
    endLongitudeField.value = guessField(nextHeaders, 'longitude', 'end')
    endLatitudeField.value = guessField(nextHeaders, 'latitude', 'end')
    if (geometryKind.value === 'LineString') {
      const normalized = nextHeaders.map((header) => ({ header, value: header.toLowerCase().replace(/[\s_-]+/g, '') }))
      startLongitudeField.value ||= normalized.find(({ value }) => /^(start|from|起点)(x|lon|lng|经度)$/.test(value))?.header ?? ''
      startLatitudeField.value ||= normalized.find(({ value }) => /^(start|from|起点)(y|lat|纬度)$/.test(value))?.header ?? ''
      endLongitudeField.value ||= normalized.find(({ value }) => /^(end|to|终点)(x|lon|lng|经度)$/.test(value))?.header ?? ''
      endLatitudeField.value ||= normalized.find(({ value }) => /^(end|to|终点)(y|lat|纬度)$/.test(value))?.header ?? ''
    }
  }

  function loadSheet(sheetName: string) {
    if (!workbook.value || !sheetName) return
    try {
      const parsed = parseWorksheet(workbook.value, sheetName)
      headers.value = parsed.headers
      rows.value = parsed.rows
      selectedProperties.value = [...parsed.headers]
      filters.value = []
      setGuessedFields(parsed.headers)
      selectedSheet.value = sheetName
      error.value = ''
      notice.value = '已读取「' + fileName.value + '」的「' + sheetName + '」工作表，共 ' + parsed.rows.length + ' 行、' + parsed.headers.length + ' 个字段。'
    } catch (caught) {
      headers.value = []
      rows.value = []
      selectedProperties.value = []
      error.value = caught instanceof Error ? caught.message : '工作表读取失败。'
      notice.value = ''
    }
  }

  async function parseFile(source: File) {
    reading.value = true
    error.value = ''
    notice.value = ''
    headers.value = []
    rows.value = []
    filters.value = []
    selectedProperties.value = []
    workbook.value = null
    sheetNames.value = []
    selectedSheet.value = ''

    try {
      if (source.size > 25 * 1024 * 1024) throw new Error('文件暂时不能超过 25 MB。')
      const extension = source.name.split('.').pop()?.toLowerCase()
      if (!extension || !['xlsx', 'xls', 'csv'].includes(extension)) throw new Error('请选择 .xlsx、.xls 或 .csv 文件。')
      file.value = source
      fileName.value = source.name
      fileKind.value = extension === 'csv' ? 'csv' : 'excel'
      detectedEncoding.value = ''

      let parsedWorkbook: XLSX.WorkBook
      if (extension === 'csv') {
        const decoded = decodeCsv(new Uint8Array(await source.arrayBuffer()), csvEncoding.value)
        detectedEncoding.value = decoded.encoding
        parsedWorkbook = XLSX.read(decoded.text, { type: 'string', cellDates: true })
      } else {
        parsedWorkbook = XLSX.read(await source.arrayBuffer(), { type: 'array', cellDates: true })
      }
      if (!parsedWorkbook.SheetNames.length) throw new Error('文件中没有可读取的工作表。')
      workbook.value = parsedWorkbook
      sheetNames.value = [...parsedWorkbook.SheetNames]
      selectedSheet.value = parsedWorkbook.SheetNames[0]
      loadSheet(selectedSheet.value)
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : '文件读取失败，请检查格式和编码后重试。'
      notice.value = ''
    } finally {
      reading.value = false
    }
  }

  async function readFile(source: File) {
    file.value = source
    await parseFile(source)
  }

  function clear() {
    file.value = null
    workbook.value = null
    fileName.value = ''
    sheetNames.value = []
    selectedSheet.value = ''
    fileKind.value = ''
    detectedEncoding.value = ''
    headers.value = []
    rows.value = []
    selectedProperties.value = []
    filters.value = []
    longitudeField.value = ''
    latitudeField.value = ''
    startLongitudeField.value = ''
    startLatitudeField.value = ''
    endLongitudeField.value = ''
    endLatitudeField.value = ''
    error.value = ''
    notice.value = ''
  }

  async function reparseCsv() {
    if (file.value && fileKind.value === 'csv') await parseFile(file.value)
  }

  watch(csvEncoding, () => { void reparseCsv() })

  function setGeometryKind(kind: GeometryKind) {
    geometryKind.value = kind
  }

  function addFilter() {
    filters.value.push({ id: nextFilterId, field: '', values: [] })
    nextFilterId += 1
  }

  function removeFilter(id: number) {
    filters.value = filters.value.filter((rule) => rule.id !== id)
  }

  function setFilterField(id: number, field: string) {
    const rule = filters.value.find((candidate) => candidate.id === id)
    if (rule) {
      rule.field = field
      rule.values = []
    }
  }

  function toggleFilterValue(id: number, value: string) {
    const rule = filters.value.find((candidate) => candidate.id === id)
    if (!rule) return
    rule.values = rule.values.includes(value)
      ? rule.values.filter((candidate) => candidate !== value)
      : [...rule.values, value]
  }

  function selectAllProperties() {
    selectedProperties.value = [...headers.value]
  }

  function selectNoProperties() {
    selectedProperties.value = []
  }

  function invertProperties() {
    const selected = new Set(selectedProperties.value)
    selectedProperties.value = headers.value.filter((field) => !selected.has(field))
  }

  function makeGeoJsonText() {
    if (!canExport.value) throw new Error(previewMessage.value)
    const features: GeoJsonFeature[] = []
    for (const row of filteredRows.value) {
      const feature = createFeature(row)
      if (feature) features.push(feature)
    }
    return JSON.stringify({ type: 'FeatureCollection', features }, null, 2)
  }

  function downloadGeoJson() {
    try {
      const content = makeGeoJsonText()
      const blob = new Blob([outputBom.value ? '\uFEFF' + content : content], { type: 'application/geo+json;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = outputName.value
      anchor.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      notice.value = '已下载 ' + outputName.value + '，共 ' + summary.value.validCount + ' 个要素。'
      error.value = ''
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : '导出失败，请检查数据设置。'
    }
  }

  return {
    fileName, fileKind, sheetNames, selectedSheet, csvEncoding, detectedEncoding, outputBom,
    headers, rows, geometryKind, fieldCase, selectedProperties, filters, filterRuleData,
    longitudeField, latitudeField, startLongitudeField, startLatitudeField, endLongitudeField, endLatitudeField,
    totalRows, filteredCount, validCount: computed(() => summary.value.validCount),
    skippedCount: computed(() => summary.value.skippedCount), previewJson, previewMessage, outputName,
    canExport, propertyKeyCollisions, reading, error, notice,
    loadSheet, readFile, clear, setGeometryKind, addFilter, removeFilter, setFilterField, toggleFilterValue,
    selectAllProperties, selectNoProperties, invertProperties, downloadGeoJson, makeGeoJsonText,
  }
}
