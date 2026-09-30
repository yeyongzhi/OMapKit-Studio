<script setup lang="ts">
import { computed } from 'vue'
import { FileInput, FileJson2, FileSpreadsheet, RotateCcw, Sparkles, UploadCloud } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { DataFormat } from './convertData'
import type { useSpreadsheetGeoJson } from './useSpreadsheetGeoJson'

const props = defineProps<{ fileName: string; sourceSize: string; spreadsheet: ReturnType<typeof useSpreadsheetGeoJson> }>()
const text = defineModel<string>('text', { required: true })
const format = defineModel<DataFormat>('format', { required: true })
const spreadsheetMode = defineModel<boolean>('spreadsheetMode', { required: true })
const emit = defineEmits<{ fileSelected: [file: File]; loadSample: []; clear: [] }>()
const inputFormat = computed({
  get: () => spreadsheetMode.value ? 'spreadsheet' : format.value,
  set: (value: string) => {
    spreadsheetMode.value = value === 'spreadsheet'
    if (value !== 'spreadsheet') format.value = value as DataFormat
  },
})
const { fileKind, sheetNames, selectedSheet, csvEncoding, detectedEncoding, totalRows, headers, loadSheet } = props.spreadsheet

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) emit('fileSelected', file)
  input.value = ''
}

function onDrop(event: DragEvent) {
  const file = event.dataTransfer?.files?.[0]
  if (file) emit('fileSelected', file)
}
</script>

<template>
  <Card class="work-card input-card" aria-labelledby="input-heading">
    <header class="card-heading">
      <div class="step-number">01</div>
      <div><h2 id="input-heading">输入数据</h2><p>上传文件，或直接粘贴内容</p></div>
      <FileInput class="heading-icon" :size="19" />
    </header>

    <div class="card-body">
      <div class="field-heading"><Label for="source-format">输入格式</Label><span>FORMAT</span></div>
      <Select v-model="inputFormat">
        <SelectTrigger id="source-format" class="field-select"><SelectValue placeholder="选择格式" /></SelectTrigger>
        <SelectContent><SelectItem value="GeoJSON">GeoJSON</SelectItem><SelectItem value="WKT">WKT</SelectItem><SelectItem value="KML">KML</SelectItem><SelectItem value="spreadsheet">表格（Excel / CSV）</SelectItem></SelectContent>
      </Select>

      <Input id="source-file" type="file" :accept="spreadsheetMode ? '.xlsx,.xls,.csv' : '.geojson,.json,.wkt,.kml'" class="sr-only" @change="onFileChange" />
      <Label for="source-file" class="upload-zone" @dragover.prevent @drop.prevent="onDrop">
        <span class="upload-icon"><UploadCloud :size="23" /></span>
        <span><strong>点击选择文件</strong> 或拖拽文件到这里</span>
        <small>{{ spreadsheetMode ? '支持 .xlsx / .xls / .csv，最大 25 MB' : '支持 .geojson / .json / .wkt / .kml，最大 8 MB' }}</small>
      </Label>

      <template v-if="spreadsheetMode">
        <div v-if="fileKind === 'csv'" class="table-settings">
          <Label for="csv-encoding">CSV 输入编码</Label>
          <select id="csv-encoding" v-model="csvEncoding">
            <option value="auto">自动检测（推荐）</option><option value="utf-8">UTF-8</option><option value="gbk">GBK</option><option value="gb18030">GB18030</option><option value="utf-16le">UTF-16 LE</option><option value="utf-16be">UTF-16 BE</option>
          </select>
        </div>
        <div v-if="sheetNames.length > 1" class="table-settings">
          <Label for="workbook-sheet">工作表</Label>
          <select id="workbook-sheet" v-model="selectedSheet" @change="loadSheet(selectedSheet)"><option v-for="sheet in sheetNames" :key="sheet" :value="sheet">{{ sheet }}</option></select>
        </div>
        <div v-if="fileName" class="table-summary"><FileSpreadsheet :size="15" /><span>{{ totalRows }} 行数据 · {{ headers.length }} 个字段</span><small v-if="detectedEncoding">CSV {{ detectedEncoding }}</small></div>
        <p class="field-note">选择表格后，在转换设置中指定几何类型、坐标字段和保留属性。</p>
      </template>
      <template v-else>
        <div class="editor-heading"><span>数据内容</span><small>{{ sourceSize }}</small></div>
        <Textarea v-model="text" class="source-editor" spellcheck="false" :placeholder="'在此粘贴 ' + format + ' 数据文本…'" aria-label="待转换的数据" />
      </template>

      <div class="input-footer">
        <span class="file-status"><component :is="spreadsheetMode ? FileSpreadsheet : FileJson2" :size="14" />{{ fileName || '未选择文件' }}</span>
        <div class="footer-actions">
          <Button v-if="!spreadsheetMode" type="button" variant="ghost" size="sm" @click="emit('loadSample')"><Sparkles :size="14" /> 示例</Button>
          <Button type="button" variant="ghost" size="sm" @click="emit('clear')"><RotateCcw :size="14" /> 清空</Button>
        </div>
      </div>
    </div>
  </Card>
