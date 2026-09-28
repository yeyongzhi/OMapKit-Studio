<script setup lang="ts">
import { ArrowDown, ArrowRight, ArrowRightLeft, Settings2 } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { DataFormat, ProjectionCode } from './convertData'

defineProps<{ sourceFormat: DataFormat; canConvert: boolean }>()
const targetFormat = defineModel<DataFormat>('targetFormat', { required: true })
const sourceProjection = defineModel<ProjectionCode>('sourceProjection', { required: true })
const targetProjection = defineModel<ProjectionCode>('targetProjection', { required: true })
const emit = defineEmits<{ convert: [] }>()
</script>

<template>
  <Card class="work-card options-card" aria-labelledby="options-heading">
    <header class="card-heading">
      <div class="step-number">02</div>
      <div><h2 id="options-heading">转换设置</h2><p>选择输出格式和坐标系</p></div>
      <Settings2 class="heading-icon" :size="19" />
    </header>

    <div class="card-body options-body">
      <div class="flow-label">CONVERSION FLOW</div>
      <div class="flow-diagram">
        <div><span>FROM</span><strong>{{ sourceFormat }}</strong></div>
        <ArrowDown class="flow-arrow narrow-arrow" :size="18" />
        <ArrowRight class="flow-arrow wide-arrow" :size="18" />
        <div><span>TO</span><strong>{{ targetFormat }}</strong></div>
      </div>

      <Label class="select-label" for="target-format">输出格式</Label>
      <Select v-model="targetFormat"><SelectTrigger id="target-format" class="field-select"><SelectValue /></SelectTrigger><SelectContent>
        <SelectItem value="GeoJSON">GeoJSON (.geojson)</SelectItem><SelectItem value="WKT">WKT (.wkt)</SelectItem><SelectItem value="KML">KML (.kml)</SelectItem>
      </SelectContent></Select>

      <div class="divider" />
      <div class="section-caption"><ArrowRightLeft :size="15" /> 坐标参考系</div>
      <Label class="select-label" for="source-projection">输入坐标系</Label>
      <Select v-model="sourceProjection" :disabled="sourceFormat === 'KML'"><SelectTrigger id="source-projection" class="field-select"><SelectValue /></SelectTrigger><SelectContent>
        <SelectItem value="EPSG:4326">EPSG:4326 · 经纬度</SelectItem><SelectItem value="EPSG:3857">EPSG:3857 · Web Mercator</SelectItem>
      </SelectContent></Select>

      <Label class="select-label second" for="target-projection">输出坐标系</Label>
      <Select v-model="targetProjection" :disabled="targetFormat === 'KML'"><SelectTrigger id="target-projection" class="field-select"><SelectValue /></SelectTrigger><SelectContent>
        <SelectItem value="EPSG:4326">EPSG:4326 · 经纬度</SelectItem><SelectItem value="EPSG:3857">EPSG:3857 · Web Mercator</SelectItem>
      </SelectContent></Select>
      <p v-if="sourceFormat === 'KML' || targetFormat === 'KML'" class="projection-note">KML 使用 EPSG:4326 经纬度坐标。</p>

      <Button class="convert-button" :disabled="!canConvert" @click="emit('convert')"><ArrowRightLeft :size="17" /> 开始转换</Button>
      <p class="local-note">所有数据仅在当前浏览器中处理</p>
    </div>
  </Card>
</template>

<style scoped>
.options-card { min-width:0; }
.options-body { display:flex; flex-direction:column; }
.flow-label { margin-bottom:9px; color:#9f9f9f; font-size:9px; font-weight:800; letter-spacing:.14em; }
.flow-diagram { display:flex; align-items:center; justify-content:space-between; gap:9px; margin-bottom:25px; padding:13px 10px; border:1px solid #e7e7e7; border-radius:11px; background:#f7f7f7; }
.flow-diagram > div { display:flex; flex-direction:column; min-width:0; gap:4px; }
.flow-diagram span { color:#9e9e9e; font-size:9px; font-weight:800; letter-spacing:.11em; }
.flow-diagram strong { color:#5b5b5b; font-size:11px; overflow:hidden; text-overflow:ellipsis; }
.flow-arrow { flex:none; color:#979797; }
.narrow-arrow { display:none; }
.select-label { display:block; margin-bottom:8px; color:#575757; font-size:11px; font-weight:800; }
.select-label.second { margin-top:17px; }
.field-select { width:100%; height:41px; padding:0 10px; border:1px solid #e3e3e3; border-radius:9px; background:#fff; color:#414141; font-size:11px; outline:none; }
.field-select:focus { border-color:var(--ring); box-shadow:0 0 0 3px color-mix(in oklab,var(--ring) 14%,transparent); }
.field-select:disabled { background:#f3f6f2; color:#979797; cursor:not-allowed; }
.divider { height:1px; margin:24px 0; background:#ececec; }
.section-caption { display:flex; align-items:center; gap:7px; margin-bottom:17px; color:#595959; font-size:12px; font-weight:800; }
.projection-note { margin:9px 0 0; color:#979797; font-size:10px; line-height:1.5; }
.convert-button { width:100%; height:42px; margin-top:auto; font-size:12px; }
.local-note { margin:10px 0 0; color:#a6a6a6; font-size:10px; text-align:center; }
@media (max-width:1050px) { .flow-diagram { justify-content:center; } }
</style>
