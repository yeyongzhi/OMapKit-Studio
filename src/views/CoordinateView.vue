<script setup lang="ts">
import { computed, ref } from 'vue'
import * as XLSX from 'xlsx'
import {
  ArrowDownToLine,
  ArrowLeftRight,
  Check,
  FileJson2,
  FileSpreadsheet,
  FileText,
  RefreshCw,
  ScanLine,
} from '@lucide/vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import TopNavigation from '@/components/navigation/TopNavigation.vue'
import CoordinateSystemPicker from '@/features/coordinate/CoordinateSystemPicker.vue'
import ExcelBatchCoordinate from './ExcelBatchCoordinate.vue'
import { transformCoordinate } from '@/features/coordinate/projection'

type SourceMode = 'text' | 'table' | 'geojson'
type FileFormat = 'csv' | 'excel' | 'geojson'
type Matrix = unknown[][]

const processingMode = ref<'single' | 'excel-batch'>('excel-batch')
const sourceMode = ref<SourceMode>('text')
const fileFormat = ref<FileFormat | null>(null)
const sourceText = ref('120.1551, 30.2741\n120.1625, 30.2794')
const outputText = ref('')
const inputFile = ref<File | null>(null)
const fileMatrix = ref<Matrix>([])
const convertedMatrix = ref<Matrix>([])
const geoJsonValue = ref<Record<string, unknown> | null>(null)
const convertedGeoJson = ref<Record<string, unknown> | null>(null)
const workbook = ref<XLSX.WorkBook | null>(null)
const worksheet = ref('')
const sourceXField = ref('')
const sourceYField = ref('')
const outputXField = ref('longitude_out')
const outputYField = ref('latitude_out')
const inputCrs = ref('EPSG:4326')
const outputCrs = ref('GCJ-02')
const customInputCrs = ref('')
const customOutputCrs = ref('')
const errorMessage = ref('')
const successMessage = ref('')
const outputBlob = ref<Blob | null>(null)
const outputFilename = ref('')
const filePickerKey = ref(0)

const headers = computed(() => fileMatrix.value[0]?.map((value, index) => String(value ?? '').trim() || `字段 ${index + 1}`) ?? [])
const previewMatrix = computed(() => convertedMatrix.value.length ? convertedMatrix.value : fileMatrix.value)
const isTabular = computed(() => fileFormat.value === 'csv' || fileFormat.value === 'excel')
const fileDescription = computed(() => {
  if (!inputFile.value) return sourceMode.value === 'table'
    ? '读取 CSV 或 Excel（.xlsx / .xls）表格，选择字段后进行坐标转换。'
    : '读取 GeoJSON 文件，识别几何类型并保留要素属性。'
  const details = fileFormat.value === 'geojson'
    ? `${geoJsonValue.value?.type ?? 'GeoJSON'} · ${geoFeatureCount(geoJsonValue.value)} 个要素`
    : `${Math.max(0, fileMatrix.value.length - 1)} 行数据 · ${headers.value.length} 个字段`
  return `${inputFile.value.name} · ${details}`
})

function parseCsv(source: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        field += '"'
        index += 1
      } else if (char === '"') {
        quoted = false
      } else {
        field += char
      }
    } else if (char === '"' && field.length === 0) {
      quoted = true
    } else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[index + 1] === '\n') index += 1
      row.push(field)
      if (row.some((cell) => cell.trim() !== '')) rows.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }
  row.push(field)
  if (row.some((cell) => cell.trim() !== '')) rows.push(row)
  return rows
}

function csvStringify(rows: Matrix): string {
  return rows.map((row) => row.map((value) => {
    const field = String(value ?? '')
    return /[",\r\n]/.test(field) ? `"${field.replaceAll('"', '""')}"` : field
  }).join(',')).join('\r\n')
}

function isGeoJson(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || !('type' in value)) return false
  const candidate = value as { type?: unknown; features?: unknown; geometries?: unknown }
  if (candidate.type === 'FeatureCollection') return Array.isArray(candidate.features)
  if (candidate.type === 'Feature') return 'geometry' in candidate
  return ['Point', 'MultiPoint', 'LineString', 'MultiLineString', 'Polygon', 'MultiPolygon', 'GeometryCollection'].includes(String(candidate.type))
    && (candidate.type === 'GeometryCollection' ? Array.isArray(candidate.geometries) : 'coordinates' in candidate)
}

