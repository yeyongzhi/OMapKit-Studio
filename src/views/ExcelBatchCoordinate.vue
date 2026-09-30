<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import * as XLSX from 'xlsx'
import { ArrowLeftRight, ArrowRight, ArrowUpFromLine, FileSpreadsheet, Plus, RefreshCw, X } from '@lucide/vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import CoordinateSystemPicker from '@/features/coordinate/CoordinateSystemPicker.vue'
import { transformCoordinate } from '@/features/coordinate/projection'

type Matrix = unknown[][]
type Crs = string

interface FieldGroup {
  id: number
  sourceX: string
  sourceY: string
  targetX: string
  targetY: string
}

const file = shallowRef<File | null>(null)
const fileBuffer = shallowRef<ArrayBuffer | null>(null)
const workbook = shallowRef<XLSX.WorkBook | null>(null)
const sheetNames = ref<string[]>([])
const worksheet = ref('')
const sourceMatrix = shallowRef<Matrix>([])
const convertedMatrix = shallowRef<Matrix>([])
const groups = ref<FieldGroup[]>([])
const inputCrs = ref<Crs>('EPSG:4326')
const outputCrs = ref<Crs>('GCJ-02')
const customInputCrs = ref('')
const customOutputCrs = ref('')
const errorMessage = ref('')
const successMessage = ref('')
const processing = ref(false)
const dragging = ref(false)
const page = ref(1)
const pageSize = 50
const outputFilename = ref('')
let nextGroupId = 1

const fieldOptions = computed(() => (sourceMatrix.value[0] ?? []).map((value, index) => ({
  value: String(index),
  label: String(value ?? '').trim() || '字段 ' + (index + 1),
})))
const previewMatrix = computed(() => convertedMatrix.value.length ? convertedMatrix.value : sourceMatrix.value)
const previewRows = computed(() => previewMatrix.value.slice(1))
const totalPages = computed(() => Math.max(1, Math.ceil(previewRows.value.length / pageSize)))
const pageRows = computed(() => previewRows.value.slice((page.value - 1) * pageSize, page.value * pageSize))
const pageStartIndex = computed(() => (page.value - 1) * pageSize)
const convertedPairs = ref(0)
const skippedPairs = ref(0)
const hasFile = computed(() => Boolean(file.value && sourceMatrix.value.length > 1))
const canConvert = computed(() => hasFile.value && groups.value.length > 0 && !processing.value && !validationMessage.value)
const validationMessage = computed(() => {
  if (!hasFile.value) return '请先上传 Excel 文件。'
  if (!groups.value.length) return '请至少添加一个字段组。'
  const targets = new Set<string>()
  for (const [index, group] of groups.value.entries()) {
    if (!group.sourceX || !group.sourceY) return '字段组 ' + (index + 1) + ' 请选择经度和纬度源字段。'
    if (group.sourceX === group.sourceY) return '字段组 ' + (index + 1) + ' 的经度、纬度源字段不能相同。'
    const targetX = group.targetX.trim()
    const targetY = group.targetY.trim()
    if (!targetX || !targetY) return '字段组 ' + (index + 1) + ' 请填写经度和纬度目标字段名。'
    if (targetX.toLocaleLowerCase() === targetY.toLocaleLowerCase()) return '字段组 ' + (index + 1) + ' 的两个目标字段名不能相同。'
    for (const name of [targetX, targetY]) {
      const key = name.toLocaleLowerCase()
      if (targets.has(key)) return '多个字段组使用了相同的目标字段名，请分别设置输出字段。'
      targets.add(key)
    }
  }
  return ''
})
const conversionSummary = computed(() => convertedMatrix.value.length
  ? '已转换 ' + convertedPairs.value + ' 组坐标，跳过 ' + skippedPairs.value + ' 组无效或空坐标。'
  : '预览每页显示 50 行；转换后会在原字段后追加目标坐标字段。')

watch([inputCrs, outputCrs, customInputCrs, customOutputCrs], () => {
  if (convertedMatrix.value.length) resetOutput()
})

function sourceFieldGuess(kind: 'x' | 'y') {
  const values = fieldOptions.value
  const pattern = kind === 'x'
    ? /^(x|lon|lng|longitude|经度|x84|xgcj02|xbd09)$/i
    : /^(y|lat|latitude|纬度|y84|ygcj02|ybd09)$/i
  const match = values.find((field) => pattern.test(field.label.replace(/[\s_-]+/g, '')))
  return match?.value ?? values[kind === 'x' ? 0 : 1]?.value ?? values[0]?.value ?? ''
}

