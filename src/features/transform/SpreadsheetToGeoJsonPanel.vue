<script setup lang="ts">
import { computed } from 'vue'
import { Download, FolderOpen, MapPinned, Plus } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useSpreadsheetGeoJson } from './useSpreadsheetGeoJson'

const emit = defineEmits<{
  loadToMap: [payload: { fileName: string; content: string }]
}>()

const {
  fileName, fileKind, sheetNames, selectedSheet, csvEncoding, detectedEncoding, outputBom,
  headers, geometryKind, fieldCase, selectedProperties, filterRuleData,
  longitudeField, latitudeField, startLongitudeField, startLatitudeField, endLongitudeField, endLatitudeField,
  totalRows, filteredCount, validCount, skippedCount, previewJson, previewMessage, outputName,
  canExport, propertyKeyCollisions, reading, error, notice,
  loadSheet, readFile, setGeometryKind, addFilter, removeFilter, setFilterField, toggleFilterValue,
  selectAllProperties, selectNoProperties, invertProperties, downloadGeoJson, makeGeoJsonText,
} = useSpreadsheetGeoJson()

const hasFile = computed(() => Boolean(fileName.value && headers.value.length))

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) void readFile(file)
  input.value = ''
}

function onDrop(event: DragEvent) {
  const file = event.dataTransfer?.files?.[0]
  if (file) void readFile(file)
}

function onSheetChange(event: Event) {
  loadSheet((event.target as HTMLSelectElement).value)
}

function onFilterFieldChange(id: number, event: Event) {
  setFilterField(id, (event.target as HTMLSelectElement).value)
}

function loadResultToMap() {
  try {
    emit('loadToMap', { fileName: outputName.value, content: makeGeoJsonText() })
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : '无法载入地图，请检查导出设置。'
  }
}
</script>

