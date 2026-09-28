<script setup lang="ts">
import { computed } from 'vue'
import { Check, Download, Eraser, Eye, ListChecks, MousePointer2, Trash2, X } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { DrawingMode, MapTool, MeasuringMode } from '@/stores/mapWorkspace'
import type { DrawingItem } from './useMapWorkspace'

const props = defineProps<{
  activeTool: MapTool
  drawingMode: DrawingMode
  measuringMode: MeasuringMode
  drawingCount: number
  measureResult: string
  baseVisible: boolean
  drawingsVisible: boolean
  drawingEnabled: boolean
  drawingItems: DrawingItem[]
  selectedDrawingIds: string[]
}>()

const emit = defineEmits<{
  close: []
  selectDrawingMode: [mode: DrawingMode]
  selectMeasuringMode: [mode: MeasuringMode]
  setBaseVisible: [visible: boolean]
  setDrawingsVisible: [visible: boolean]
  finish: []
  cancel: []
  clearDrawings: []
  clearMeasurement: []
  exportDrawings: []
  startDrawing: []
  stopDrawing: []
  inspectDrawing: [id: string]
  toggleDrawingSelection: [id: string]
  selectAllDrawings: []
  deleteDrawing: [id: string]
  deleteSelectedDrawings: []
}>()

const title = computed(() => ({ layers: '图层管理', draw: '绘制工具', measure: '测量工具' })[props.activeTool])
const subtitle = computed(() => ({
  layers: '管理当前工作区中的地图内容',
  draw: '在地图上标记和勾画要素',
  measure: '在地图上量测距离与面积',
})[props.activeTool])

const drawingModes = [
  { value: 'Point', label: '点' },
  { value: 'LineString', label: '线' },
  { value: 'Polygon', label: '面' },
] as const

const measuringModes = [
  { value: 'Distance', label: '距离' },
  { value: 'Area', label: '面积' },
] as const
</script>