function createGroup(index: number): FieldGroup {
  const suffix = outputCrs.value === 'GCJ-02' ? 'gcj02'
    : outputCrs.value === 'BD-09' ? 'bd09'
      : outputCrs.value === 'EPSG:4326' ? 'wgs84'
        : outputCrs.value === 'EPSG:4490' ? 'cgcs2000'
          : outputCrs.value.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'converted'
  const tail = index > 1 ? '_' + index : ''
  return {
    id: nextGroupId++,
    sourceX: sourceFieldGuess('x'),
    sourceY: sourceFieldGuess('y'),
    targetX: 'x_' + suffix + tail,
    targetY: 'y_' + suffix + tail,
  }
}

function resetOutput() {
  convertedMatrix.value = []
  convertedPairs.value = 0
  skippedPairs.value = 0
  outputFilename.value = ''
  successMessage.value = ''
}

function loadWorksheet(name: string) {
  if (!workbook.value || !name) return
  const sheet = workbook.value.Sheets[name]
  if (!sheet) {
    errorMessage.value = '无法读取所选工作表。'
    return
  }
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: '', blankrows: false })
  if (rows.length < 2) {
    sourceMatrix.value = []
    groups.value = []
    resetOutput()
    errorMessage.value = '所选工作表需要包含表头和至少一行坐标数据。'
    return
  }
  sourceMatrix.value = rows
  worksheet.value = name
  groups.value = [createGroup(1)]
  page.value = 1
  resetOutput()
  errorMessage.value = ''
  successMessage.value = '已读取工作表「' + name + '」，共 ' + (rows.length - 1) + ' 行数据、' + fieldOptions.value.length + ' 个字段。'
}

async function loadFile(selected: File) {
  errorMessage.value = ''
  successMessage.value = ''
  resetOutput()
  file.value = null
  fileBuffer.value = null
  workbook.value = null
  sheetNames.value = []
  worksheet.value = ''
  sourceMatrix.value = []
  groups.value = []
  if (selected.size > 50 * 1024 * 1024) {
    errorMessage.value = 'Excel 文件暂时不能超过 50 MB。'
    return
  }
  const extension = selected.name.split('.').pop()?.toLowerCase()
  if (extension !== 'xlsx' && extension !== 'xls') {
    errorMessage.value = '请选择 .xlsx 或 .xls Excel 文件。'
    return
  }

  processing.value = true
  try {
    const buffer = await selected.arrayBuffer()
    const parsed = XLSX.read(buffer, { type: 'array', cellDates: true })
    if (!parsed.SheetNames.length) throw new Error('Excel 文件中没有可读取的工作表。')
    file.value = selected
    fileBuffer.value = buffer
    workbook.value = parsed
    sheetNames.value = [...parsed.SheetNames]
    worksheet.value = parsed.SheetNames[0]
    loadWorksheet(worksheet.value)
  } catch (caught) {
    file.value = null
    fileBuffer.value = null
    workbook.value = null
    sheetNames.value = []
    worksheet.value = ''
    sourceMatrix.value = []
    errorMessage.value = caught instanceof Error ? caught.message : 'Excel 文件读取失败，请确认文件未损坏。'
    successMessage.value = ''
  } finally {
    processing.value = false
  }
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const selected = input.files?.[0]
  if (selected) void loadFile(selected)
  input.value = ''
}

function onDrop(event: DragEvent) {
  dragging.value = false
  const selected = event.dataTransfer?.files[0]
  if (selected) void loadFile(selected)
}

function addFieldGroup() {
  if (!hasFile.value) return
  groups.value.push(createGroup(groups.value.length + 1))
  resetOutput()
  errorMessage.value = ''
}

function removeFieldGroup(id: number) {
  groups.value = groups.value.filter((group) => group.id !== id)
  resetOutput()
  errorMessage.value = ''
}

function parseCoordinate(value: unknown) {
  if (value === null || value === undefined || typeof value === 'boolean') return null
  const text = String(value).trim()
  if (!text) return null
  const coordinate = Number(text.replace(/,/g, ''))
  return Number.isFinite(coordinate) ? coordinate : null
}

function formatNumber(value: number) {
  return Number(value.toFixed(8)).toString()
}

