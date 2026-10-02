<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { ArrowDown, ArrowUp, Check, Circle, Download, Eraser, Eye, FileUp, Layers3, ListChecks, MapPin, Pencil, Plus, Save, Square, Trash2, Triangle, X, ZoomIn } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Empty, EmptyDescription } from '@/components/ui/empty'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Checkbox } from '@/components/ui/checkbox'
import MapRangeField from './MapRangeField.vue'
import CoordinateSystemPicker from '@/features/coordinate/CoordinateSystemPicker.vue'
import type { AnnotationShape, DrawingMode, ImportProjection, MapAnnotation, MapAnnotationDraft, MapTool, MeasuringMode } from '@/stores/mapWorkspace'
import type { DrawingItem, ImportFileReport, WorkspaceLayerItem } from './useMapWorkspace'

const props = defineProps<{
  basemap: 'vec' | 'img'
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
  setBasemap: [style: 'vec' | 'img']
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

const title = computed(() => ({ layers: '图层管理', import: '导入数据', draw: '绘制工具', measure: '测量工具', annotations: '坐标标注', select: '要素选择', edit: '几何编辑', heatmap: '热力图', groups: '图层分组', services: '地图服务' })[props.activeTool])
const subtitle = computed(() => ({
  layers: '管理当前工作区中的地图内容',
  import: '将本地地理数据添加为地图图层',
  draw: '在地图上标记和勾画要素',
  measure: '在地图上量测距离与面积',
  annotations: '输入经纬度，在地图上添加可自定义样式的标记',
  select: '选择与查看要素', edit: '修改几何节点', heatmap: '展示点位密度与权重', groups: '组织业务图层', services: '连接地图服务',
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
  <Card class="flex max-h-full flex-col gap-0 overflow-hidden py-0 shadow-xl" :aria-label="title">
    <CardHeader class="flex flex-row items-start justify-between border-b p-5">
      <div class="space-y-1"><CardTitle>{{ title }}</CardTitle><CardDescription>{{ subtitle }}</CardDescription></div>
      <Button variant="ghost" size="icon" aria-label="收起面板" @click="emit('close')"><X class="size-4" /></Button>
    </CardHeader>
    <ScrollArea class="min-h-0 flex-1">
      <CardContent class="space-y-5 p-5">
        <template v-if="activeTool === 'layers'">
          <FieldGroup>
            <Field><FieldLabel>底图</FieldLabel>
              <ToggleGroup type="single" variant="outline" :model-value="basemap" class="w-full" @update:model-value="value => { if (value === 'vec' || value === 'img') emit('setBasemap', value) }">
                <ToggleGroupItem value="vec" class="flex-1">街道地图</ToggleGroupItem><ToggleGroupItem value="img" class="flex-1">卫星影像</ToggleGroupItem>
              </ToggleGroup>
            </Field>
            <Card v-for="layer in layers" :key="layer.id" class="gap-3 p-3">
              <div class="flex min-w-0 items-center gap-2">
                <Layers3 class="size-4 shrink-0 text-muted-foreground" />
                <div class="min-w-0 flex-1">
                  <div v-if="renamingLayerId === layer.id" class="flex gap-1"><Input v-model="renameDraft" :aria-label="`重命名${layer.name}`" @keydown.enter.prevent="commitRename(layer)" @keydown.esc.prevent="cancelRename" /><Button variant="ghost" size="icon" aria-label="保存图层名称" @click="commitRename(layer)"><Check class="size-4" /></Button></div>
                  <p v-else class="truncate text-sm font-medium">{{ layer.name }}</p>
                  <p class="truncate text-xs text-muted-foreground">{{ layer.subtitle }}</p>
                </div>
                <Button variant="ghost" size="icon" :aria-label="layer.visible ? `隐藏${layer.name}` : `显示${layer.name}`" @click="emit('setLayerVisible', layer.id, !layer.visible)"><Eye class="size-4" :class="{ 'opacity-40': !layer.visible }" /></Button>
              </div>
              <div class="flex justify-end gap-1">
                <Button v-if="layer.canZoom" variant="ghost" size="icon" :aria-label="`缩放到${layer.name}`" @click="emit('zoomToLayer', layer.id)"><ZoomIn class="size-4" /></Button>
                <Button v-if="layer.canRename" variant="ghost" size="icon" :aria-label="`重命名${layer.name}`" @click="beginRename(layer)"><Pencil class="size-4" /></Button>
                <template v-if="layer.canReorder">
                  <Button variant="ghost" size="icon" :aria-label="`上移${layer.name}`" :disabled="sortableLayerIds[0] === layer.id" @click="emit('moveLayer', layer.id, -1)"><ArrowUp class="size-4" /></Button>
                  <Button variant="ghost" size="icon" :aria-label="`下移${layer.name}`" :disabled="sortableLayerIds.at(-1) === layer.id" @click="emit('moveLayer', layer.id, 1)"><ArrowDown class="size-4" /></Button>
                </template>
                <Button v-if="layer.canRemove" variant="ghost" size="icon" class="text-destructive" :aria-label="`移除${layer.name}`" @click="emit('removeLayer', layer.id)"><Trash2 class="size-4" /></Button>
              </div>
              <MapRangeField :id="`opacity-${layer.id}`" label="不透明度" :model-value="layer.opacity" percent @update:model-value="emit('setLayerOpacity', layer.id, $event)" />
            </Card>
          </FieldGroup>
        </template>
        <template v-else-if="activeTool === 'import'">
          <Empty class="border p-5" :class="{ 'bg-accent': isDragOver }" @dragover="handleDragOver" @dragleave="handleDragLeave" @drop="handleDrop">
            <FileUp class="size-8 text-muted-foreground" /><EmptyDescription>拖放地理数据到这里，每个文件将创建独立图层。</EmptyDescription>
            <input ref="fileInput" class="hidden" type="file" accept=".geojson,.json,.kml,.wkt,.txt" multiple @change="handleFilesChanged" />
            <Button :disabled="importBusy" @click="fileInput?.click()">{{ importBusy ? '正在导入…' : '选择文件' }}</Button>
            <p class="text-xs text-muted-foreground">支持 GeoJSON、KML 和 WKT</p>
          </Empty>
          <CoordinateSystemPicker v-model="importProjection" v-model:custom-definition="importCustomProjection" label="GeoJSON / WKT 源坐标系" />
          <Alert><AlertDescription>KML 使用 WGS 84；GeoJSON 和 WKT 使用所选坐标系。</AlertDescription></Alert>
          <Card v-for="report in importReports" :key="report.id" class="gap-2 p-3"><p class="truncate text-sm font-medium">{{ report.fileName }}</p><p class="text-xs text-muted-foreground" :class="{ 'text-destructive': report.status === 'error' }">{{ importReportStatus(report) }}</p></Card>
        </template>
        <template v-else-if="activeTool === 'draw'">
          <Field><FieldLabel>几何类型</FieldLabel>
            <ToggleGroup type="single" variant="outline" :model-value="drawingMode" class="w-full" @update:model-value="value => { if (drawingModes.some(item => item.value === value)) emit('selectDrawingMode', value as DrawingMode) }">
              <ToggleGroupItem v-for="mode in drawingModes" :key="mode.value" :value="mode.value" class="flex-1">{{ mode.label }}</ToggleGroupItem>
            </ToggleGroup>
          </Field>
          <p class="text-xs text-muted-foreground">单击添加顶点，双击结束线或面。</p>
          <div class="flex flex-wrap gap-2">
            <Button v-if="drawingEnabled" size="sm" @click="emit('finish')">完成绘制</Button><Button v-else size="sm" @click="emit('startDrawing')">开始绘制</Button>
            <Button size="sm" variant="outline" :disabled="!drawingEnabled" @click="emit('cancel')">取消当前</Button>
            <Button v-if="drawingEnabled" size="sm" variant="outline" @click="emit('stopDrawing')">关闭绘制</Button>
          </div>
          <div class="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" :disabled="!drawingItems.length" @click="emit('selectAllDrawings')"><ListChecks class="size-4" />{{ selectedDrawingIds.length === drawingItems.length && drawingItems.length ? '取消全选' : '全选' }}</Button>
            <Button size="sm" variant="destructive" :disabled="!selectedDrawingIds.length" @click="emit('deleteSelectedDrawings')"><Trash2 class="size-4" />删除选中 ({{ selectedDrawingIds.length }})</Button>
          </div>
          <div v-if="drawingItems.length" class="space-y-2">
            <div v-for="item in drawingItems" :key="item.id" class="flex items-center gap-2 rounded-lg border p-2">
              <Checkbox :model-value="selectedDrawingIds.includes(item.id)" :aria-label="`选择${item.label}`" @update:model-value="emit('toggleDrawingSelection', item.id)" />
              <Button variant="ghost" class="h-auto min-w-0 flex-1 justify-start text-left" @click="emit('inspectDrawing', item.id)"><span class="min-w-0"><span class="block truncate">{{ item.label }}</span><span class="block truncate text-xs text-muted-foreground">{{ item.coordinate }}</span></span></Button>
              <Button variant="ghost" size="icon" class="text-destructive" :aria-label="`删除${item.label}`" @click="emit('deleteDrawing', item.id)"><Trash2 class="size-4" /></Button>
            </div>
          </div>
          <Empty v-else class="border p-5"><EmptyDescription>绘制完成的要素会显示在这里。</EmptyDescription></Empty>
          <div class="flex flex-wrap gap-2"><Button size="sm" variant="outline" :disabled="!drawingCount" @click="emit('exportDrawings')"><Download class="size-4" />导出 GeoJSON</Button><Button size="sm" variant="outline" :disabled="!drawingCount" @click="emit('clearDrawings')"><Eraser class="size-4" />清空</Button></div>
        </template>
        <template v-else-if="activeTool === 'annotations'">
          <form @submit.prevent="submitAnnotation">
            <FieldGroup>
              <p class="text-sm font-medium">{{ editingAnnotationId ? '编辑标注' : '新增标注' }}</p>
              <div class="grid grid-cols-2 gap-3">
                <Field><FieldLabel for="annotation-longitude">经度</FieldLabel><Input id="annotation-longitude" v-model="annotationLongitude" inputmode="decimal" placeholder="120.1551" /></Field>
                <Field><FieldLabel for="annotation-latitude">纬度</FieldLabel><Input id="annotation-latitude" v-model="annotationLatitude" inputmode="decimal" placeholder="30.2741" /></Field>
              </div>
              <Button v-if="!annotationPickMode" type="button" variant="outline" :disabled="!mapReady" @click="emit('startMapPick')"><MapPin class="size-4" />在地图上选点</Button>
              <Button v-else type="button" variant="secondary" @click="emit('cancelMapPick')">取消选点</Button>
              <Alert v-if="annotationMessage" variant="destructive"><AlertDescription>{{ annotationMessage }}</AlertDescription></Alert>
              <Field><FieldLabel for="annotation-label">名称（可选）</FieldLabel><Input id="annotation-label" v-model="annotationLabel" maxlength="40" placeholder="未填写时使用默认名称" /></Field>
              <Field><FieldLabel for="annotation-color">颜色</FieldLabel><Input id="annotation-color" v-model="annotationColor" type="color" class="h-10" /></Field>
              <MapRangeField id="annotation-size" v-model="annotationSize" label="标记大小" :min="6" :max="24" :step="1" suffix="px" />
              <Field><FieldLabel>标记形状</FieldLabel><ToggleGroup type="single" variant="outline"  :model-value="annotationShape" class="w-full" @update:model-value="value => { if (value === 'circle' || value === 'square' || value === 'triangle') annotationShape = value }"><ToggleGroupItem v-for="shape in annotationShapes" :key="shape.value" :value="shape.value" class="flex-1"><component :is="shape.icon" class="size-4" />{{ shape.label }}</ToggleGroupItem></ToggleGroup></Field>
              <div class="flex gap-2"><Button type="submit" :disabled="!mapReady"><Save v-if="editingAnnotationId" class="size-4" /><Plus v-else class="size-4" />{{ editingAnnotationId ? '保存修改' : '添加到地图' }}</Button><Button v-if="editingAnnotationId" type="button" variant="outline" @click="resetAnnotationForm">取消</Button></div>
            </FieldGroup>
          </form>
          <div v-if="annotations.length" class="space-y-2">
            <Card v-for="annotation in annotations" :key="annotation.id" class="gap-2 p-3">
              <p class="truncate text-sm font-medium">{{ annotation.label }}</p><p class="text-xs text-muted-foreground">{{ annotation.longitude.toFixed(6) }}, {{ annotation.latitude.toFixed(6) }}</p>
              <div class="flex justify-end"><Button variant="ghost" size="icon" :aria-label="`定位${annotation.label}`" @click="emit('zoomToAnnotation', annotation.id)"><ZoomIn class="size-4" /></Button><Button variant="ghost" size="icon" :aria-label="`编辑${annotation.label}`" @click="beginEditAnnotation(annotation)"><Pencil class="size-4" /></Button><Button variant="ghost" size="icon" class="text-destructive" :aria-label="`删除${annotation.label}`" @click="emit('deleteAnnotation', annotation.id)"><Trash2 class="size-4" /></Button></div>
            </Card>
          </div>
          <Empty v-else class="border p-5"><EmptyDescription>添加位置后，标记将保存在标注图层。</EmptyDescription></Empty>
          <p class="text-xs text-muted-foreground">经纬度使用 WGS 84（EPSG:4326）。</p>
        </template>
        <template v-else-if="activeTool === 'measure'">
          <Field><FieldLabel>测量类型</FieldLabel><ToggleGroup type="single" variant="outline" :model-value="measuringMode" class="w-full" @update:model-value="value => { if (value === 'Distance' || value === 'Area') emit('selectMeasuringMode', value) }"><ToggleGroupItem v-for="mode in measuringModes" :key="mode.value" :value="mode.value" class="flex-1">{{ mode.label }}</ToggleGroupItem></ToggleGroup></Field>
          <p class="text-xs text-muted-foreground">单击添加测量点，双击完成。</p>
          <div class="flex gap-2"><Button size="sm" @click="emit('finish')">完成测量</Button><Button size="sm" variant="outline" @click="emit('cancel')">取消当前</Button></div>
          <Card class="gap-3 p-4"><p class="text-xs text-muted-foreground">最近结果</p><p class="text-lg font-semibold">{{ measureResult || '等待测量' }}</p><Button variant="outline" size="sm" @click="emit('clearMeasurement')"><Eraser class="size-4" />清除测量</Button></Card>
        </template>
      </CardContent>
    </ScrollArea>
  </Card>
</template>
