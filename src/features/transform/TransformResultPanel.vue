<script setup lang="ts">
import { computed } from 'vue'
import { CheckCircle2, ClipboardCopy, Download, FileCheck2, FileOutput } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import type { ConversionResult, ProjectionCode } from './convertData'

const props = defineProps<{
  result: ConversionResult | null
  resultName: string
  targetProjection: ProjectionCode
}>()
const emit = defineEmits<{ copy: []; download: [] }>()

const extentLabel = computed(() => {
  if (!props.result?.extent) return '—'
  const digits = props.targetProjection === 'EPSG:4326' ? 5 : 1
  const [minX, minY, maxX, maxY] = props.result.extent
  return `${minX.toFixed(digits)}, ${minY.toFixed(digits)}  →  ${maxX.toFixed(digits)}, ${maxY.toFixed(digits)}`
})
</script>

<template>
  <Card class="work-card result-card" aria-labelledby="result-heading">
    <header class="card-heading">
      <div class="step-number">03</div>
      <div><h2 id="result-heading">转换结果</h2><p>预览、复制或下载输出</p></div>
      <FileOutput class="heading-icon" :size="19" />
    </header>

    <div class="card-body result-body">
      <template v-if="result">
        <div class="success-banner"><CheckCircle2 :size="18" /><div><strong>转换成功</strong><span>数据已在本地完成处理</span></div></div>
        <div class="stats-grid">
          <div><span>要素数量</span><strong>{{ result.featureCount }}</strong></div>
          <div><span>几何类型</span><strong>{{ result.geometryTypes.join('、') || '未知' }}</strong></div>
        </div>
        <div class="extent-block"><span>坐标范围 · {{ targetProjection }}</span><strong>{{ extentLabel }}</strong></div>
        <div class="output-heading"><span>输出预览</span><small>{{ resultName }}</small></div>
        <Textarea class="output-editor" :model-value="result.output" readonly spellcheck="false" aria-label="转换结果预览" />
        <div class="result-actions">
          <Button variant="outline" size="sm" @click="emit('copy')"><ClipboardCopy :size="15" /> 复制结果</Button>
          <Button size="sm" @click="emit('download')"><Download :size="15" /> 下载文件</Button>
        </div>
      </template>
      <div v-else class="empty-result">
        <span class="empty-icon"><FileCheck2 :size="32" :stroke-width="1.5" /></span>
        <strong>等待转换结果</strong>
        <p>上传或粘贴地理数据，设置目标格式后点击「开始转换」。</p>
        <span class="empty-formats">GEOJSON&nbsp; · &nbsp;WKT&nbsp; · &nbsp;KML</span>
      </div>
    </div>
  </Card>
</template>

<style scoped>
.result-card { min-width:0; }
.result-body { display:flex; flex-direction:column; min-height:486px; }
.success-banner { display:flex; align-items:center; gap:10px; padding:11px 12px; border:1px solid #e1e1e1; border-radius:10px; background:#f5f5f5; color:#767676; }
.success-banner div { display:flex; flex-direction:column; gap:2px; }
.success-banner strong { font-size:11px; }
.success-banner span { color:#9c9c9c; font-size:10px; }
.stats-grid { display:grid; grid-template-columns:1fr 1fr; gap:9px; margin-top:16px; }
.stats-grid > div { display:flex; flex-direction:column; gap:6px; min-height:70px; padding:12px; border:1px solid #ebebeb; border-radius:10px; background:#fafdfa; }
.stats-grid span,.extent-block span { color:#9e9e9e; font-size:10px; }
.stats-grid strong { color:#4e4e4e; font-size:16px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.extent-block { display:flex; flex-direction:column; gap:7px; margin:9px 0 17px; padding:11px 12px; border:1px solid #ebebeb; border-radius:10px; background:#fafdfa; }
.extent-block strong { color:#5f5f5f; font-size:10px; font-weight:600; line-height:1.5; word-break:break-all; }
.output-heading { display:flex; align-items:center; justify-content:space-between; gap:8px; margin:0 0 8px; color:#4f4f4f; font-size:11px; font-weight:800; }
.output-heading small { color:#a6a6a6; font-size:10px; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.output-editor { width:100%; min-height:170px; flex:1; padding:13px; resize:vertical; border:1px solid #e3e3e3; border-radius:10px; background:#f8fbf8; color:#4e4e4e; font-family:ui-monospace,SFMono-Regular,Consolas,monospace; font-size:10px; line-height:1.65; outline:none; }
.result-actions { display:flex; justify-content:flex-end; gap:8px; margin-top:14px; }
.empty-result { display:flex; flex:1; flex-direction:column; align-items:center; justify-content:center; min-height:400px; padding:20px; border:1px dashed #e1e1e1; border-radius:12px; background:#fbfdfb; text-align:center; }
.empty-icon { display:grid; place-items:center; width:62px; height:62px; margin-bottom:18px; border-radius:17px; background:#f2f2f2; color:#989898; }
.empty-result strong { color:#535353; font-size:14px; }
.empty-result p { max-width:220px; margin:8px 0 20px; color:#a2a2a2; font-size:11px; line-height:1.7; }
.empty-formats { color:#bcbcbc; font-size:9px; font-weight:800; letter-spacing:.12em; }
</style>