<template>
  <div class="table-converter">
    <Card class="conversion-card">
      <CardHeader class="step-header">
        <span class="step-number">1</span>
        <div class="step-title">
          <CardTitle>上传 Excel 文件</CardTitle>
          <CardDescription>导入表格，按字段生成 GeoJSON</CardDescription>
        </div>
      </CardHeader>
      <CardContent class="step-content">
        <Input
          id="spreadsheet-file"
          type="file"
          accept=".xlsx,.xls,.csv"
          class="sr-only"
          @change="onFileChange"
        />
        <Label
          for="spreadsheet-file"
          class="drop-zone"
          :class="{ dragging: false, 'is-reading': reading }"
          @dragover.prevent
          @drop.prevent="onDrop"
        >
          <span class="drop-icon"><FolderOpen :size="34" /></span>
          <strong>{{ reading ? '正在读取表格…' : fileName || '点击选择文件，或将文件拖拽到此处' }}</strong>
          <small>支持 .xlsx、.xls、.csv 格式，最大 25 MB</small>
        </Label>

        <div class="encoding-grid">
          <div class="form-field">
            <Label for="csv-encoding">CSV 输入编码</Label>
            <select id="csv-encoding" v-model="csvEncoding" :disabled="fileKind === 'excel' || reading">
              <option value="auto">自动检测（推荐）</option>
              <option value="utf-8">UTF-8</option>
              <option value="gbk">GBK</option>
              <option value="gb18030">GB18030</option>
              <option value="utf-16le">UTF-16 LE</option>
              <option value="utf-16be">UTF-16 BE</option>
            </select>
          </div>
          <div class="form-field">
            <Label for="geojson-encoding">GeoJSON 输出编码</Label>
            <select id="geojson-encoding" v-model="outputBom">
              <option :value="true">UTF-8（带 BOM，兼容性更好）</option>
              <option :value="false">UTF-8（无 BOM）</option>
            </select>
          </div>
        </div>
        <p class="field-hint">编码设置只影响 CSV 读取和 GeoJSON 下载；Excel 文件会按工作簿格式解析。</p>

        <div v-if="sheetNames.length > 1" class="form-field sheet-field">
          <Label for="workbook-sheet">选择工作表</Label>
          <select id="workbook-sheet" v-model="selectedSheet" @change="onSheetChange">
            <option v-for="sheet in sheetNames" :key="sheet" :value="sheet">{{ sheet }}</option>
          </select>
        </div>

        <div v-if="hasFile" class="status-banner">
          <span class="status-dot">✓</span>
          <span>
            已读取「{{ fileName }}」<template v-if="selectedSheet">的「{{ selectedSheet }}」工作表</template>，
            共 {{ totalRows }} 行数据、{{ headers.length }} 个字段
            <template v-if="detectedEncoding"> · CSV {{ detectedEncoding }}</template>
          </span>
        </div>
        <div v-if="error" class="inline-alert error-alert" role="alert">{{ error }}</div>
      </CardContent>
    </Card>

    <Card class="conversion-card">
      <CardHeader class="step-header">
        <span class="step-number">2</span>
        <div class="step-title">
          <CardTitle>选择几何类型</CardTitle>
          <CardDescription>选择表格行要生成的 GeoJSON 几何</CardDescription>
        </div>
      </CardHeader>
      <CardContent class="step-content">
        <div class="geometry-grid">
          <button
            type="button"
            class="geometry-option"
            :class="{ selected: geometryKind === 'Point' }"
            :aria-pressed="geometryKind === 'Point'"
            @click="setGeometryKind('Point')"
          >
            <MapPinned :size="26" />
            <strong>点数据（Point）</strong>
            <span>每行生成一个点，需要经度和纬度字段</span>
          </button>
          <button
            type="button"
            class="geometry-option"
            :class="{ selected: geometryKind === 'LineString' }"
            :aria-pressed="geometryKind === 'LineString'"
            @click="setGeometryKind('LineString')"
          >
            <span class="line-symbol" aria-hidden="true">↗</span>
            <strong>线数据（LineString）</strong>
            <span>每行连接起点与终点，需要 4 个经纬度字段</span>
          </button>
        </div>
        <p class="field-hint">坐标按 WGS 84 经纬度读取，导出的坐标顺序为经度、纬度。</p>
      </CardContent>
    </Card>

    <Card class="conversion-card">
      <CardHeader class="step-header">
        <span class="step-number">3</span>
        <div class="step-title">
          <CardTitle>筛选条件</CardTitle>
          <CardDescription>可选；多个值为 OR，多个条件之间为 AND</CardDescription>
        </div>
      </CardHeader>
      <CardContent class="step-content">
        <div v-if="filterRuleData.length" class="filter-list">
          <article v-for="rule in filterRuleData" :key="rule.id" class="filter-rule">
            <div class="filter-top-row">
              <select
                class="field-select filter-field"
                :value="rule.field"
                :disabled="!hasFile"
                :aria-label="'筛选条件 ' + rule.id + ' 字段'"
                @change="onFilterFieldChange(rule.id, $event)"
              >
                <option value="">选择字段</option>
                <option v-for="field in headers" :key="field" :value="field">{{ field }}</option>
              </select>
              <Button type="button" variant="outline" size="sm" :disabled="!hasFile" @click="removeFilter(rule.id)">删除</Button>
            </div>
            <div class="filter-caption">选择要保留的值（可多选，不选此条件不生效）</div>
            <div v-if="rule.options.length" class="value-options">
              <button
                v-for="value in rule.options"
                :key="value"
                type="button"
                class="value-chip"
                :class="{ selected: rule.values.includes(value) }"
                :aria-pressed="rule.values.includes(value)"
                @click="toggleFilterValue(rule.id, value)"
              >{{ value }}</button>
              <span v-if="rule.truncated" class="value-limit-note">仅显示前 100 个不同值</span>
            </div>
            <p v-else class="empty-hint">{{ rule.field ? '该字段没有非空值。' : '选择字段后可勾选一个或多个值。' }}</p>
            <p class="filter-count">
              {{ rule.values.length ? '已选 ' + rule.values.length + ' 个值，单独命中 ' + rule.matchingRows + ' 行' : '未选择值，此条件暂不生效' }}
            </p>
          </article>
        </div>
        <Button type="button" variant="outline" size="sm" :disabled="!hasFile" @click="addFilter">
          <Plus data-icon="inline-start" />
          添加筛选条件
        </Button>
        <div class="filter-summary">
          <strong>{{ filterRuleData.filter((rule) => rule.field && rule.values.length).length }}</strong> 个生效条件（AND 交集），
          共命中 <strong>{{ filteredCount }}</strong> / {{ totalRows }} 行
        </div>
      </CardContent>
    </Card>

    <Card class="conversion-card">
      <CardHeader class="step-header">
        <span class="step-number">4</span>
        <div class="step-title">
          <CardTitle>选择坐标字段</CardTitle>
          <CardDescription>选择表格中代表经度、纬度的字段</CardDescription>
        </div>
      </CardHeader>
      <CardContent class="step-content">
        <div v-if="geometryKind === 'Point'" class="coordinate-grid">
          <div class="form-field">
            <Label for="point-longitude">经度字段（X / LONGITUDE）</Label>
            <select id="point-longitude" v-model="longitudeField" :disabled="!hasFile">
              <option value="">— 请选择 —</option>
              <option v-for="field in headers" :key="field" :value="field">{{ field }}</option>
            </select>
          </div>
          <div class="form-field">
            <Label for="point-latitude">纬度字段（Y / LATITUDE）</Label>
            <select id="point-latitude" v-model="latitudeField" :disabled="!hasFile">
              <option value="">— 请选择 —</option>
              <option v-for="field in headers" :key="field" :value="field">{{ field }}</option>
            </select>
          </div>
        </div>
        <div v-else class="coordinate-grid line-coordinate-grid">
          <div class="form-field">
            <Label for="start-longitude">起点经度字段（X / LONGITUDE）</Label>
            <select id="start-longitude" v-model="startLongitudeField" :disabled="!hasFile">
              <option value="">— 请选择 —</option>
              <option v-for="field in headers" :key="field" :value="field">{{ field }}</option>
            </select>
          </div>
          <div class="form-field">
            <Label for="start-latitude">起点纬度字段（Y / LATITUDE）</Label>
            <select id="start-latitude" v-model="startLatitudeField" :disabled="!hasFile">
              <option value="">— 请选择 —</option>
              <option v-for="field in headers" :key="field" :value="field">{{ field }}</option>
            </select>
          </div>
          <div class="form-field">
            <Label for="end-longitude">终点经度字段（X / LONGITUDE）</Label>
            <select id="end-longitude" v-model="endLongitudeField" :disabled="!hasFile">
              <option value="">— 请选择 —</option>
              <option v-for="field in headers" :key="field" :value="field">{{ field }}</option>
            </select>
          </div>
          <div class="form-field">
            <Label for="end-latitude">终点纬度字段（Y / LATITUDE）</Label>
            <select id="end-latitude" v-model="endLatitudeField" :disabled="!hasFile">
              <option value="">— 请选择 —</option>
              <option v-for="field in headers" :key="field" :value="field">{{ field }}</option>
            </select>
          </div>
        </div>
        <p class="field-hint">经纬度必须是有效数值，范围分别为 −180° 至 180°、−90° 至 90°；无效行将在导出时跳过。</p>
      </CardContent>
    </Card>

    <Card class="conversion-card">
      <CardHeader class="step-header step-header-with-note">
        <span class="step-number">5</span>
        <div class="step-title">
          <CardTitle>选择导出到 properties 的字段</CardTitle>
          <CardDescription>要写入每个 GeoJSON 要素属性的表格字段</CardDescription>
        </div>
        <span class="field-total">已选 {{ selectedProperties.length }} / {{ headers.length }} 个字段</span>
      </CardHeader>
      <CardContent class="step-content">
        <div class="property-toolbar">
          <div class="link-actions">
            <button type="button" :disabled="!hasFile" @click="selectAllProperties">全选</button>
            <button type="button" :disabled="!hasFile" @click="selectNoProperties">全不选</button>
            <button type="button" :disabled="!hasFile" @click="invertProperties">反选</button>
          </div>
          <span>坐标字段也可作为属性保留</span>
        </div>
        <div class="property-list" :class="{ empty: !headers.length }">
          <label v-for="field in headers" :key="field" class="property-option">
            <input v-model="selectedProperties" type="checkbox" :value="field" :disabled="!hasFile">
            <span>{{ field }}</span>
          </label>
          <p v-if="!headers.length" class="property-empty">上传文件后可选择需要导出的属性字段。</p>
        </div>
        <div class="property-footer">
          <Label for="field-case">字段名格式</Label>
          <select id="field-case" v-model="fieldCase" :disabled="!hasFile">
            <option value="preserve">保持原样</option>
            <option value="upper">全大写 FIELD_NAME</option>
            <option value="lower">全小写 field_name</option>
          </select>
        </div>
        <p v-if="propertyKeyCollisions" class="field-warning" role="status">字段名格式化后会产生重名，请取消其中一个字段或更改格式。</p>
      </CardContent>
    </Card>

    <Card class="conversion-card">
      <CardHeader class="step-header step-header-with-note">
        <span class="step-number">6</span>
        <div class="step-title">
          <CardTitle>预览与导出</CardTitle>
          <CardDescription>{{ outputName }}</CardDescription>
        </div>
        <div class="export-actions">
          <Button type="button" variant="outline" :disabled="!canExport" @click="loadResultToMap">
            <MapPinned data-icon="inline-start" />
            加载到地图
          </Button>
          <Button type="button" :disabled="!canExport" @click="downloadGeoJson">
            <Download data-icon="inline-start" />
            导出 GeoJSON
          </Button>
        </div>
      </CardHeader>
      <CardContent class="step-content result-content">
        <div class="statistics-grid">
          <div class="statistic"><strong>{{ totalRows }}</strong><span>文件总行数</span></div>
          <div class="statistic"><strong>{{ filteredCount }}</strong><span>筛选后行数</span></div>
          <div class="statistic"><strong>{{ validCount }}</strong><span>有效 Feature</span></div>
          <div class="statistic"><strong>{{ skippedCount }}</strong><span>跳过（坐标无效）</span></div>
        </div>
        <div class="preview-heading">
          <Label>GeoJSON 预览（前 3 条 Feature）</Label>
          <span>{{ outputBom ? 'UTF-8 + BOM' : 'UTF-8' }}</span>
        </div>
        <pre class="geojson-preview">{{ previewJson }}</pre>
        <div class="preview-message" :class="{ 'preview-warning': hasFile && (!canExport || skippedCount > 0), 'preview-success': canExport && skippedCount === 0 }" role="status">
          <span aria-hidden="true">{{ canExport && skippedCount === 0 ? '✓' : '!' }}</span>
          {{ previewMessage }}
        </div>
        <div v-if="notice && !error" class="inline-alert success-alert" role="status">{{ notice }}</div>
        <div v-if="error" class="inline-alert error-alert" role="alert">{{ error }}</div>
      </CardContent>
    </Card>
  </div>
