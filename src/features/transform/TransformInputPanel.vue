<script setup lang="ts">
import { FileInput, FileJson2, RotateCcw, Sparkles, UploadCloud } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { DataFormat } from './convertData'

defineProps<{ fileName: string; sourceSize: string }>()
const text = defineModel<string>('text', { required: true })
const format = defineModel<DataFormat>('format', { required: true })
const emit = defineEmits<{ fileSelected: [file: File]; loadSample: []; clear: [] }>()

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
      <Select v-model="format">
        <SelectTrigger id="source-format" class="field-select"><SelectValue placeholder="选择格式" /></SelectTrigger>
        <SelectContent><SelectItem value="GeoJSON">GeoJSON</SelectItem><SelectItem value="WKT">WKT</SelectItem><SelectItem value="KML">KML</SelectItem></SelectContent>
      </Select>

      <Input id="source-file" type="file" accept=".geojson,.json,.wkt,.kml" class="sr-only" @change="onFileChange" />
      <Label for="source-file" class="upload-zone" @dragover.prevent @drop.prevent="onDrop">
        <span class="upload-icon"><UploadCloud :size="23" /></span>
        <span><strong>点击选择文件</strong> 或拖拽文件到这里</span>
        <small>支持 .geojson / .json / .wkt / .kml，最大 8 MB</small>
      </Label>

      <div class="editor-heading"><span>数据内容</span><small>{{ sourceSize }}</small></div>
      <Textarea v-model="text" class="source-editor" spellcheck="false" placeholder="在此粘贴 GeoJSON、WKT 或 KML 文本…" aria-label="待转换的数据" />

      <div class="input-footer">
        <span class="file-status"><FileJson2 :size="14" />{{ fileName || '未选择文件' }}</span>
        <div class="footer-actions">
          <Button type="button" variant="ghost" size="sm" @click="emit('loadSample')"><Sparkles :size="14" /> 示例</Button>
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
.input-footer { display:flex; justify-content:space-between; align-items:center; gap:8px; margin-top:13px; }
.file-status { display:flex; align-items:center; gap:5px; min-width:0; overflow:hidden; color:#9d9d9d; font-size:10px; text-overflow:ellipsis; white-space:nowrap; }
.footer-actions { display:flex; gap:8px; flex:none; }
.footer-actions button { display:flex; align-items:center; gap:4px; padding:5px 4px; color:#7b7b7b; font-size:11px; font-weight:700; }
.footer-actions button:hover { color:#585858; }
</style>