<template>
  <Card class="inspector" :aria-label="title">
    <header class="inspector-header">
      <div>
        <div class="eyebrow"><span class="eyebrow-dot" /> MAP WORKSPACE</div>
        <h2>{{ title }}</h2>
        <p>{{ subtitle }}</p>
      </div>
      <Button class="close-button" type="button" variant="outline" size="icon" aria-label="收起面板" @click="emit('close')"><X :size="17" /></Button>
    </header>

    <div class="inspector-body">
      <template v-if="activeTool === 'layers'">
        <div class="section-title">当前图层 <span>02</span></div>
        <Button class="layer-row" type="button" variant="outline" :aria-pressed="baseVisible" @click="emit('setBaseVisible', !baseVisible)">
          <span class="layer-icon base-icon">◈</span>
          <span class="layer-copy"><strong>高德矢量底图</strong><small>BASEMAP · 杭州</small></span>
          <span class="layer-check" :class="{ checked: baseVisible }"><Check v-if="baseVisible" :size="13" /></span>
        </Button>
        <Button class="layer-row" type="button" variant="outline" :aria-pressed="drawingsVisible" @click="emit('setDrawingsVisible', !drawingsVisible)">
          <span class="layer-icon drawing-icon">✦</span>
          <span class="layer-copy"><strong>绘制结果</strong><small>VECTOR · {{ drawingCount }} 个要素</small></span>
          <span class="layer-check" :class="{ checked: drawingsVisible }"><Check v-if="drawingsVisible" :size="13" /></span>
        </Button>
        <div class="info-note"><MousePointer2 :size="15" /><span>选择左侧工具开始绘制或测量。图层可随时显示或隐藏。</span></div>
      </template>

      <template v-else-if="activeTool === 'draw'">
        <div class="section-title">几何类型 <span>SELECT MODE</span></div>
        <div class="mode-grid">
          <Button v-for="mode in drawingModes" :key="mode.value" type="button" variant="outline" :class="{ selected: drawingMode === mode.value }" @click="emit('selectDrawingMode', mode.value)">
            {{ mode.label }}
          </Button>
        </div>
        <p class="helper">单击地图添加顶点；绘制线或面时，双击结束当前图形。</p>
        <div class="section-title section-spaced">操作</div>
        <div class="action-row">
          <Button v-if="drawingEnabled" size="sm" variant="secondary" @click="emit('finish')">完成绘制</Button>
          <Button v-else size="sm" @click="emit('startDrawing')">开始绘制</Button>
          <Button size="sm" variant="outline" :disabled="!drawingEnabled" @click="emit('cancel')">取消当前</Button>
          <Button v-if="drawingEnabled" size="sm" variant="outline" @click="emit('stopDrawing')">关闭绘制</Button>
        </div>
        <div class="drawings-heading">
          <div class="section-title">已绘制要素 <span>{{ drawingItems.length }} 个</span></div>
          <div class="drawings-batch-actions">
            <Button size="sm" variant="ghost" :disabled="drawingItems.length === 0" @click="emit('selectAllDrawings')"><ListChecks :size="14" /> {{ selectedDrawingIds.length === drawingItems.length && drawingItems.length ? '取消全选' : '全选' }}</Button>
            <Button size="sm" variant="destructive" :disabled="selectedDrawingIds.length === 0" @click="emit('deleteSelectedDrawings')"><Trash2 :size="14" /> 删除{{ selectedDrawingIds.length ? ` (${selectedDrawingIds.length})` : '' }}</Button>
          </div>
        </div>
        <div v-if="drawingItems.length" class="drawing-list">
          <div v-for="item in drawingItems" :key="item.id" class="drawing-item">
            <Button type="button" variant="outline" size="icon" class="select-drawing" :aria-pressed="selectedDrawingIds.includes(item.id)" :aria-label="selectedDrawingIds.includes(item.id) ? '取消选择' : '选择要素'" @click="emit('toggleDrawingSelection', item.id)"><Check v-if="selectedDrawingIds.includes(item.id)" :size="14" /></Button>
            <Button type="button" variant="ghost" class="drawing-detail" @click="emit('inspectDrawing', item.id)">
              <span><strong>{{ item.label }}</strong><small>{{ item.type }} · {{ item.coordinate }}</small></span><Eye :size="15" />
            </Button>
            <Button type="button" variant="ghost" size="icon" class="delete-drawing" :aria-label="`删除${item.label}`" title="删除要素" @click="emit('deleteDrawing', item.id)"><Trash2 :size="15" /></Button>
          </div>
        </div>
        <div v-else class="empty-drawings">绘制完成的要素会显示在这里。</div>
        <div class="result-block">
          <div><span>绘制结果</span><strong>{{ drawingCount }} <small>个要素</small></strong></div>
          <div class="result-actions">
            <Button size="sm" variant="outline" :disabled="drawingCount === 0" @click="emit('exportDrawings')"><Download :size="15" /> 导出 GeoJSON</Button>
            <Button type="button" variant="outline" size="icon" :disabled="drawingCount === 0" aria-label="清空绘制结果" title="清空绘制结果" @click="emit('clearDrawings')"><Eraser :size="17" /></Button>
          </div>
        </div>
      </template>

      <template v-else>
        <div class="section-title">测量类型 <span>SELECT MODE</span></div>
        <div class="mode-grid two">
          <Button v-for="mode in measuringModes" :key="mode.value" type="button" variant="outline" :class="{ selected: measuringMode === mode.value }" @click="emit('selectMeasuringMode', mode.value)">
            {{ mode.label }}
          </Button>
        </div>
        <p class="helper">单击地图添加测量点，双击完成。结果也会标注在地图上。</p>
        <div class="section-title section-spaced">操作</div>
        <div class="action-row">
          <Button size="sm" @click="emit('finish')">完成测量</Button>
          <Button size="sm" variant="outline" @click="emit('cancel')">取消当前</Button>
        </div>
        <div class="result-block">
          <div><span>最近结果</span><strong>{{ measureResult || '等待测量' }}</strong></div>
          <div class="result-actions"><Button size="sm" variant="outline" @click="emit('clearMeasurement')"><Eraser :size="15" /> 清除测量</Button></div>
        </div>
      </template>
    </div>

    <footer class="inspector-footer"><span class="online-dot" /> OMapKit · 地图工作区</footer>
  </Card>
</template>