</template>

<style scoped>
.table-converter { display:flex; max-width:1180px; flex-direction:column; gap:16px; margin:0 auto; }
.conversion-card { gap:0; padding:0; overflow:hidden; border-color:#e6e9ef; border-radius:15px; background:#fff; box-shadow:0 5px 18px rgb(30 48 80 / 7%); }
.step-header { display:flex; min-height:70px; align-items:center; gap:12px; padding:17px 25px 13px; }
.step-number { display:grid; flex:none; width:30px; height:30px; place-items:center; border-radius:50%; background:#287bf5; color:white; font-size:13px; font-weight:800; }
.step-title { min-width:0; }
.step-title :deep([data-slot="card-title"]) { margin:0; color:#17283f; font-size:15px; font-weight:800; line-height:1.3; }
.step-title :deep([data-slot="card-description"]) { margin-top:3px; color:#8b96a6; font-size:11px; }
.step-content { padding:0 25px 22px; }
.drop-zone { display:flex; min-height:150px; flex-direction:column; align-items:center; justify-content:center; gap:8px; border:2px dashed #adc8f5; border-radius:12px; background:#f7faff; color:#425671; text-align:center; cursor:pointer; transition:background .16s,border-color .16s; }
.drop-zone:hover { border-color:#287bf5; background:#f1f6ff; }
.drop-zone.is-reading { opacity:.7; pointer-events:none; }
.drop-icon { color:#287bf5; }
.drop-zone strong { max-width:90%; overflow:hidden; font-size:13px; font-weight:650; text-overflow:ellipsis; white-space:nowrap; }
.drop-zone small { color:#8d99aa; font-size:11px; }
.encoding-grid,.coordinate-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; margin-top:17px; }
.form-field { display:flex; min-width:0; flex-direction:column; gap:6px; }
.form-field :deep(label) { color:#37465a; font-size:11px; font-weight:700; }
.form-field select,.field-select,.property-footer select { width:100%; min-width:0; height:38px; padding:0 11px; border:1px solid #dce2ea; border-radius:8px; background:#fff; color:#36465c; font:inherit; font-size:12px; outline:none; }
.form-field select:focus,.field-select:focus,.property-footer select:focus { border-color:#287bf5; box-shadow:0 0 0 3px rgb(40 123 245 / 12%); }
.form-field select:disabled,.field-select:disabled,.property-footer select:disabled { background:#f6f7f9; color:#9aa4b1; cursor:not-allowed; }
.field-hint { margin:7px 0 0; color:#8793a3; font-size:10px; line-height:1.5; }
.sheet-field { max-width:420px; margin-top:14px; }
.status-banner { display:flex; align-items:center; gap:8px; margin-top:13px; padding:9px 12px; border-radius:8px; background:#e8f5eb; color:#227344; font-size:11px; line-height:1.5; }
.status-dot { display:grid; flex:none; width:17px; height:17px; place-items:center; border-radius:4px; background:#299353; color:white; font-weight:800; }
.inline-alert { margin-top:10px; padding:9px 11px; border-radius:8px; font-size:11px; line-height:1.5; }
.error-alert { border:1px solid #ffd6d3; background:#fff0ef; color:#a9322a; }
.success-alert { border:1px solid #d3ead8; background:#f0faf1; color:#257444; }
.geometry-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; }
.geometry-option { display:flex; min-height:126px; flex-direction:column; align-items:center; justify-content:center; gap:7px; padding:15px; border:2px solid #e0e4ea; border-radius:12px; background:#fff; color:#34445b; text-align:center; cursor:pointer; transition:border-color .15s,background .15s; }
.geometry-option:hover { border-color:#9bbcf1; }
.geometry-option.selected { border-color:#287bf5; background:#f0f5ff; }
.geometry-option > svg,.line-symbol { color:#287bf5; }
.geometry-option strong { color:#287bf5; font-size:13px; }
.geometry-option span:not(.line-symbol) { color:#8894a4; font-size:11px; }
.line-symbol { display:grid; width:28px; height:28px; place-items:center; font-size:27px; font-weight:700; line-height:1; }
.filter-list { display:flex; flex-direction:column; gap:10px; margin-bottom:10px; }
.filter-rule { padding:12px 14px; border:1px solid #e2e9f4; border-radius:10px; background:#fbfcff; }
.filter-top-row { display:flex; align-items:center; gap:10px; }
.filter-field { flex:1; }
.filter-top-row :deep(button) { color:#c44747; }
.filter-caption { margin:10px 0 6px; color:#46566b; font-size:11px; font-weight:650; }
.value-options { display:flex; max-height:130px; flex-wrap:wrap; gap:6px; overflow:auto; padding:1px; }
.value-chip { padding:6px 10px; border:1px solid #cfe0fb; border-radius:999px; background:#f4f8ff; color:#2872d5; font-size:11px; cursor:pointer; }
.value-chip:hover { border-color:#287bf5; }
.value-chip.selected { border-color:#287bf5; background:#287bf5; color:#fff; }
.value-limit-note { align-self:center; color:#8d99aa; font-size:10px; }
.empty-hint { margin:8px 0; color:#8b96a6; font-size:11px; }
.filter-count { margin:8px 0 0; color:#7f8a9a; font-size:10px; }
.filter-summary { margin-top:11px; padding:9px 12px; border-radius:8px; background:#f3f5f8; color:#526176; font-size:11px; }
.filter-summary strong { color:#287bf5; }
.coordinate-grid { margin-top:0; }
.line-coordinate-grid { row-gap:13px; }
.property-toolbar { display:flex; justify-content:space-between; gap:10px; margin-bottom:10px; }
.property-toolbar > span { align-self:center; color:#8b96a6; font-size:10px; }
.link-actions { display:flex; gap:12px; }
.link-actions button { padding:0; border:0; background:transparent; color:#287bf5; font-size:11px; text-decoration:underline; cursor:pointer; }
.link-actions button:disabled { color:#a8b0bb; cursor:not-allowed; }
.property-list { display:grid; max-height:245px; grid-template-columns:repeat(5,minmax(0,1fr)); gap:7px 9px; overflow:auto; padding:2px 4px 2px 0; }
.property-list.empty { min-height:90px; place-items:center; border:1px dashed #e1e5eb; border-radius:9px; }
.property-option { display:flex; min-width:0; min-height:35px; align-items:center; gap:8px; padding:6px 9px; border:1px solid #e5e8ed; border-radius:8px; background:#fff; color:#425169; font-size:11px; cursor:pointer; }
.property-option input { width:15px; height:15px; flex:none; accent-color:#287bf5; }
.property-option span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.property-empty { margin:0; color:#8c97a7; font-size:11px; }
.property-footer { display:flex; align-items:center; gap:11px; margin-top:14px; padding-top:12px; border-top:1px solid #edf0f4; }
.property-footer :deep(label) { color:#45546a; font-size:11px; font-weight:700; }
.property-footer select { width:auto; min-width:150px; height:34px; }
.field-total { margin-left:auto; color:#8190a2; font-size:10px; }
.field-warning { margin:9px 0 0; color:#b36b18; font-size:11px; }
.export-actions { display:flex; gap:8px; margin-left:auto; }
.export-actions :deep(button) { font-size:11px; }
.statistics-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; }
.statistic { display:flex; min-height:82px; flex-direction:column; align-items:center; justify-content:center; gap:4px; border-radius:10px; background:#f3f7ff; }
.statistic strong { color:#287bf5; font-size:26px; font-weight:800; line-height:1.1; }
.statistic span { color:#8593a7; font-size:10px; }
.preview-heading { display:flex; justify-content:space-between; gap:10px; margin:17px 0 7px; }
.preview-heading :deep(label) { color:#4b5b70; font-size:11px; font-weight:700; }
.preview-heading > span { color:#8996a8; font-size:10px; }
.geojson-preview { min-height:120px; max-height:480px; overflow:auto; margin:0; padding:15px; border-radius:10px; background:#1c1b2b; color:#f4f5fb; font-family:ui-monospace,SFMono-Regular,Consolas,monospace; font-size:11px; line-height:1.6; white-space:pre; }
.preview-message { display:flex; align-items:flex-start; gap:8px; margin-top:10px; padding:10px 12px; border:1px solid #ffe3b9; border-radius:8px; background:#fff8ed; color:#986014; font-size:11px; line-height:1.5; }
.preview-message > span { flex:none; font-size:14px; font-weight:900; }
.preview-success { border-color:#d8eddd; background:#eff9f1; color:#247344; }
.preview-warning { border-color:#ffd8d4; background:#fff0ef; color:#a33930; }
@media (max-width:850px) { .property-list { grid-template-columns:repeat(3,minmax(0,1fr)); } }
@media (max-width:620px) {
  .step-header { min-height:62px; padding:14px 15px 10px; }
  .step-content { padding:0 15px 16px; }
  .encoding-grid,.coordinate-grid,.geometry-grid { grid-template-columns:1fr; }
  .line-coordinate-grid { row-gap:10px; }
  .step-header-with-note { align-items:flex-start; flex-wrap:wrap; }
  .field-total { max-width:90px; text-align:right; }
  .export-actions { flex-basis:100%; flex-direction:row; justify-content:flex-end; margin-left:0; }
  .export-actions :deep(button) { height:34px; }
  .property-list { grid-template-columns:repeat(2,minmax(0,1fr)); }
  .statistics-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
  .property-toolbar { align-items:flex-start; flex-direction:column; }
}
</style>