function convertWorkbook() {
  errorMessage.value = ''
  successMessage.value = ''
  resetOutput()
  if (!hasFile.value || !fileBuffer.value) {
    errorMessage.value = '请先上传 Excel 文件。'
    return
  }
  if (validationMessage.value) {
    errorMessage.value = validationMessage.value
    return
  }

  processing.value = true
  try {
    const resultRows = sourceMatrix.value.map((row) => [...row])
    const headerRow = resultRows[0]
    const outputColumns = groups.value.map((group) => {
      const xName = group.targetX.trim()
      const yName = group.targetY.trim()
      const findOrAdd = (name: string) => {
        const existing = headerRow.findIndex((value) => String(value ?? '').trim().toLocaleLowerCase() === name.toLocaleLowerCase())
        if (existing >= 0) return existing
        const index = headerRow.length
        headerRow.push(name)
        for (let rowIndex = 1; rowIndex < resultRows.length; rowIndex += 1) resultRows[rowIndex][index] = ''
        return index
      }
      return {
        sourceX: Number(group.sourceX),
        sourceY: Number(group.sourceY),
        targetX: findOrAdd(xName),
        targetY: findOrAdd(yName),
      }
    })

    let validPairCount = 0
    let skippedPairCount = 0
    for (let rowIndex = 1; rowIndex < sourceMatrix.value.length; rowIndex += 1) {
      const sourceRow = sourceMatrix.value[rowIndex]
      const outputRow = resultRows[rowIndex]
      while (outputRow.length < headerRow.length) outputRow.push('')
      for (const columns of outputColumns) {
        outputRow[columns.targetX] = ''
        outputRow[columns.targetY] = ''
        const x = parseCoordinate(sourceRow[columns.sourceX])
        const y = parseCoordinate(sourceRow[columns.sourceY])
        if (x === null || y === null) {
          skippedPairCount += 1
          continue
        }
        const [targetX, targetY] = transformCoordinate(
          x,
          y,
          inputCrs.value,
          outputCrs.value,
          customInputCrs.value,
          customOutputCrs.value,
        )
        if (!Number.isFinite(targetX) || !Number.isFinite(targetY)) {
          skippedPairCount += 1
          continue
        }
        outputRow[columns.targetX] = formatNumber(targetX)
        outputRow[columns.targetY] = formatNumber(targetY)
        validPairCount += 1
      }
    }

    const outputWorkbook = XLSX.read(fileBuffer.value, { type: 'array', cellDates: true })
    outputWorkbook.Sheets[worksheet.value] = XLSX.utils.aoa_to_sheet(resultRows)
    const outputData = XLSX.write(outputWorkbook, { bookType: 'xlsx', type: 'array' })
    const baseName = file.value?.name.replace(/\.(xlsx|xls)$/i, '') || 'coordinates'
    outputFilename.value = baseName + '-converted.xlsx'
    const blob = new Blob([outputData], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = outputFilename.value
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)

    convertedMatrix.value = resultRows
    convertedPairs.value = validPairCount
    skippedPairs.value = skippedPairCount
    successMessage.value = '批量转换完成，已下载 ' + outputFilename.value + '。有效坐标组 ' + validPairCount + '，跳过无效或空坐标组 ' + skippedPairCount + '。'
    page.value = 1
  } catch (caught) {
    errorMessage.value = caught instanceof Error ? caught.message : '批量转换失败，请检查坐标系和字段设置。'
  } finally {
    processing.value = false
  }
}

function clearFile() {
  file.value = null
  fileBuffer.value = null
  workbook.value = null
  sheetNames.value = []
  worksheet.value = ''
  sourceMatrix.value = []
  groups.value = []
  page.value = 1
  resetOutput()
  errorMessage.value = ''
  successMessage.value = ''
}

function updateGroup(group: FieldGroup, key: keyof FieldGroup, event: Event) {
  const target = event.target as HTMLInputElement | HTMLSelectElement
  group[key] = target.value as never
  resetOutput()
}
</script>