function geoFeatureCount(value: Record<string, unknown> | null): number {
  if (!value) return 0
  if (value.type === 'FeatureCollection' && Array.isArray(value.features)) return value.features.length
  return value.type === 'Feature' || 'coordinates' in value || value.type === 'GeometryCollection' ? 1 : 0
}

function resetOutput() {
  outputText.value = ''
  convertedMatrix.value = []
  convertedGeoJson.value = null
  outputBlob.value = null
  outputFilename.value = ''
  successMessage.value = ''
}

async function onFilePicked(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  errorMessage.value = ''
  resetOutput()
  inputFile.value = file
  const extension = file.name.split('.').pop()?.toLowerCase()
  try {
    if (sourceMode.value === 'table' && extension === 'csv') {
      fileFormat.value = 'csv'
      const rows = parseCsv((await file.text()).replace(/^\uFEFF/, ''))
      if (!rows.length || rows.length < 2) throw new Error('表格需要包含表头和至少一行坐标数据。')
      fileMatrix.value = rows
      sourceXField.value = headers.value[0]
      sourceYField.value = headers.value[1] ?? headers.value[0]
    } else if (sourceMode.value === 'table' && (extension === 'xlsx' || extension === 'xls')) {
      fileFormat.value = 'excel'
      const data = await file.arrayBuffer()
      const loadedWorkbook = XLSX.read(data, { type: 'array' })
      if (!loadedWorkbook.SheetNames.length) throw new Error('Excel 文件中没有可读取的工作表。')
      workbook.value = loadedWorkbook
      worksheet.value = loadedWorkbook.SheetNames[0]
      loadWorksheet(worksheet.value)
    } else if (sourceMode.value === 'geojson' && (extension === 'geojson' || extension === 'json')) {
      fileFormat.value = 'geojson'
      const value: unknown = JSON.parse(await file.text())
      if (!isGeoJson(value)) throw new Error('文件内容不是有效的 GeoJSON Feature、FeatureCollection 或 Geometry。')
      geoJsonValue.value = value
    } else {
      throw new Error(sourceMode.value === 'table' ? '请选择 CSV、XLSX 或 XLS 表格文件。' : '请选择 GeoJSON 文件。')
    }
    successMessage.value = sourceMode.value === 'table'
      ? '文件已读取，请确认坐标字段后开始转换。'
      : `已识别为 ${geoJsonValue.value?.type ?? 'GeoJSON'}，确认坐标系后即可转换。`
  } catch (error) {
    fileFormat.value = null
    fileMatrix.value = []
    geoJsonValue.value = null
    errorMessage.value = error instanceof Error ? error.message : '读取文件时发生错误。'
  }
}

function loadWorksheet(name: string) {
  if (!workbook.value || !name) return
  const sheet = workbook.value.Sheets[name]
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: '' })
  if (!rows.length || rows.length < 2) throw new Error('所选工作表需要包含表头和至少一行坐标数据。')
  fileMatrix.value = rows
  sourceXField.value = headers.value[0]
  sourceYField.value = headers.value[1] ?? headers.value[0]
  resetOutput()
}

function formatNumber(value: number): string {
  return Number(value.toFixed(8)).toString()
}

