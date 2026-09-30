<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { ArrowDown, ArrowUp, Check, Circle, Download, Eraser, Eye, EyeOff, FileUp, Layers3, ListChecks, MapPin, MousePointer2, Pencil, Plus, Save, Square, Trash2, Triangle, X, ZoomIn } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import CoordinateSystemPicker from '@/features/coordinate/CoordinateSystemPicker.vue'
import type { AnnotationShape, DrawingMode, ImportProjection, MapAnnotation, MapAnnotationDraft, MapTool, MeasuringMode } from '@/stores/mapWorkspace'
import type { DrawingItem, ImportFileReport, WorkspaceLayerItem } from './useMapWorkspace'

const props = defineProps<{
  activeTool: MapTool
  drawingMode: DrawingMode
  measuringMode: MeasuringMode
  drawingCount: number
  measureResult: string
  drawingEnabled: boolean
  drawingItems: DrawingItem[]
  annotations: MapAnnotation[]
  mapReady: boolean
  annotationPickMode: boolean
  pickedAnnotationCoordinate: [number, number] | null
  selectedDrawingIds: string[]
  layers: WorkspaceLayerItem[]
  importBusy: boolean
  importReports: ImportFileReport[]
}>()

const emit = defineEmits<{
  close: []
  selectDrawingMode: [mode: DrawingMode]
  selectMeasuringMode: [mode: MeasuringMode]
  setLayerVisible: [id: string, visible: boolean]
  setLayerOpacity: [id: string, opacity: number]
  zoomToLayer: [id: string]
  renameLayer: [id: string, name: string]
  moveLayer: [id: string, direction: -1 | 1]
  removeLayer: [id: string]
  importFiles: [files: File[], sourceProjection: ImportProjection, sourceCustomProjection: string]
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
  saveAnnotation: [annotation: MapAnnotationDraft]
  deleteAnnotation: [id: string]
  zoomToAnnotation: [id: string]
  startMapPick: []
  cancelMapPick: []
}>()

const title = computed(() => ({ layers: '图层管理', import: '导入数据', draw: '绘制工具', measure: '测量工具', annotations: '坐标标注' })[props.activeTool])
const subtitle = computed(() => ({
  layers: '管理当前工作区中的地图内容',
  import: '将本地地理数据添加为地图图层',
  draw: '在地图上标记和勾画要素',
  measure: '在地图上量测距离与面积',
  annotations: '输入经纬度，在地图上添加可自定义样式的标记',
})[props.activeTool])

const fileInput = shallowRef<HTMLInputElement | null>(null)
const importProjection = shallowRef<ImportProjection>('EPSG:4326')
const importCustomProjection = shallowRef('')
const isDragOver = shallowRef(false)
const renamingLayerId = shallowRef('')
const renameDraft = shallowRef('')
const annotationLongitude = shallowRef('')
const annotationLatitude = shallowRef('')
const annotationLabel = shallowRef('')
const annotationColor = shallowRef('#e45645')
const annotationSize = shallowRef(12)
const annotationShape = shallowRef<AnnotationShape>('circle')
const editingAnnotationId = shallowRef('')
const annotationMessage = shallowRef('')
const sortableLayerIds = computed(() => props.layers.filter((layer) => layer.canReorder).map((layer) => layer.id))

watch(() => props.pickedAnnotationCoordinate, (coordinate) => {
  if (!coordinate) return
  annotationLongitude.value = coordinate[0].toFixed(6)
  annotationLatitude.value = coordinate[1].toFixed(6)
  annotationMessage.value = ''
})

function handleFilesChanged(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  if (files.length) emit('importFiles', files, importProjection.value, importCustomProjection.value)
  input.value = ''
}

function handleDragOver(event: DragEvent) {
  event.preventDefault()
  isDragOver.value = true
}

function handleDragLeave(event: DragEvent) {
  const container = event.currentTarget as HTMLElement
  const nextTarget = event.relatedTarget
  if (nextTarget instanceof Node && container.contains(nextTarget)) return
  isDragOver.value = false
}