<template>
  <div class="batch-coordinate">
    <Card class="batch-card">
      <CardContent class="batch-card-content">
        <Input
          id="coordinate-batch-file"
          type="file"
          accept=".xlsx,.xls"
          class="sr-only"
          @change="onFileChange"
        />
        <template v-if="file">
          <div class="file-summary">
            <div class="file-summary-copy">
              <FileSpreadsheet :size="16" />
              <span>{{ file.name }}</span>
              <Badge variant="outline">Excel</Badge>
            </div>
            <div class="file-summary-actions">
              <Label for="coordinate-batch-file" class="upload-again">重新上传</Label>
              <Button type="button" variant="ghost" size="sm" @click="clearFile">移除</Button>
            </div>
          </div>
        </template>
        <Label
          v-else
          for="coordinate-batch-file"
          class="file-drop"
          :class="{ 'is-dragging': dragging }"
          @dragover.prevent="dragging = true"
          @dragleave.prevent="dragging = false"
          @drop.prevent="onDrop"
        >
          <ArrowUpFromLine :size="23" />
          <span>{{ processing ? '正在读取工作簿…' : '选择 Excel 文件或将文件拖拽到此处' }}</span>
          <small>支持 .xlsx / .xls 格式，最大 50 MB</small>
        </Label>

        <div v-if="sheetNames.length" class="sheet-section">
          <div class="section-label">选择工作表</div>
          <div class="sheet-list">
            <Button
              v-for="sheet in sheetNames"
              :key="sheet"
              type="button"
              size="sm"
              :variant="worksheet === sheet ? 'default' : 'outline'"
              @click="loadWorksheet(sheet)"
            >{{ sheet }}</Button>
          </div>
        </div>
      </CardContent>

      <div class="batch-divider" />

      <CardContent class="batch-card-content settings-section">
        <div class="section-label">转换配置</div>
        <div class="crs-grid">
          <CoordinateSystemPicker
            v-model="inputCrs"
            v-model:custom-definition="customInputCrs"
            label="源坐标系"
          />
          <div class="swap-column">
            <ArrowLeftRight :size="16" />
            <ArrowRight :size="14" />
          </div>
          <CoordinateSystemPicker
            v-model="outputCrs"
            v-model:custom-definition="customOutputCrs"
            label="目标坐标系"
          />
        </div>

        <div class="group-list">
          <Card v-for="(group, groupIndex) in groups" :key="group.id" class="field-group-card">
            <CardHeader class="field-group-header">
              <CardTitle>字段组 {{ groupIndex + 1 }}</CardTitle>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                :aria-label="'删除字段组 ' + (groupIndex + 1)"
                @click="removeFieldGroup(group.id)"
              ><X /></Button>
            </CardHeader>
            <CardContent class="field-group-content">
              <div class="field-group-grid">
                <div class="form-field">
                  <Label :for="'batch-source-x-' + group.id">经度源字段</Label>
                  <select
                    :id="'batch-source-x-' + group.id"
                    :value="group.sourceX"
                    :disabled="!hasFile"
                    @change="updateGroup(group, 'sourceX', $event)"
                  >
                    <option value="">— 请选择 —</option>
                    <option v-for="field in fieldOptions" :key="'x-' + field.value" :value="field.value">{{ field.label }}</option>
                  </select>
                </div>
                <ArrowRight class="mapping-arrow" :size="15" />
                <div class="form-field">
                  <Label :for="'batch-target-x-' + group.id">经度目标字段名</Label>
                  <Input
                    :id="'batch-target-x-' + group.id"
                    :model-value="group.targetX"
                    :disabled="!hasFile"
                    placeholder="例如 x_gcj02"
                    @update:model-value="group.targetX = String($event); resetOutput()"
                  />
                </div>
                <div class="form-field">
                  <Label :for="'batch-source-y-' + group.id">纬度源字段</Label>
                  <select
                    :id="'batch-source-y-' + group.id"
                    :value="group.sourceY"
                    :disabled="!hasFile"
                    @change="updateGroup(group, 'sourceY', $event)"
                  >
                    <option value="">— 请选择 —</option>
                    <option v-for="field in fieldOptions" :key="'y-' + field.value" :value="field.value">{{ field.label }}</option>
                  </select>
                </div>
                <ArrowRight class="mapping-arrow" :size="15" />
                <div class="form-field">
                  <Label :for="'batch-target-y-' + group.id">纬度目标字段名</Label>
                  <Input
                    :id="'batch-target-y-' + group.id"
                    :model-value="group.targetY"
                    :disabled="!hasFile"
                    placeholder="例如 y_gcj02"
                    @update:model-value="group.targetY = String($event); resetOutput()"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Button type="button" variant="outline" class="add-group-button" :disabled="!hasFile" @click="addFieldGroup">
          <Plus data-icon="inline-start" />
          添加字段组
        </Button>

        <div v-if="errorMessage" class="batch-feedback error-feedback" role="alert">{{ errorMessage }}</div>
        <div v-else-if="validationMessage && hasFile" class="batch-feedback validation-feedback" role="status">{{ validationMessage }}</div>
        <div v-else-if="successMessage" class="batch-feedback success-feedback" role="status">{{ successMessage }}</div>

        <Button type="button" class="batch-convert-button" :disabled="!canConvert" @click="convertWorkbook">
          <RefreshCw data-icon="inline-start" />
          {{ processing ? '正在转换…' : '开始转换并下载 Excel' }}
        </Button>
        <p class="privacy-note">所有数据在本地浏览器处理；已有同名目标字段会被覆盖。</p>
      </CardContent>

      <div class="batch-divider" />

      <CardContent class="batch-card-content preview-section">
        <div class="preview-toolbar">
          <div class="section-label">数据预览</div>
          <div v-if="previewRows.length" class="page-status">
            共 {{ previewRows.length }} 行 · 第 {{ page }} / {{ totalPages }} 页
            <template v-if="convertedMatrix.length"> · {{ conversionSummary }}</template>
          </div>
        </div>
        <div v-if="previewRows.length" class="table-scroll">
          <Table class="preview-table">
            <TableHeader>
              <TableRow>
                <TableHead class="row-number-head">#</TableHead>
                <TableHead v-for="(field, index) in previewMatrix[0]" :key="'head-' + index">{{ String(field || '字段 ' + (index + 1)) }}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="(row, rowIndex) in pageRows" :key="'row-' + (pageStartIndex + rowIndex)">
                <TableCell class="row-number-cell">{{ pageStartIndex + rowIndex + 1 }}</TableCell>
                <TableCell v-for="(value, cellIndex) in row" :key="'cell-' + rowIndex + '-' + cellIndex">
                  {{ String(value ?? '') }}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
        <div v-else class="empty-preview">
          <FileSpreadsheet :size="22" />
          <span>上传 Excel 文件并选择工作表后显示数据预览。</span>
        </div>
        <div v-if="totalPages > 1" class="pagination">
          <Button type="button" variant="outline" size="sm" :disabled="page <= 1" @click="page -= 1">上一页</Button>
          <span>第 {{ page }} / {{ totalPages }} 页</span>
          <Button type="button" variant="outline" size="sm" :disabled="page >= totalPages" @click="page += 1">下一页</Button>
        </div>
      </CardContent>
    </Card>
  </div>