<style scoped>
.inspector { display:flex; flex-direction:column; gap:0; width:100%; max-height:100%; padding:0; overflow:hidden; border:1px solid rgba(255,255,255,.8); border-radius:20px; background:rgba(251,252,250,.91); box-shadow:0 22px 70px rgba(40, 40, 40,.2),0 3px 14px rgba(40, 40, 40,.08); backdrop-filter:blur(24px) saturate(1.4); -webkit-backdrop-filter:blur(24px) saturate(1.4); color:#313131; }
.inspector-header { display:flex; justify-content:space-between; gap:12px; padding:23px 23px 20px; border-bottom:1px solid rgba(63, 63, 63,.09); }
.eyebrow { display:flex; align-items:center; gap:7px; color:#7c7c7c; font-size:10px; font-weight:800; letter-spacing:.15em; }
.eyebrow-dot,.online-dot { display:inline-block; width:6px; height:6px; border-radius:50%; background:#898989; box-shadow:0 0 0 3px rgba(137, 137, 137,.12); }
.inspector-header h2 { margin:10px 0 5px; font-size:23px; font-weight:750; letter-spacing:-.04em; }
.inspector-header p { margin:0; color:#858585; font-size:12px; }
.close-button { display:grid; place-items:center; flex:none; width:29px; height:29px; border:1px solid #e7e7e7; border-radius:8px; background:rgba(255,255,255,.72); color:#858585; cursor:pointer; }
.close-button:hover { color:#3f3f3f; background:#fff; }
.inspector-body { flex:1; overflow-y:auto; min-height:0; padding:21px 20px; }
.section-title { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; font-size:11px; font-weight:800; letter-spacing:.05em; color:#4f4f4f; }
.section-title span { color:#adadad; font-size:10px; font-weight:700; letter-spacing:.06em; }
.section-spaced { margin-top:25px; }
.drawings-heading { margin-top:22px; }
.drawings-heading .section-title { margin-bottom:7px; }
.drawings-batch-actions { display:flex; justify-content:flex-end; gap:5px; margin-bottom:8px; }
.drawings-batch-actions :deep(button) { height:30px; padding-inline:8px; font-size:11px; }
.drawing-list { display:flex; flex-direction:column; gap:6px; max-height:220px; overflow:auto; }
.drawing-item { display:flex; align-items:center; gap:5px; padding:5px; border:1px solid #e9e9e9; border-radius:10px; background:rgba(255,255,255,.7); }
.select-drawing { width:27px; height:27px; flex:none; color:#6a6a6a; }
.drawing-detail { display:flex; flex:1; justify-content:space-between; min-width:0; height:auto; padding:5px 7px; text-align:left; color:#7a7a7a; }
.drawing-detail span { display:flex; flex-direction:column; gap:3px; min-width:0; }
.drawing-detail strong { color:#4e4e4e; font-size:11px; }
.drawing-detail small { overflow:hidden; color:#9b9b9b; font-size:9px; text-overflow:ellipsis; white-space:nowrap; }
.delete-drawing { width:28px; height:28px; flex:none; color:#b16d66; }
.empty-drawings { padding:14px 10px; border:1px dashed #e4e4e4; border-radius:10px; color:#9d9d9d; font-size:10px; text-align:center; }
.layer-row { display:flex; align-items:center; justify-content:flex-start; width:100%; height:auto; gap:11px; margin-bottom:9px; padding:11px; border:1px solid #e9e9e9; border-radius:12px; background:rgba(255,255,255,.67); text-align:left; cursor:pointer; transition:border-color .18s,background .18s; }
.layer-row:hover { border-color:#c9c9c9; background:#fff; }
.layer-icon { display:grid; place-items:center; flex:none; width:38px; height:38px; border-radius:9px; font-size:21px; }
.base-icon { background:#ececec; color:#676767; }
.drawing-icon { background:#e9ede6; color:#777777; }
.layer-copy { display:flex; flex:1; flex-direction:column; gap:4px; min-width:0; }
.layer-copy strong { color:#3f3f3f; font-size:12px; }
.layer-copy small { color:#a6a6a6; font-size:10px; letter-spacing:.07em; }
.layer-check { display:grid; place-items:center; width:18px; height:18px; border:1px solid #c7c7c7; border-radius:5px; color:white; }
.layer-check.checked { border-color:var(--primary); background:var(--primary); }
.info-note { display:flex; gap:9px; align-items:flex-start; margin-top:20px; padding:13px; border-radius:11px; background:#f3f3f3; color:#7a7a7a; font-size:11px; line-height:1.5; }
.info-note svg { flex:none; margin-top:1px; }
.mode-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:7px; }
.mode-grid.two { grid-template-columns:repeat(2,1fr); }
.mode-grid button { width:100%; height:42px; border:1px solid #e6e6e6; border-radius:10px; background:#fff; color:#5b5b5b; font-size:12px; font-weight:700; cursor:pointer; }
.mode-grid button:hover { border-color:#b0b0b0; }
.mode-grid button.selected { border-color:var(--primary); background:var(--accent); color:var(--accent-foreground); box-shadow:inset 0 0 0 1px var(--primary); }
.helper { margin:12px 0 0; color:#8d8d8d; font-size:11px; line-height:1.6; }
.action-row,.result-actions { display:flex; flex-wrap:wrap; gap:8px; }
.result-block { margin-top:26px; padding:15px; border:1px solid #e7e7e7; border-radius:13px; background:rgba(255,255,255,.78); }
.result-block > div:first-child { display:flex; justify-content:space-between; align-items:center; margin-bottom:13px; color:#828282; font-size:11px; }
.result-block strong { color:#484848; font-size:19px; }
.result-block strong small { font-size:11px; font-weight:600; }
.result-actions { align-items:center; }
.result-actions > button:last-child:not(:first-child) { display:grid; place-items:center; width:33px; height:33px; border:1px solid #e7e7e7; border-radius:8px; background:#fff; color:#8a8a8a; cursor:pointer; }
.result-actions > button:disabled { opacity:.45; cursor:not-allowed; }
.inspector-footer { display:flex; align-items:center; gap:8px; padding:13px 21px; border-top:1px solid rgba(63, 63, 63,.09); color:#979797; font-size:10px; font-weight:650; letter-spacing:.05em; }
@media (max-width:700px) { .inspector-header { padding:16px; } .inspector-header h2 { font-size:19px; } .inspector-body { padding:15px; } }
</style>
