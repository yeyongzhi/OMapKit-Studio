<script setup lang="ts">
import { computed } from 'vue'
import { CheckCircle2, Download, FileOutput, MapPinned } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import type { useSpreadsheetGeoJson } from './useSpreadsheetGeoJson'

const props = defineProps<{ state: ReturnType<typeof useSpreadsheetGeoJson> }>()
const emit = defineEmits<{ loadToMap: [] }>()
const {
  totalRows, filteredCount, validCount, skippedCount, previewJson, previewMessage, outputName,
  canExport, outputBom, error, notice, downloadGeoJson,
} = props.state
const hasFile = computed(() => Boolean(props.state.fileName.value && props.state.headers.value.length))
</script>

<template>
  <Card class="work-card result-card spreadsheet-result" aria-labelledby="spreadsheet-result-heading">
    <header class="card-heading">
      <div class="step-number">03</div>
      <div><h2 id="spreadsheet-result-heading">转换结果</h2><p>预览并导出 GeoJSON</p></div>
      <FileOutput class="heading-icon" :size="19" />
    </header>
    <div class="card-body spreadsheet-result-body">
      <div v-if="canExport" class="success-banner"><CheckCircle2 :size="17" /><div><strong>GeoJSON 已就绪</strong><span>{{ outputName }}</span></div></div>
      <div class="stats-grid">
        <div><span>文件总行数</span><strong>{{ totalRows }}</strong></div>
        <div><span>筛选后行数</span><strong>{{ filteredCount }}</strong></div>
        <div><span>有效要素</span><strong>{{ validCount }}</strong></div>
        <div><span>跳过无效坐标</span><strong>{{ skippedCount }}</strong></div>
      </div>
      <div class="output-heading"><Label>GeoJSON 预览（最多 3 个要素）</Label><select v-model="outputBom" aria-label="GeoJSON 文件编码"><option :value="true">UTF-8 + BOM</option><option :value="false">UTF-8</option></select></div>
      <pre class="geojson-preview">{{ previewJson }}</pre>
      <div class="preview-message" :class="{ warning: hasFile && (!canExport || skippedCount > 0), ready: canExport && skippedCount === 0 }" role="status">{{ previewMessage }}</div>
      <div v-if="error" class="message error-message" role="alert">{{ error }}</div>
      <div v-else-if="notice" class="message success-message" role="status">{{ notice }}</div>
      <div class="result-actions">
        <Button type="button" variant="outline" :disabled="!canExport" @click="emit('loadToMap')"><MapPinned data-icon="inline-start" />加载到地图</Button>
        <Button type="button" :disabled="!canExport" @click="downloadGeoJson"><Download data-icon="inline-start" />导出 GeoJSON</Button>
      </div>
    </div>
  </Card>
</template>

<style scoped>
.spreadsheet-result { min-width:0; }
.spreadsheet-result-body { display:flex; min-height:486px; flex-direction:column; gap:13px; }
.success-banner { display:flex; align-items:center; gap:9px; padding:10px 11px; border:1px solid #e1e1e1; border-radius:10px; background:#f5f5f5; color:#767676; }
.success-banner div { display:flex; min-width:0; flex-direction:column; gap:2px; }
.success-banner strong { font-size:10px; }
.success-banner span { overflow:hidden; color:#9c9c9c; font-size:9px; text-overflow:ellipsis; white-space:nowrap; }
.stats-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:7px; }
.stats-grid > div { display:flex; min-width:0; flex-direction:column; gap:5px; padding:9px; border:1px solid #ebebeb; border-radius:9px; background:#fafdfa; }
.stats-grid span { color:#9e9e9e; font-size:9px; }
.stats-grid strong { overflow:hidden; color:#4e4e4e; font-size:15px; text-overflow:ellipsis; white-space:nowrap; }
.output-heading { display:flex; align-items:center; justify-content:space-between; gap:8px; color:#4f4f4f; font-size:10px; font-weight:800; }
.output-heading select { max-width:120px; height:29px; padding:0 7px; border:1px solid #e3e3e3; border-radius:7px; background:#fff; color:#727272; font-size:9px; }
.geojson-preview { min-height:190px; flex:1; overflow:auto; margin:0; padding:12px; border:1px solid #e3e3e3; border-radius:10px; background:#f8fbf8; color:#4e4e4e; font:10px/1.6 ui-monospace,SFMono-Regular,Consolas,monospace; white-space:pre-wrap; overflow-wrap:anywhere; }
.preview-message,.message { margin:0; padding:8px 10px; border:1px solid #e7e7e7; border-radius:8px; color:#858585; font-size:9px; line-height:1.5; }
.preview-message.warning { border-color:#eadfc9; background:#fcf9f3; color:#927c57; }
.preview-message.ready,.success-message { border-color:#e1e1e1; background:#f5f5f5; color:#777; }
.error-message { border-color:#e8cbc7; background:#fff5f3; color:#aa5446; }
.result-actions { display:flex; flex-wrap:wrap; justify-content:flex-end; gap:7px; margin-top:auto; }
.result-actions :deep(button) { font-size:10px; }
</style>