</template>

<style scoped>
.batch-coordinate { width:min(1440px,100%); margin:0 auto; }
.batch-card { gap:0; overflow:hidden; border-color:#e2e7ef; border-radius:15px; background:#fff; box-shadow:0 7px 28px rgb(30 48 80 / 6%); }
.batch-card-content { padding:20px 24px; }
.file-summary { display:flex; min-height:44px; align-items:center; justify-content:space-between; gap:12px; padding:7px 12px; border:1px solid #dfe7f2; border-radius:7px; background:#f5f8fd; }
.file-summary-copy,.file-summary-actions { display:flex; min-width:0; align-items:center; gap:9px; }
.file-summary-copy { color:#415571; font-size:11px; }
.file-summary-copy > span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.file-summary-copy > svg { flex:none; color:#4380dc; }
.file-summary-copy :deep([data-slot="badge"]) { font-size:9px; }
.file-summary-actions :deep(button) { height:29px; font-size:10px; }
.upload-again { display:inline-flex; height:29px; align-items:center; padding:0 10px; border:1px solid #dbe2eb; border-radius:7px; background:white; color:#586a82; font-size:10px; cursor:pointer; }
.upload-again:hover { background:#f5f8fd; }
.file-drop { display:flex; min-height:125px; flex-direction:column; align-items:center; justify-content:center; gap:8px; border:1px dashed #bdcde6; border-radius:10px; background:#f7faff; color:#59708e; font-size:12px; cursor:pointer; }
.file-drop.is-dragging { border-color:#287bf5; background:#edf5ff; }
.file-drop svg { color:#3179e5; }
.file-drop small { color:#93a0b2; font-size:10px; }
.sheet-section { display:flex; flex-direction:column; gap:11px; margin-top:17px; padding-bottom:17px; border-bottom:1px solid #e8edf4; }
.section-label { color:#45566e; font-size:11px; font-weight:750; }
.sheet-list { display:flex; flex-wrap:wrap; gap:8px; }
.sheet-list :deep(button) { height:28px; padding:0 12px; font-size:10px; }
.batch-divider { height:1px; margin:0 24px; background:#e8edf4; }
.settings-section { display:flex; flex-direction:column; gap:15px; }
.crs-grid { display:grid; grid-template-columns:minmax(0,1fr) 34px minmax(0,1fr); align-items:end; gap:10px; }
.crs-grid :deep(.crs-trigger) { height:42px; }
.swap-column { display:flex; align-items:center; justify-content:center; gap:4px; padding-bottom:11px; color:#3476de; }
.group-list { display:flex; flex-direction:column; gap:10px; }
.field-group-card { gap:0; padding:0; border-color:#dce5f1; border-radius:9px; box-shadow:none; }
.field-group-header { display:flex; min-height:41px; flex-direction:row; align-items:center; justify-content:space-between; padding:6px 12px; border-bottom:1px solid #e5ebf3; background:#f5f8fd; }
.field-group-header :deep([data-slot="card-title"]) { color:#52657e; font-size:11px; font-weight:700; }
.field-group-header :deep(button) { width:24px; height:24px; padding:0; color:#93a0b2; }
.field-group-content { padding:12px; }
.field-group-grid { display:grid; grid-template-columns:minmax(0,1fr) 24px minmax(0,1fr); align-items:end; gap:10px 8px; }
.form-field { display:flex; min-width:0; flex-direction:column; gap:6px; }
.form-field :deep(label) { color:#738197; font-size:10px; }
.form-field select,.form-field :deep(input) { width:100%; height:35px; padding-inline:10px; border:1px solid #dce4ef; border-radius:7px; background:#fff; color:#44546b; font-size:11px; outline:none; }
.form-field select:focus,.form-field :deep(input:focus) { border-color:#4a86e8; box-shadow:0 0 0 3px rgb(40 123 245 / 10%); }
.form-field select:disabled,.form-field :deep(input:disabled) { background:#f7f8fa; color:#9ba5b2; }
.mapping-arrow { align-self:center; justify-self:center; margin-top:18px; color:#3179e5; }
.add-group-button { min-height:34px; border-style:dashed; border-color:#cbd9ed; color:#3e6ba9; font-size:10px; }
.batch-convert-button { width:max-content; min-width:130px; height:38px; font-size:11px; }
.privacy-note { margin:0; color:#929dad; font-size:10px; }
.batch-feedback { padding:9px 11px; border:1px solid; border-radius:7px; font-size:10px; line-height:1.5; }
.error-feedback { border-color:#f2d1d1; background:#fff5f5; color:#9e3636; }
.validation-feedback { border-color:#f4e5c5; background:#fffbf2; color:#98703a; }
.success-feedback { border-color:#d9eadc; background:#f3faf4; color:#387248; }
.preview-section { padding-top:18px; }
.preview-toolbar { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:9px; }
.page-status { color:#7c8a9e; font-size:10px; }
.table-scroll { max-height:480px; overflow:auto; border:1px solid #e0e6ee; border-radius:8px; }
.preview-table { width:max-content; min-width:100%; }
.preview-table :deep(th) { height:33px; background:#f6f8fb; color:#617187; font-size:10px; font-weight:700; white-space:nowrap; }
.preview-table :deep(td) { max-width:220px; overflow:hidden; color:#43536a; font-size:10px; text-overflow:ellipsis; white-space:nowrap; }
.preview-table :deep(tr) { border-color:#ebeff4; }
.preview-table :deep(.row-number-head),.preview-table :deep(.row-number-cell) { width:40px; min-width:40px; color:#93a0b2; text-align:center; }
.empty-preview { display:flex; min-height:170px; flex-direction:column; align-items:center; justify-content:center; gap:9px; border:1px dashed #e1e6ed; border-radius:9px; color:#96a2b2; font-size:11px; }
.empty-preview svg { color:#92a7c7; }
.pagination { display:flex; align-items:center; justify-content:center; gap:12px; margin-top:11px; color:#758399; font-size:10px; }
.pagination :deep(button) { height:28px; font-size:10px; }
@media (max-width:700px) {
  .batch-card-content { padding:15px; }
  .batch-divider { margin:0 15px; }
  .crs-grid { grid-template-columns:1fr; gap:10px; }
  .swap-column { display:none; }
  .field-group-grid { grid-template-columns:minmax(0,1fr) 20px minmax(0,1fr); gap:10px 5px; }
  .preview-toolbar { align-items:flex-start; flex-direction:column; gap:5px; }
}
@media (max-width:480px) {
  .field-group-grid { grid-template-columns:1fr; }
  .mapping-arrow { display:none; }
  .batch-convert-button { width:100%; }
}
</style>