function handleDrop(event: DragEvent) {
  event.preventDefault()
  isDragOver.value = false
  const files = Array.from(event.dataTransfer?.files ?? [])
  if (files.length) emit('importFiles', files, importProjection.value, importCustomProjection.value)
}

function importReportStatus(report: ImportFileReport) {
  if (report.status === 'loading') return '正在读取…'
  if (report.status === 'error') return report.error ?? '导入失败'
  return `${report.format ?? '数据'} · ${report.featureCount} 个要素 · ${report.layerName ?? ''}`
}

function beginRename(layer: WorkspaceLayerItem) {
  renamingLayerId.value = layer.id
  renameDraft.value = layer.name
}

function cancelRename() {
  renamingLayerId.value = ''
  renameDraft.value = ''
}

function commitRename(layer: WorkspaceLayerItem) {
  const name = renameDraft.value.trim()
  if (name) emit('renameLayer', layer.id, name)
  cancelRename()
}

function handleOpacityInput(layer: WorkspaceLayerItem, event: Event) {
  const input = event.target as HTMLInputElement
  emit('setLayerOpacity', layer.id, Number(input.value))
}

const drawingModes = [
  { value: 'Point', label: '点' },
  { value: 'LineString', label: '线' },
  { value: 'Polygon', label: '面' },
] as const

const measuringModes = [
  { value: 'Distance', label: '距离' },
  { value: 'Area', label: '面积' },
] as const

const annotationShapes = [
  { value: 'circle', label: '圆形', icon: Circle },
  { value: 'square', label: '方形', icon: Square },
  { value: 'triangle', label: '三角形', icon: Triangle },
] as const

function resetAnnotationForm() {
  editingAnnotationId.value = ''
  annotationLongitude.value = ''
  annotationLatitude.value = ''
  annotationLabel.value = ''
  annotationColor.value = '#e45645'
  annotationSize.value = 12
  annotationShape.value = 'circle'
  annotationMessage.value = ''
}

function submitAnnotation() {
  const longitudeText = String(annotationLongitude.value).trim()
  const latitudeText = String(annotationLatitude.value).trim()
  const longitude = Number(longitudeText)
  const latitude = Number(latitudeText)
  if (!longitudeText || !latitudeText) {
    annotationMessage.value = '请填写经度和纬度，或先在地图上选点。'
    return
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    annotationMessage.value = '经度范围应为 -180 到 180。'
    return
  }
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    annotationMessage.value = '纬度范围应为 -90 到 90。'
    return
  }
  if (!props.mapReady) {
    annotationMessage.value = '地图还在加载，请稍后再添加。'
    return
  }
  annotationMessage.value = ''
  emit('saveAnnotation', {
    id: editingAnnotationId.value || undefined,
    longitude,
    latitude,
    label: annotationLabel.value.trim(),
    color: annotationColor.value,
    size: Number(annotationSize.value),
    shape: annotationShape.value,
  })
  resetAnnotationForm()
}