</template>

<style scoped>
.input-card { min-width:0; }
.field-heading,.editor-heading { display:flex; justify-content:space-between; align-items:center; margin:0 0 8px; color:#484848; font-size:11px; font-weight:800; }
.field-heading span,.editor-heading small { color:#a6a6a6; font-size:10px; font-weight:700; letter-spacing:.08em; }
.field-select { width:100%; height:40px; padding:0 12px; border:1px solid #e3e3e3; border-radius:9px; background:#fff; color:#3b3b3b; font-size:12px; outline:none; }
.field-select:focus { border-color:var(--ring); box-shadow:0 0 0 3px color-mix(in oklab,var(--ring) 14%,transparent); }
.upload-zone { display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%; min-height:133px; height:auto; gap:7px; margin:17px 0 19px; border:1.5px dashed #cdcdcd; border-radius:12px; background:#f9f9f9; color:#828282; font-size:11px; font-weight:400; cursor:pointer; transition:background .18s,border-color .18s; }
.upload-zone:hover { border-color:#7a7a7a; background:#f4f4f4; }
.upload-zone strong { color:#5e5e5e; }
.upload-zone small { color:#a6a6a6; font-size:10px; }
.upload-icon { display:grid; place-items:center; width:34px; height:34px; border-radius:10px; background:#eeeeee; color:#6c6c6c; }
.source-editor { display:block; width:100%; min-height:285px; padding:13px; resize:vertical; border:1px solid #e3e3e3; border-radius:10px; background:#fbfdfb; color:#424242; font-family:ui-monospace,SFMono-Regular,Consolas,monospace; font-size:11px; line-height:1.65; outline:none; }
.source-editor:focus { border-color:var(--ring); box-shadow:0 0 0 3px color-mix(in oklab,var(--ring) 14%,transparent); }
.source-editor::placeholder { color:#b1b1b1; }
.table-settings { display:grid; grid-template-columns:100px minmax(0,1fr); align-items:center; gap:9px; margin:1px 0; }
.table-settings :deep(label) { color:#777; font-size:10px; }
.table-settings select { width:100%; height:34px; padding:0 9px; border:1px solid #e3e3e3; border-radius:8px; background:#fff; color:#555; font-size:10px; }
.table-summary { display:flex; align-items:center; gap:7px; padding:10px; border:1px solid #e6e6e6; border-radius:9px; background:#f8faf8; color:#777; font-size:10px; }
.table-summary small { margin-left:auto; color:#999; font-size:9px; }
.field-note { margin:0; color:#999; font-size:10px; line-height:1.5; }
.input-footer { display:flex; justify-content:space-between; align-items:center; gap:8px; margin-top:13px; }
.file-status { display:flex; align-items:center; gap:5px; min-width:0; overflow:hidden; color:#9d9d9d; font-size:10px; text-overflow:ellipsis; white-space:nowrap; }
.footer-actions { display:flex; gap:8px; flex:none; }
.footer-actions button { display:flex; align-items:center; gap:4px; padding:5px 4px; color:#7b7b7b; font-size:11px; font-weight:700; }
.footer-actions button:hover { color:#585858; }
</style>