function transformText() {
  const lines = sourceText.value.split(/\r?\n/)
  const result = lines.map((line, lineIndex) => {
    if (!line.trim() || line.trimStart().startsWith('#')) return line
    const parts = line.trim().split(/[,;\t]|\s+/).map((part) => part.trim()).filter(Boolean)
    if (parts.length < 2) throw new Error(`第 ${lineIndex + 1} 行至少需要两个坐标值。`)
    const x = Number(parts[0])
    const y = Number(parts[1])
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`第 ${lineIndex + 1} 行的前两个字段必须是数字坐标。`)
    const [outX, outY] = transformCoordinate(x, y, inputCrs.value, outputCrs.value, customInputCrs.value, customOutputCrs.value)
    const delimiter = line.includes('\t') ? '\t' : line.includes(';') ? '; ' : line.includes(',') ? ', ' : ' '
    parts[0] = formatNumber(outX)
    parts[1] = formatNumber(outY)
    return parts.join(delimiter)
  })
  outputText.value = result.join('\n')
  successMessage.value = '文本坐标转换完成。'
}

function transformTable() {
  if (!fileMatrix.value.length) throw new Error('请先读取 CSV 或 Excel 文件。')
  const xIndex = headers.value.indexOf(sourceXField.value)
  const yIndex = headers.value.indexOf(sourceYField.value)
  if (xIndex < 0 || yIndex < 0) throw new Error('请选择有效的 X、Y 坐标字段。')
  const xName = outputXField.value.trim()
  const yName = outputYField.value.trim()
  if (!xName || !yName) throw new Error('请填写转换结果的 X、Y 输出字段名。')
  if (xName === yName) throw new Error('X、Y 输出字段不能同名。')

  const rows = fileMatrix.value.map((row) => [...row])
  const outputHeaders = headers.value
  const findOrAdd = (name: string) => {
    const existing = outputHeaders.indexOf(name)
    if (existing >= 0) return existing
    outputHeaders.push(name)
    rows[0].push(name)
    return outputHeaders.length - 1
  }
  const outXIndex = findOrAdd(xName)
  const outYIndex = findOrAdd(yName)
  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index]
    while (row.length < outputHeaders.length) row.push('')
    if (String(row[xIndex] ?? '').trim() === '' && String(row[yIndex] ?? '').trim() === '') continue
    const x = Number(row[xIndex])
    const y = Number(row[yIndex])
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`第 ${index + 1} 行字段“${sourceXField.value} / ${sourceYField.value}”不是有效数字。`)
    const [outX, outY] = transformCoordinate(x, y, inputCrs.value, outputCrs.value, customInputCrs.value, customOutputCrs.value)
    row[outXIndex] = formatNumber(outX)
    row[outYIndex] = formatNumber(outY)
  }
  convertedMatrix.value = rows
  if (fileFormat.value === 'csv') {
    outputBlob.value = new Blob([`\uFEFF${csvStringify(rows)}`], { type: 'text/csv;charset=utf-8' })
    outputFilename.value = `${inputFile.value?.name.replace(/\.[^.]+$/, '') || 'coordinates'}-converted.csv`
  } else if (fileFormat.value === 'excel' && workbook.value) {
    workbook.value.Sheets[worksheet.value] = XLSX.utils.aoa_to_sheet(rows)
    const data = XLSX.write(workbook.value, { bookType: 'xlsx', type: 'array' })
    outputBlob.value = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    outputFilename.value = `${inputFile.value?.name.replace(/\.[^.]+$/, '') || 'coordinates'}-converted.xlsx`
  }
  successMessage.value = `坐标转换完成，结果写入字段“${xName}”和“${yName}”。`
}

function transformPositions(value: unknown): unknown {
  if (!Array.isArray(value)) return value
  if (value.length >= 2 && typeof value[0] === 'number' && typeof value[1] === 'number') {
    const [x, y] = transformCoordinate(value[0], value[1], inputCrs.value, outputCrs.value, customInputCrs.value, customOutputCrs.value)
    return [Number(formatNumber(x)), Number(formatNumber(y)), ...value.slice(2)]
  }
  return value.map(transformPositions)
}