function beginEditAnnotation(annotation: MapAnnotation) {
  editingAnnotationId.value = annotation.id
  annotationLongitude.value = String(annotation.longitude)
  annotationLatitude.value = String(annotation.latitude)
  annotationLabel.value = annotation.label
  annotationColor.value = annotation.color
  annotationSize.value = annotation.size
  annotationShape.value = annotation.shape
}
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
        <div class="section-title">地图图层 <span>{{ layers.length }} 个</span></div>
        <div class="layer-list">
          <article v-for="layer in layers" :key="layer.id" class="managed-layer">
            <div class="managed-layer-main">
              <span class="layer-icon" :class="`${layer.kind}-icon`"><Layers3 :size="17" /></span>
              <div class="layer-copy">
                <div v-if="renamingLayerId === layer.id" class="rename-field">
                  <Input v-model="renameDraft" :aria-label="`重命名${layer.name}`" @keydown.enter.prevent="commitRename(layer)" @keydown.esc.prevent="cancelRename" />
                  <Button type="button" variant="ghost" size="icon" aria-label="保存图层名称" @click="commitRename(layer)"><Check :size="15" /></Button>
                </div>
                <strong v-else>{{ layer.name }}</strong>
                <small>{{ layer.subtitle }}</small>
              </div>
              <Button type="button" variant="ghost" size="icon" class="layer-action" :aria-label="layer.visible ? `隐藏${layer.name}` : `显示${layer.name}`" :title="layer.visible ? '隐藏图层' : '显示图层'" @click="emit('setLayerVisible', layer.id, !layer.visible)"><Eye v-if="layer.visible" :size="16" /><EyeOff v-else :size="16" /></Button>
              <Button v-if="layer.canZoom" type="button" variant="ghost" size="icon" class="layer-action" :aria-label="`缩放到${layer.name}`" title="缩放至图层" @click="emit('zoomToLayer', layer.id)"><ZoomIn :size="16" /></Button>
            </div>
            <div class="layer-controls">
              <Button v-if="layer.canRename" type="button" variant="ghost" size="icon" class="layer-action" :aria-label="`重命名${layer.name}`" title="重命名" @click="beginRename(layer)"><Pencil :size="14" /></Button>
              <template v-if="layer.canReorder">
                <Button type="button" variant="ghost" size="icon" class="layer-action" :aria-label="`上移${layer.name}`" title="上移图层" :disabled="sortableLayerIds[0] === layer.id" @click="emit('moveLayer', layer.id, -1)"><ArrowUp :size="14" /></Button>
                <Button type="button" variant="ghost" size="icon" class="layer-action" :aria-label="`下移${layer.name}`" title="下移图层" :disabled="sortableLayerIds[sortableLayerIds.length - 1] === layer.id" @click="emit('moveLayer', layer.id, 1)"><ArrowDown :size="14" /></Button>
              </template>
              <Button v-if="layer.canRemove" type="button" variant="ghost" size="icon" class="layer-action remove-layer" :aria-label="`移除${layer.name}`" title="移除图层" @click="emit('removeLayer', layer.id)"><Trash2 :size="14" /></Button>
            </div>
            <label class="opacity-control">
              <span>不透明度</span><strong>{{ Math.round(layer.opacity * 100) }}%</strong>
              <input type="range" min="0" max="1" step="0.05" :value="layer.opacity" :aria-label="`${layer.name}不透明度`" @input="handleOpacityInput(layer, $event)" />
            </label>
          </article>
        </div>
        <div class="info-note"><MousePointer2 :size="15" /><span>选择左侧工具开始绘制或测量。图层可随时显示或隐藏。</span></div>
      </template>

      <template v-else-if="activeTool === 'import'">
        <div class="import-dropzone" :class="{ 'drag-over': isDragOver }" @dragover="handleDragOver" @dragleave="handleDragLeave" @drop="handleDrop">
          <span class="import-icon"><FileUp :size="22" /></span>
          <strong>导入地理数据</strong>
          <p>拖放文件到这里，或选择多个文件。每个文件都会创建独立图层。</p>
          <input ref="fileInput" class="hidden-file-input" type="file" accept=".geojson,.json,.kml,.wkt,.txt" multiple @change="handleFilesChanged" />
          <Button type="button" :disabled="importBusy" @click="fileInput?.click()"><FileUp :size="15" />{{ importBusy ? '正在导入…' : '选择文件' }}</Button>
          <small>支持 GeoJSON、KML 和 WKT。</small>
        </div>
        <CoordinateSystemPicker v-model="importProjection" v-model:custom-definition="importCustomProjection" label="GeoJSON / WKT 源坐标系" />
        <div class="info-note"><MousePointer2 :size="15" /><span>KML 按 WGS 84 读取；GeoJSON 和 WKT 使用所选坐标系。</span></div>
        <div v-if="importReports.length" class="import-reports">
          <div class="section-title">本次导入 <span>{{ importReports.length }} 个文件</span></div>
          <div v-for="report in importReports" :key="report.id" class="import-report" :class="`report-${report.status}`">
            <strong>{{ report.fileName }}</strong>
            <small>{{ importReportStatus(report) }}</small>
          </div>
        </div>
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

      <template v-else-if="activeTool === 'annotations'">
        <form class="annotation-form" @submit.prevent="submitAnnotation">
          <div class="section-title">{{ editingAnnotationId ? '编辑标注' : '新增标注' }} <span>EPSG:4326</span></div>
          <div class="coordinate-fields">
            <label>经度<input v-model="annotationLongitude" type="text" inputmode="decimal" placeholder="例如 120.1551" /></label>
            <label>纬度<input v-model="annotationLatitude" type="text" inputmode="decimal" placeholder="例如 30.2741" /></label>
          </div>
          <div class="map-pick-row">
            <Button v-if="!annotationPickMode" type="button" variant="outline" size="sm" :disabled="!mapReady" @click="emit('startMapPick')"><MapPin :size="14" />在地图上选点</Button>
            <Button v-else type="button" variant="secondary" size="sm" @click="emit('cancelMapPick')"><X :size="14" />取消选点</Button>
            <span>{{ annotationPickMode ? '请在地图上单击要标注的位置' : pickedAnnotationCoordinate ? '位置已从地图选取，可继续编辑坐标' : '也可以直接输入经纬度' }}</span>
          </div>
          <p v-if="annotationMessage" class="annotation-message" role="alert">{{ annotationMessage }}</p>
          <label class="annotation-label">名称（可选）<Input v-model="annotationLabel" placeholder="未填写时使用默认名称" maxlength="40" /></label>
          <div class="section-title section-spaced">标记样式</div>
          <div class="annotation-style-row">
            <label class="color-field">颜色<input v-model="annotationColor" type="color" aria-label="标记颜色" /></label>
            <label class="size-field">大小 <strong>{{ annotationSize }} px</strong><input v-model.number="annotationSize" type="range" min="6" max="24" step="1" aria-label="标记大小" /></label>
          </div>
          <div class="shape-picker" aria-label="标记形状">
            <Button v-for="shape in annotationShapes" :key="shape.value" type="button" variant="outline" :class="{ selected: annotationShape === shape.value }" :aria-pressed="annotationShape === shape.value" @click="annotationShape = shape.value">
              <component :is="shape.icon" :size="15" />{{ shape.label }}
            </Button>
          </div>
          <div class="annotation-form-actions">
            <Button type="submit" :disabled="!mapReady"><Save v-if="editingAnnotationId" :size="15" /><Plus v-else :size="15" />{{ editingAnnotationId ? '保存修改' : '添加到地图' }}</Button>
            <Button v-if="editingAnnotationId" type="button" variant="outline" @click="resetAnnotationForm"><X :size="15" />取消</Button>
          </div>
        </form>

        <div class="annotations-heading">
          <div class="section-title">标注图层 <span>{{ annotations.length }} 个标记</span></div>
          <Button v-if="annotations.length" type="button" variant="ghost" size="sm" @click="emit('zoomToAnnotation', annotations[0].id)"><ZoomIn :size="14" />查看</Button>
        </div>
        <div v-if="annotations.length" class="annotation-list">
          <article v-for="annotation in annotations" :key="annotation.id" class="annotation-item">
            <span class="annotation-swatch" :style="{ backgroundColor: annotation.color, width: `${Math.max(8, Math.min(20, annotation.size))}px`, height: `${Math.max(8, Math.min(20, annotation.size))}px`, borderRadius: annotation.shape === 'circle' ? '50%' : annotation.shape === 'triangle' ? '2px' : '3px', transform: annotation.shape === 'triangle' ? 'rotate(45deg)' : undefined }" />
            <div class="annotation-copy"><strong>{{ annotation.label }}</strong><small>{{ annotation.longitude.toFixed(6) }}, {{ annotation.latitude.toFixed(6) }}</small></div>
            <Button type="button" variant="ghost" size="icon" class="layer-action" :aria-label="`缩放到${annotation.label}`" title="定位标注" @click="emit('zoomToAnnotation', annotation.id)"><ZoomIn :size="15" /></Button>
            <Button type="button" variant="ghost" size="icon" class="layer-action" :aria-label="`编辑${annotation.label}`" title="编辑标注" @click="beginEditAnnotation(annotation)"><Pencil :size="14" /></Button>
            <Button type="button" variant="ghost" size="icon" class="layer-action remove-layer" :aria-label="`删除${annotation.label}`" title="删除标注" @click="emit('deleteAnnotation', annotation.id)"><Trash2 :size="14" /></Button>
          </article>
        </div>
        <div v-else class="empty-drawings">输入经纬度并添加后，标记会保存在独立的“标注”图层中。</div>
        <div class="info-note"><MapPin :size="15" /><span>经纬度使用 WGS 84（EPSG:4326）。标记支持单独设置名称、颜色、大小和形状。</span></div>
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
.annotation-form { padding:13px; border:1px solid #e7e9e6; border-radius:13px; background:rgba(255,255,255,.76); }
.annotation-form .section-title { margin-bottom:10px; }
.coordinate-fields { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
.coordinate-fields label,.annotation-label { display:flex; flex-direction:column; gap:6px; color:#777; font-size:10px; font-weight:700; }
.coordinate-fields input { width:100%; min-width:0; height:35px; padding:0 9px; border:1px solid #e4e6e3; border-radius:8px; outline:none; background:#fff; color:#484848; font:11px ui-monospace,SFMono-Regular,Consolas,monospace; }
.coordinate-fields input:focus,.annotation-label input:focus { border-color:#8c9b8c; box-shadow:0 0 0 2px rgba(113,132,113,.12); }
.map-pick-row { display:flex; align-items:center; gap:8px; margin-top:8px; }
.map-pick-row button { height:30px; padding-inline:9px; flex:none; font-size:10px; }
.map-pick-row > span { color:#8b8b8b; font-size:9px; line-height:1.4; }
.annotation-message { margin:8px 0 0; color:#b14e45; font-size:10px; line-height:1.45; }
.annotation-label { margin-top:10px; }
.annotation-label input { height:34px; font-size:11px; }
.annotation-form .section-spaced { margin-top:17px; }
.annotation-style-row { display:grid; grid-template-columns:66px 1fr; align-items:center; gap:10px; }
.color-field,.size-field { display:flex; flex-direction:column; gap:7px; color:#777; font-size:10px; font-weight:700; }
.color-field input { width:38px; height:31px; padding:2px; border:1px solid #e4e6e3; border-radius:8px; background:#fff; cursor:pointer; }
.size-field { display:grid; grid-template-columns:1fr auto; align-items:center; }
.size-field strong { color:#656565; font-size:10px; font-variant-numeric:tabular-nums; }
.size-field input { grid-column:1/-1; width:100%; accent-color:#59655b; cursor:pointer; }
.shape-picker { display:grid; grid-template-columns:repeat(3,1fr); gap:6px; margin-top:12px; }
.shape-picker button { display:flex; align-items:center; justify-content:center; gap:5px; height:33px; padding:0 5px; color:#666; font-size:10px; }
.shape-picker button.selected { border-color:#858f85; background:#edf0ec; color:#465346; }
.annotation-form-actions { display:flex; gap:7px; margin-top:12px; }
.annotation-form-actions button { flex:1; height:35px; font-size:11px; }
.annotations-heading { display:flex; align-items:center; justify-content:space-between; margin-top:22px; }
.annotations-heading .section-title { margin:0; }
.annotations-heading button { height:28px; padding-inline:8px; color:#777; font-size:10px; }
.annotation-list { display:flex; flex-direction:column; gap:6px; margin-top:9px; max-height:230px; overflow:auto; }
.annotation-item { display:flex; align-items:center; gap:4px; min-width:0; padding:7px 5px 7px 9px; border:1px solid #e9e9e7; border-radius:10px; background:rgba(255,255,255,.74); }
.annotation-swatch { flex:none; border:2px solid rgba(255,255,255,.95); box-shadow:0 0 0 1px rgba(50,50,50,.25); }
.annotation-copy { display:flex; flex:1; flex-direction:column; gap:3px; min-width:0; padding-left:3px; }
.annotation-copy strong { overflow:hidden; color:#4d4d4d; font-size:10px; text-overflow:ellipsis; white-space:nowrap; }
.annotation-copy small { overflow:hidden; color:#979797; font:9px ui-monospace,SFMono-Regular,Consolas,monospace; text-overflow:ellipsis; white-space:nowrap; }
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
.layer-list { display:flex; flex-direction:column; gap:8px; }
.managed-layer { padding:10px; border:1px solid #e8e9e6; border-radius:12px; background:rgba(255,255,255,.73); }
.managed-layer-main { display:flex; align-items:center; gap:6px; min-width:0; }
.managed-layer-main .layer-icon { display:grid; place-items:center; flex:none; width:31px; height:31px; border-radius:8px; }
.basemap-icon { background:#ececec; color:#676767; }
.drawings-icon { background:#e9ede6; color:#777777; }
.imported-icon { background:#e8eee8; color:#57705b; }
.managed-layer-main .layer-copy { flex:1; }
.managed-layer-main .layer-copy strong { display:block; overflow:hidden; color:#3f3f3f; font-size:11px; text-overflow:ellipsis; white-space:nowrap; }
.managed-layer-main .layer-copy small { display:block; margin-top:4px; overflow:hidden; color:#9b9b9b; font-size:9px; text-overflow:ellipsis; white-space:nowrap; }
.layer-action { width:27px; height:27px; flex:none; color:#777; }
.layer-action:disabled { opacity:.32; }
.remove-layer { color:#ae716a; }
.layer-controls { display:flex; justify-content:flex-end; gap:1px; margin-top:3px; }
.opacity-control { display:grid; grid-template-columns:1fr auto; align-items:center; gap:3px 8px; margin-top:5px; color:#868686; font-size:10px; }
.opacity-control strong { color:#656565; font-size:10px; font-variant-numeric:tabular-nums; }
.opacity-control input { grid-column:1 / -1; width:100%; height:14px; accent-color:#59655b; cursor:pointer; }
.rename-field { display:flex; align-items:center; gap:3px; }
.rename-field input { height:28px; min-width:0; padding-inline:7px; font-size:11px; }
.rename-field button { width:25px; height:25px; flex:none; }
.import-dropzone { display:flex; flex-direction:column; align-items:center; gap:10px; padding:23px 14px; border:1px dashed #d2d7d1; border-radius:13px; background:rgba(255,255,255,.61); text-align:center; }
.import-dropzone.drag-over { border-color:#6e806f; background:rgba(231,237,231,.9); box-shadow:inset 0 0 0 1px rgba(110,128,111,.3); }
.import-icon { display:grid; place-items:center; width:43px; height:43px; border-radius:13px; background:#e9ede6; color:#647064; }
.import-dropzone > strong { color:#484848; font-size:13px; }
.import-dropzone p { margin:0; color:#898989; font-size:10px; line-height:1.55; }
.import-dropzone > small { color:#a0a0a0; font-size:9px; line-height:1.45; }
.hidden-file-input { display:none; }
.import-reports { display:flex; flex-direction:column; gap:6px; }
.import-reports .section-title { margin:10px 0 2px; }
.import-report { display:flex; flex-direction:column; gap:4px; padding:8px 10px; border:1px solid #e7e9e6; border-radius:9px; background:rgba(255,255,255,.7); }
.import-report strong { overflow:hidden; color:#555; font-size:10px; text-overflow:ellipsis; white-space:nowrap; }
.import-report small { color:#858585; font-size:9px; line-height:1.45; overflow-wrap:anywhere; }
.import-report.report-error { border-color:#ead3d0; background:#fff8f7; }
.import-report.report-error small { color:#a8544a; }
.import-report.report-success small { color:#617563; }
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