function transformGeoJson(value: Record<string, unknown>): Record<string, unknown> {
  const result = structuredClone(value)
  const visitGeometry = (geometry: Record<string, unknown> | null) => {
    if (!geometry) return
    if (geometry.type === 'GeometryCollection' && Array.isArray(geometry.geometries)) {
      geometry.geometries.forEach((child) => visitGeometry(child as Record<string, unknown> | null))
    } else if ('coordinates' in geometry) {
      geometry.coordinates = transformPositions(geometry.coordinates)
    }
  }

  if (result.type === 'FeatureCollection' && Array.isArray(result.features)) {
    for (const feature of result.features as Array<Record<string, unknown>>) {
      visitGeometry((feature.geometry ?? null) as Record<string, unknown> | null)
    }
  } else if (result.type === 'Feature') {
    visitGeometry((result.geometry ?? null) as Record<string, unknown> | null)
  } else {
    visitGeometry(result)
  }
  if (outputCrs.value !== 'EPSG:4326') {
    result.crs = { type: 'name', properties: { name: outputCrs.value === 'CUSTOM' ? customOutputCrs.value : outputCrs.value } }
  } else {
    delete result.crs
  }
  return result
}

function convert() {
  errorMessage.value = ''
  successMessage.value = ''
  resetOutput()
  try {
    if (sourceMode.value === 'text') {
      transformText()
    } else if (fileFormat.value === 'csv' || fileFormat.value === 'excel') {
      transformTable()
    } else if (fileFormat.value === 'geojson' && geoJsonValue.value) {
      const result = transformGeoJson(geoJsonValue.value)
      convertedGeoJson.value = result
      outputBlob.value = new Blob([JSON.stringify(result, null, 2)], { type: 'application/geo+json;charset=utf-8' })
      outputFilename.value = `${inputFile.value?.name.replace(/\.(geojson|json)$/i, '') || 'coordinates'}-converted.geojson`
      successMessage.value = `GeoJSON 转换完成，已保留 ${geoFeatureCount(result)} 个要素及其属性。`
    } else {
      throw new Error('请先选择并读取一个支持的文件。')
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '坐标转换失败，请检查输入数据和坐标系设置。'
  }
}

function downloadResult() {
  if (!outputBlob.value || !outputFilename.value) return
  const url = URL.createObjectURL(outputBlob.value)
  const link = document.createElement('a')
  link.href = url
  link.download = outputFilename.value
  link.click()
  URL.revokeObjectURL(url)
}

async function copyOutput() {
  if (!outputText.value) return
  try {
    await navigator.clipboard.writeText(outputText.value)
    successMessage.value = '转换结果已复制到剪贴板。'
  } catch {
    errorMessage.value = '当前浏览器未允许访问剪贴板，请直接选择并复制文本。'
  }
}

function clearInput() {
  filePickerKey.value += 1
  inputFile.value = null
  fileFormat.value = null
  fileMatrix.value = []
  convertedMatrix.value = []
  geoJsonValue.value = null
  convertedGeoJson.value = null
  workbook.value = null
  worksheet.value = ''
  resetOutput()
  errorMessage.value = ''
  successMessage.value = ''
}

function swapCoordinateSystems() {
  const previousInput = inputCrs.value
  inputCrs.value = outputCrs.value
  outputCrs.value = previousInput
  const previousCustom = customInputCrs.value
  customInputCrs.value = customOutputCrs.value
  customOutputCrs.value = previousCustom
}

function switchSourceMode(mode: SourceMode) {
  sourceMode.value = mode
  clearInput()
}
</script>

<template>
  <main class="coordinate-page">
    <TopNavigation class="coordinate-navigation" />

    <div class="processing-shell">
      <div class="processing-tabs" role="tablist" aria-label="坐标处理模式">
        <button type="button" role="tab" :aria-selected="processingMode === 'single'" class="processing-tab" :class="{ active: processingMode === 'single' }" @click="processingMode = 'single'">单个坐标转换</button>
        <button type="button" role="tab" :aria-selected="processingMode === 'excel-batch'" class="processing-tab" :class="{ active: processingMode === 'excel-batch' }" @click="processingMode = 'excel-batch'">Excel 批量转换</button>
      </div>
      <section v-if="processingMode === 'single'" class="workspace">
      <div class="workspace-grid">
        <Card class="panel input-panel">
          <CardHeader class="panel-header">
            <div class="panel-step">01</div>
            <div class="panel-heading-copy">
              <CardTitle>输入坐标</CardTitle>
              <CardDescription>选择一种数据输入格式</CardDescription>
            </div>
            <div class="mode-switch">
              <Button size="sm" :variant="sourceMode === 'text' ? 'default' : 'ghost'" @click="switchSourceMode('text')"><FileText :size="14" />文本</Button>
              <Button size="sm" :variant="sourceMode === 'table' ? 'default' : 'ghost'" @click="switchSourceMode('table')"><FileSpreadsheet :size="14" />CSV / Excel</Button>
              <Button size="sm" :variant="sourceMode === 'geojson' ? 'default' : 'ghost'" @click="switchSourceMode('geojson')"><FileJson2 :size="14" />GeoJSON</Button>
            </div>
          </CardHeader>
          <CardContent class="input-content">
            <template v-if="sourceMode === 'text'">
              <Label for="coordinate-text">每行输入一组 X、Y 坐标，支持逗号、空格、分号或制表符分隔</Label>
              <Textarea id="coordinate-text" v-model="sourceText" class="coordinate-textarea" placeholder="120.1551, 30.2741&#10;120.1625, 30.2794" />
              <div class="field-note">可用 # 开头的行添加注释；输出保留原有分隔符格式。</div>
            </template>
            <template v-else>
              <Label for="coordinate-file">{{ sourceMode === 'table' ? 'CSV / Excel 文件' : 'GeoJSON 文件' }}</Label>
              <Input :key="filePickerKey" id="coordinate-file" type="file" :accept="sourceMode === 'table' ? '.csv,.xlsx,.xls' : '.geojson,.json'" class="file-input" @change="onFilePicked" />
              <div class="file-meta">
                <component :is="sourceMode === 'geojson' || fileFormat === 'geojson' ? FileJson2 : sourceMode === 'table' ? FileSpreadsheet : FileText" :size="16" />
                <span>{{ fileDescription }}</span>
              </div>
              <div v-if="fileFormat === 'excel' && workbook" class="worksheet-row">
                <Label for="worksheet-select">工作表</Label>
                <Select v-model="worksheet" @update:model-value="loadWorksheet(String($event))">
                  <SelectTrigger id="worksheet-select" class="worksheet-select"><SelectValue placeholder="选择工作表" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="name in workbook.SheetNames" :key="name" :value="name">{{ name }}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div v-if="inputFile" class="file-actions">
                <Badge variant="outline">{{ fileFormat?.toUpperCase() }}</Badge>
                <Button variant="ghost" size="sm" @click="clearInput">移除文件</Button>
              </div>
            </template>
          </CardContent>
        </Card>

        <Card class="panel settings-panel">
          <CardHeader class="panel-header">
            <div class="panel-step">02</div>
            <div class="panel-heading-copy">
              <CardTitle>转换设置</CardTitle>
              <CardDescription>选择坐标字段与转换方向</CardDescription>
            </div>
          </CardHeader>
          <CardContent class="settings-content">
            <div v-if="sourceMode === 'table' && isTabular" class="field-pair">
              <div class="form-field">
                <Label for="x-field">X / 经度字段</Label>
                <Select v-model="sourceXField">
                  <SelectTrigger id="x-field"><SelectValue placeholder="选择 X 字段" /></SelectTrigger>
                  <SelectContent><SelectItem v-for="field in headers" :key="`x-${field}`" :value="field">{{ field }}</SelectItem></SelectContent>
                </Select>
              </div>
              <div class="form-field">
                <Label for="y-field">Y / 纬度字段</Label>
                <Select v-model="sourceYField">
                  <SelectTrigger id="y-field"><SelectValue placeholder="选择 Y 字段" /></SelectTrigger>
                  <SelectContent><SelectItem v-for="field in headers" :key="`y-${field}`" :value="field">{{ field }}</SelectItem></SelectContent>
                </Select>
              </div>
              <div class="form-field">
                <Label for="out-x-field">输出 X 字段</Label>
                <Input id="out-x-field" v-model="outputXField" placeholder="例如 longitude_out" />
              </div>
              <div class="form-field">
                <Label for="out-y-field">输出 Y 字段</Label>
                <Input id="out-y-field" v-model="outputYField" placeholder="例如 latitude_out" />
              </div>
              <div class="field-note field-note-wide">输出字段已存在时会覆盖该列；否则会新增两列，其他字段保持不变。</div>
            </div>

            <div class="crs-pair">
              <CoordinateSystemPicker v-model="inputCrs" v-model:custom-definition="customInputCrs" label="源坐标系" id="input-crs" />
              <Button type="button" variant="outline" class="direction-icon" aria-label="交换源坐标系和目标坐标系" @click="swapCoordinateSystems"><ArrowLeftRight :size="15" /><span>交换方向</span></Button>
              <CoordinateSystemPicker v-model="outputCrs" v-model:custom-definition="customOutputCrs" label="目标坐标系" id="output-crs" />
            </div>

            <div class="supported-crs">地理坐标系及 Web Mercator、UTM、高斯-克吕格 3°/6°带；可输入 EPSG 或自定义 PROJ 字符串。</div>

            <Button class="convert-button" @click="convert"><RefreshCw :size="15" />开始转换</Button>
          </CardContent>
        </Card>

        <Card class="panel output-panel">
          <CardHeader class="panel-header">
            <div class="panel-step">03</div>
            <div class="panel-heading-copy">
              <CardTitle>转换结果</CardTitle>
              <CardDescription>{{ sourceMode === 'text' ? '查看并复制输出文本' : '预览并下载转换文件' }}</CardDescription>
            </div>
            <Button v-if="sourceMode !== 'text' && outputBlob" variant="outline" size="sm" @click="downloadResult"><ArrowDownToLine :size="14" />下载</Button>
          </CardHeader>
          <CardContent class="output-content">
            <template v-if="sourceMode === 'text'">
              <div v-if="outputText" class="result-badge"><Badge variant="secondary"><Check :size="13" /> 转换完成</Badge></div>
              <Textarea :model-value="outputText" readonly class="coordinate-textarea result-textarea" placeholder="转换后的坐标会显示在这里" />
              <Button v-if="outputText" variant="outline" size="sm" class="copy-button" @click="copyOutput">复制文本</Button>
            </template>
            <template v-else-if="fileFormat === 'geojson' && geoJsonValue">
              <div class="geo-summary">
                <Badge variant="outline"><FileJson2 :size="13" /> {{ convertedGeoJson?.type ?? geoJsonValue.type }}</Badge>
                <span>{{ geoFeatureCount(convertedGeoJson ?? geoJsonValue) }} 个要素</span>
              </div>
              <Textarea :model-value="convertedGeoJson ? JSON.stringify(convertedGeoJson, null, 2) : JSON.stringify(geoJsonValue, null, 2)" readonly class="geojson-preview" />
            </template>
            <template v-else-if="isTabular && fileMatrix.length">
              <div class="table-summary"><Badge variant="secondary">{{ Math.max(0, previewMatrix.length - 1) }} 行数据</Badge><span>展示前 5 行预览</span></div>
              <div class="table-scroll">
                <Table>
                  <TableHeader><TableRow><TableHead v-for="field in previewMatrix[0]?.slice(0, 6)" :key="String(field)">{{ field }}</TableHead></TableRow></TableHeader>
                  <TableBody>
                    <TableRow v-for="(row, rowIndex) in previewMatrix.slice(1, 6)" :key="`row-${rowIndex}`">
                      <TableCell v-for="(value, cellIndex) in row.slice(0, 6)" :key="`cell-${rowIndex}-${cellIndex}`">{{ value }}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </template>
            <div v-else class="empty-result"><ScanLine :size="24" /><span>选择输入并开始转换，结果会显示在这里</span></div>

            <div v-if="errorMessage" class="feedback error-feedback" role="alert">{{ errorMessage }}</div>
            <div v-else-if="successMessage" class="feedback success-feedback" role="status">{{ successMessage }}</div>
          </CardContent>
        </Card>
      </div>

      <Card class="crs-note">
        <CardContent class="crs-note-content">
          <div><Badge variant="outline">坐标系说明</Badge></div>
          <p>GCJ-02 与 BD-09 使用 coordtransform 转换；其他坐标系由 proj4 处理。可输入 EPSG 编号（内置含 WGS 84 UTM、NAD83 UTM、ETRS89 UTM 等）或自定义 PROJ 字符串。部分基准转换受本地网格数据精度限制。</p>
        </CardContent>
      </Card>
    </section>
      <ExcelBatchCoordinate v-else />
    </div>
  </main>
</template>

<style scoped>
.coordinate-page {
  min-height: 100vh;
  padding: 1px 24px 44px;
  color: var(--foreground);
  background: #f5f6f3;
}
.coordinate-navigation { position: fixed; top: 22px; left: 24px; z-index: 50; }
.processing-shell { width: min(1440px, 100%); margin: 104px auto 0; }
.processing-tabs { display:flex; width:max-content; max-width:100%; align-items:center; gap:2px; margin-bottom:13px; padding:3px; border:1px solid #e2e5e0; border-radius:10px; background:rgba(255,255,255,.92); }
.processing-tab { min-height:32px; padding:0 14px; border:0; border-radius:7px; background:transparent; color:#68716a; font-size:11px; cursor:pointer; }
.processing-tab.active { background:#287bf5; color:white; font-weight:700; }
.workspace { width: 100%; margin: 0 auto; }
.workspace-grid { display: grid; grid-template-columns: minmax(290px, .96fr) minmax(270px, .82fr) minmax(340px, 1.15fr); gap: 14px; align-items: stretch; }
.panel { min-width: 0; border-color: #e2e5e0; border-radius: 16px; background: rgba(255,255,255,.9); box-shadow: 0 8px 28px #1e2c2007; }
.panel-header { display: flex; min-height: 76px; flex-direction: row; align-items: center; gap: 11px; padding: 16px 17px 12px; }
.panel-step { display: grid; width: 28px; height: 28px; flex: 0 0 auto; place-items: center; border-radius: 9px; background: #f0f2ee; color: #434a44; font-size: 11px; font-weight: 800; }
.panel-heading-copy { min-width: 0; flex: 1; }
.panel-header :deep([data-slot="card-title"]) { font-size: 14px; letter-spacing: -.01em; }
.panel-header :deep([data-slot="card-description"]) { margin-top: 3px; font-size: 11px; }
.input-content, .settings-content, .output-content { display: flex; flex-direction: column; gap: 12px; padding: 0 17px 17px; }
.input-content :deep(label), .settings-content :deep(label) { color: #626b65; font-size: 11px; font-weight: 600; }
.coordinate-textarea { min-height: 214px; resize: vertical; border-color: #e4e6e2; background: #fcfcfb; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; line-height: 1.7; }
.field-note { color: #939a94; font-size: 10px; line-height: 1.5; }
.file-input { height: auto; min-height: 40px; padding: 6px; color: #727a74; font-size: 11px; }
.file-input::file-selector-button { margin-right: 9px; padding: 5px 8px; border: 1px solid #e1e4df; border-radius: 6px; background: white; color: #434a44; cursor: pointer; }
.file-meta { display: flex; min-height: 67px; align-items: center; gap: 10px; padding: 12px; border: 1px dashed #d8ddd7; border-radius: 11px; background: #fafbf9; color: #777f79; font-size: 11px; line-height: 1.5; overflow-wrap: anywhere; }
.file-meta svg { flex: 0 0 auto; color: #525a54; }
.file-actions { display: flex; align-items: center; justify-content: space-between; }
.file-actions :deep([data-slot="badge"]) { font-size: 10px; }
.file-actions :deep(button) { height: 28px; font-size: 11px; }
.worksheet-row { display: grid; grid-template-columns: 72px 1fr; align-items: center; gap: 10px; }
.worksheet-select { width: 100%; }
.mode-switch { display: flex; flex: 0 0 auto; gap: 1px; padding: 3px; border: 1px solid #e8eae7; border-radius: 9px; background: #f7f8f6; }
.mode-switch :deep(button) { height: 27px; padding-inline: 7px; font-size: 10px; }
.mode-switch :deep(button[data-variant="ghost"]) { color: #707771; }
.field-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding-bottom: 11px; border-bottom: 1px solid #eceeeb; }
.form-field { display: flex; min-width: 0; flex-direction: column; gap: 6px; }
.form-field :deep([data-slot="select-trigger"]) { width: 100%; height: 34px; padding-inline: 9px; font-size: 11px; }
.form-field :deep(input) { height: 34px; font-size: 11px; }
.field-note-wide { grid-column: 1 / -1; }
.crs-pair { display:grid; grid-template-columns:minmax(0,1fr); gap:10px; }
.direction-icon { display:flex; width:max-content; min-height:31px; align-items:center; justify-self:center; gap:6px; padding:0 10px; border-color:#e2e6e1; background:#fafbf9; color:#69736b; font-size:10px; }
.crs-pair :deep(.crs-trigger) { height:43px; }
.supported-crs { color: #909791; font-size: 10px; line-height: 1.45; }
.convert-button { width: 100%; height: 36px; margin-top: 1px; font-size: 12px; }
.output-panel { display: flex; flex-direction: column; }
.output-content { flex: 1; min-height: 0; }
.result-badge { min-height: 27px; }
.result-badge :deep([data-slot="badge"]) { font-size: 10px; }
.result-textarea { min-height: 195px; color: #303732; }
.copy-button { align-self: flex-end; height: 30px; font-size: 11px; }
.geo-summary, .table-summary { display: flex; align-items: center; gap: 9px; color: #858d87; font-size: 10px; }
.geo-summary :deep([data-slot="badge"]) { font-size: 10px; }
.geojson-preview { min-height: 250px; max-height: 370px; resize: vertical; background: #fcfcfb; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 10px; line-height: 1.6; }
.table-scroll { overflow: auto; max-height: 310px; border: 1px solid #e7e9e6; border-radius: 9px; }
.table-scroll :deep(table) { min-width: 460px; font-size: 10px; }
.table-scroll :deep(th) { height: 32px; background: #f7f8f6; font-weight: 700; }
.table-scroll :deep(td) { height: 32px; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.empty-result { display: flex; min-height: 250px; flex: 1; flex-direction: column; align-items: center; justify-content: center; gap: 10px; border: 1px dashed #e2e5e0; border-radius: 12px; color: #a0a7a1; font-size: 11px; text-align: center; }
.feedback { padding: 9px 10px; border-radius: 8px; font-size: 10px; line-height: 1.5; }
.error-feedback { border: 1px solid #f2d1d1; background: #fff5f5; color: #9e3636; }
.success-feedback { border: 1px solid #e2e5e0; background: #f7f8f6; color: #68716a; }
.crs-note { margin-top: 14px; border-color: #e6e8e4; border-radius: 13px; background: #fbfcfa; box-shadow: none; }
.crs-note-content { display: flex; align-items: center; gap: 12px; padding: 12px 15px; }
.crs-note-content :deep([data-slot="badge"]) { white-space: nowrap; font-size: 10px; }
.crs-note-content p { margin: 0; color: #838b85; font-size: 10px; line-height: 1.55; }
@media (max-width: 1020px) { .workspace-grid { grid-template-columns: minmax(0, 1fr) minmax(260px, .8fr); } .output-panel { grid-column: 1 / -1; } .output-panel .output-content { min-height: 235px; } }
@media (max-width: 680px) { .coordinate-page { padding-inline: 13px; } .coordinate-navigation { top: 14px; left: 13px; } .processing-shell { margin-top: 91px; } .workspace-grid { grid-template-columns: 1fr; gap: 11px; } .output-panel { grid-column: auto; } .crs-note-content { align-items: flex-start; flex-direction: column; gap: 7px; } .input-content, .settings-content, .output-content { padding-inline: 14px; } .panel-header { padding-inline: 14px; } }
</style>
