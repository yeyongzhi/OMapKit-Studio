<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { X, Download, LocateFixed, Eye, Flame, Globe, FolderTree } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Field, FieldLabel, FieldDescription, FieldGroup } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent, EmptyMedia } from '@/components/ui/empty'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import MapChoiceField from './MapChoiceField.vue'
import MapRangeField from './MapRangeField.vue'
import type { MapTools, ServiceConfig, FeatureRow } from './useMapTools'
import type { MapTool } from '@/stores/mapWorkspace'

const props = defineProps<{ tools: MapTools; mode: 'select' | 'edit' | 'heatmap' | 'groups' | 'services'; ready: boolean }>()
const emit = defineEmits<{ close: []; selectTool: [tool: MapTool] }>()
const state = computed(() => props.tools.state)
const copy = computed(() => ({
  select: { title: '属性与选择', description: '检索地图数据，定位并导出所需的要素。' },
  edit: { title: '几何编辑', description: '调整点位和边界，保存可复用的地理数据。' },
  heatmap: { title: '热力图', description: '将已有点位转为密度与权重分布。' },
  groups: { title: '图层分组', description: '按业务组织图层，统一控制显示效果。' },
  services: { title: '地图服务', description: '连接你的 WMS 或 WMTS 地图资源。' },
})[props.mode])
const targetOptions = computed(() => state.value.targets.map(layer => ({ value: layer.id, label: `${layer.name} · ${layer.count} 个要素` })))
const heatOptions = computed(() => state.value.targets.filter(layer => layer.points > 0).map(layer => ({ value: layer.id, label: `${layer.name} · ${layer.points} 个点要素` })))
const weightOptions = computed(() => [{ value: '__uniform', label: '等权重 · 按点位密度' }, ...state.value.weightFields.map(value => ({ value, label: value }))])
const geometryOptions = computed(() => [{ value: 'all', label: '全部类型' }, ...[...new Set(state.value.rows.map(row => row.type))].map(value => ({ value, label: value }))])
const filtered = computed(() => props.tools.filteredRows())
const page = ref(1)
const pages = computed(() => Math.max(1, Math.ceil(filtered.value.length / 20)))
const rows = computed(() => filtered.value.slice((page.value - 1) * 20, page.value * 20))
const featureDetails = ref<FeatureRow | null>(null)
const groupName = ref('')
const config = reactive<ServiceConfig>({ type: 'WMS', url: '', layer: '', version: '1.3.0', projection: 'EPSG:3857', format: 'image/png', matrixSet: '', style: 'default', grid: '' })
watch(() => config.type, type => { config.version = type === 'WMS' ? '1.3.0' : '1.0.0' })
watch(() => [state.value.query, state.value.geometryFilter, state.value.targetId], () => { page.value = 1 })
watch(pages, value => { page.value = Math.min(page.value, value) })
function targetChanged(value: string) { state.value.targetId = value; props.tools.activate(props.mode === 'edit' ? 'edit' : 'select') }
function toggleGroupId(value: string, checked: boolean | 'indeterminate') { state.value.groupIds = checked === true ? [...state.value.groupIds.filter(id => id !== value), value] : state.value.groupIds.filter(id => id !== value) }
function webMercatorGrid() {
  config.projection = 'EPSG:3857'
  config.grid = JSON.stringify({ origin: [-20037508.342789244, 20037508.342789244], resolutions: Array.from({ length: 20 }, (_, z) => 156543.03392804097 / 2 ** z), matrixIds: Array.from({ length: 20 }, (_, z) => String(z)), sizes: Array.from({ length: 20 }, (_, z) => [2 ** z, 2 ** z]), tileSize: 256 }, null, 2)
}
</script>

<template>
  <Card class="flex min-h-0 flex-col gap-0 overflow-hidden py-0 shadow-xl" :aria-label="copy.title">
    <CardHeader class="shrink-0 border-b p-5">
      <div class="flex items-start justify-between gap-3"><CardTitle>{{ copy.title }}</CardTitle><Button variant="ghost" size="icon" aria-label="关闭面板" @click="emit('close')"><X /></Button></div>
      <CardDescription>{{ copy.description }}</CardDescription>
    </CardHeader>
    <ScrollArea class="min-h-0 flex-1">
      <CardContent class="flex flex-col gap-5 p-5">
        <Alert v-if="state.error" variant="destructive"><AlertTitle>操作未完成</AlertTitle><AlertDescription>{{ state.error }}</AlertDescription></Alert>
        <template v-if="mode === 'select' || mode === 'edit'">
          <FieldGroup>
            <MapChoiceField :model-value="state.targetId" id="data-target" label="当前图层" :options="targetOptions" :disabled="!ready" @update:model-value="targetChanged" />
          </FieldGroup>
          <Empty v-if="!state.rows.length">
            <EmptyHeader><EmptyTitle>这个图层还没有数据</EmptyTitle><EmptyDescription>导入地理文件，或在地图上绘制点、线和面。</EmptyDescription></EmptyHeader>
            <EmptyContent><div class="flex gap-2"><Button size="sm" @click="emit('selectTool', 'import')">导入数据</Button><Button size="sm" variant="outline" @click="emit('selectTool', 'draw')">开始绘制</Button></div></EmptyContent>
          </Empty>
          <template v-else-if="mode === 'select'">
            <FieldGroup>
              <Field><FieldLabel for="feature-search">搜索属性</FieldLabel><Input id="feature-search" v-model="state.query" placeholder="名称、编号或任意属性值" /><FieldDescription>搜索当前图层的属性，不改变地图数据。</FieldDescription></Field>
              <MapChoiceField v-model="state.geometryFilter" id="geometry-filter" label="几何类型" :options="geometryOptions" />
            </FieldGroup>
            <div class="flex flex-wrap items-center gap-2"><Badge variant="secondary">{{ filtered.length }} 个结果</Badge><Badge variant="outline">已选 {{ state.selected.length }} 个</Badge></div>
            <div class="flex flex-wrap gap-2"><Button size="sm" variant="outline" :disabled="!filtered.length" @click="tools.selectFiltered">选择筛选结果</Button><Button size="sm" variant="ghost" :disabled="!state.selected.length" @click="tools.clearSelection">清空选择</Button></div>
            <Table>
              <TableHeader><TableRow><TableHead class="w-8">选择</TableHead><TableHead>要素</TableHead><TableHead class="text-right">操作</TableHead></TableRow></TableHeader>
              <TableBody><TableRow v-for="row in rows" :key="row.key"><TableCell><Checkbox :model-value="state.selected.some(item => item.key === row.key)" :aria-label="`选择${row.name}`" @update:model-value="tools.toggleRow(row.key)" /></TableCell><TableCell><div class="max-w-36 truncate">{{ row.name }}</div><span class="text-xs text-muted-foreground">{{ row.type }}</span></TableCell><TableCell><div class="flex justify-end"><Button variant="ghost" size="icon" :aria-label="`定位${row.name}`" @click="tools.locateRow(row.key)"><LocateFixed /></Button><Button variant="ghost" size="icon" :aria-label="`查看${row.name}属性`" @click="featureDetails = row"><Eye /></Button></div></TableCell></TableRow></TableBody>
            </Table>
            <Empty v-if="!filtered.length"><EmptyHeader><EmptyTitle>没有匹配的要素</EmptyTitle><EmptyDescription>试试其他关键词或几何类型。</EmptyDescription></EmptyHeader></Empty>
            <div v-if="pages > 1" class="flex items-center justify-between gap-2"><Button size="sm" variant="outline" :disabled="page <= 1" @click="page--">上一页</Button><span class="text-xs text-muted-foreground">{{ page }} / {{ pages }}</span><Button size="sm" variant="outline" :disabled="page >= pages" @click="page++">下一页</Button></div>
            <div class="flex flex-wrap gap-2"><Button size="sm" :disabled="!state.selected.length" @click="tools.exportSelected"><Download data-icon="inline-start" />导出选中</Button><Button size="sm" variant="outline" :disabled="!filtered.length" @click="tools.exportFiltered">导出筛选结果</Button></div>
            <p class="text-xs text-muted-foreground">地图上单击选择，Shift 单击追加或取消；点击空白清空。</p>
          </template>
          <template v-else>
            <Badge variant="secondary">{{ state.editing ? '编辑中' : '已停止编辑' }} · {{ state.history }} 次修改</Badge>
            <Alert><AlertTitle>编辑节点</AlertTitle><AlertDescription>拖动节点调整位置；在线段上拖动插入节点；Alt 单击节点删除。修改会同步保存到当前工作区。</AlertDescription></Alert>
            <div class="flex flex-wrap gap-2"><Button size="sm" :disabled="!ready || state.editing" @click="tools.activate('edit')">开始编辑</Button><Button size="sm" variant="outline" :disabled="!state.editing" @click="tools.stop">结束编辑</Button><Button size="sm" variant="outline" :disabled="!state.history" @click="tools.undo">撤销</Button><Button size="sm" variant="outline" :disabled="!state.history" @click="tools.resetEdit">恢复本次初始状态</Button></div>
          </template>
          <Button v-if="state.rows.length" variant="outline" @click="tools.exportTarget"><Download data-icon="inline-start" />导出整个图层</Button>
        </template>
        <template v-else-if="mode === 'heatmap'">
          <Empty v-if="!heatOptions.length"><EmptyHeader><EmptyMedia variant="icon"><Flame /></EmptyMedia><EmptyTitle>添加点位数据</EmptyTitle><EmptyDescription>导入含点要素的文件，或绘制点位，再生成热力图。</EmptyDescription></EmptyHeader><EmptyContent><Button size="sm" @click="emit('selectTool', 'import')">导入点位</Button></EmptyContent></Empty>
          <FieldGroup v-else>
            <MapChoiceField v-model="state.heatTargetId" id="heat-source" label="点位来源" :options="heatOptions" @update:model-value="tools.refreshWeightFields" />
            <MapChoiceField v-model="state.weightField" id="heat-weight" label="权重字段" :options="weightOptions" description="数值按最大值归一化，缺失值与非正值按零处理。" />
            <Button :disabled="!ready" @click="tools.generateHeat"><Flame data-icon="inline-start" />{{ state.heatCreated ? '更新热力图' : '生成热力图' }}</Button>
          </FieldGroup>
          <template v-if="state.heatCreated">
            <Separator /><Badge variant="secondary">{{ state.heatName }} · {{ state.heatPoints }} 个点位</Badge>
            <FieldGroup>
              <Field orientation="horizontal"><FieldLabel for="heat-visible">显示热力图</FieldLabel><Switch id="heat-visible" v-model="state.heatVisible" @update:model-value="tools.updateHeat" /></Field>
              <MapRangeField v-model="state.radius" id="heat-radius" label="影响半径" :min="1" :max="60" :step="1" suffix=" px" @update:model-value="tools.updateHeat" />
              <MapRangeField v-model="state.blur" id="heat-blur" label="边缘模糊" :min="0" :max="50" :step="1" suffix=" px" @update:model-value="tools.updateHeat" />
              <MapRangeField v-model="state.heatOpacity" id="heat-opacity" label="不透明度" percent @update:model-value="tools.updateHeat" />
            </FieldGroup>
            <Button variant="outline" @click="tools.removeHeat">移除热力图</Button>
          </template>
        </template>
        <template v-else-if="mode === 'groups'">
          <template v-if="state.children.length">
            <Badge variant="secondary">{{ state.groupName }} · {{ state.children.length }} 个图层</Badge>
            <FieldGroup>
              <Field orientation="horizontal"><FieldLabel for="group-visible">显示分组</FieldLabel><Switch id="group-visible" v-model="state.groupVisible" @update:model-value="tools.applyGroup" /></Field>
              <MapRangeField v-model="state.groupOpacity" id="group-opacity" label="分组不透明度" percent @update:model-value="tools.applyGroup" />
              <Accordion type="multiple">
                <AccordionItem v-for="child in state.children" :key="child.id" :value="child.id"><AccordionTrigger>{{ child.name }}</AccordionTrigger><AccordionContent><FieldGroup><Field orientation="horizontal"><FieldLabel :for="`child-${child.id}`">显示图层</FieldLabel><Switch :id="`child-${child.id}`" v-model="child.visible" @update:model-value="tools.applyGroup" /></Field><MapRangeField v-model="child.opacity" :id="`opacity-${child.id}`" label="图层不透明度" percent @update:model-value="tools.applyGroup" /></FieldGroup></AccordionContent></AccordionItem>
              </Accordion>
            </FieldGroup>
            <Button variant="outline" @click="tools.ungroup">解除分组，保留图层</Button>
          </template>
          <form v-else @submit.prevent="tools.createGroup(groupName, state.groupIds)">
            <FieldGroup><Field><FieldLabel for="group-name">分组名称</FieldLabel><Input id="group-name" v-model="groupName" required maxlength="40" placeholder="例如 项目范围与巡检点" /></Field><Field v-for="layer in state.targets" :key="layer.id" orientation="horizontal"><Checkbox :id="`group-layer-${layer.id}`" :model-value="state.groupIds.includes(layer.id)" @update:model-value="toggleGroupId(layer.id, $event)" /><FieldLabel :for="`group-layer-${layer.id}`">{{ layer.name }}</FieldLabel><Badge variant="outline">{{ layer.count }}</Badge></Field><FieldDescription>选择至少两个图层。分组隐藏和透明度调整会保留各子层设置。</FieldDescription><Button type="submit" :disabled="!ready || state.groupIds.length < 2"><FolderTree data-icon="inline-start" />创建分组</Button></FieldGroup>
          </form>
        </template>
        <template v-else>
          <form @submit.prevent="tools.addService(config)">
            <FieldGroup>
              <MapChoiceField v-model="config.type" id="service-type" label="服务类型" :options="[{ value: 'WMS', label: 'WMS' }, { value: 'WMTS', label: 'WMTS' }]" />
              <Field><FieldLabel for="service-url">服务地址</FieldLabel><Input id="service-url" v-model="config.url" type="url" required placeholder="https://你的地图服务地址" /></Field>
              <Field><FieldLabel for="service-layer">图层名称</FieldLabel><Input id="service-layer" v-model="config.layer" required placeholder="服务发布的图层标识" /></Field>
              <Accordion type="single" collapsible><AccordionItem value="advanced"><AccordionTrigger>连接参数</AccordionTrigger><AccordionContent><FieldGroup>
                <MapChoiceField v-model="config.version" id="service-version" label="服务版本" :options="(config.type === 'WMS' ? ['1.3.0', '1.1.1'] : ['1.0.0']).map(value => ({ value, label: value }))" />
                <MapChoiceField v-model="config.projection" id="service-projection" label="服务坐标系" :options="['EPSG:3857', 'EPSG:4326'].map(value => ({ value, label: value }))" />
                <Field><FieldLabel for="service-format">图像格式</FieldLabel><Input id="service-format" v-model="config.format" required /></Field>
              </FieldGroup></AccordionContent></AccordionItem></Accordion>
              <template v-if="config.type === 'WMTS'">
                <Field><FieldLabel for="service-matrix">矩阵集</FieldLabel><Input id="service-matrix" v-model="config.matrixSet" required placeholder="例如 GoogleMapsCompatible" /></Field>
                <Field><FieldLabel for="service-style">样式</FieldLabel><Input id="service-style" v-model="config.style" /></Field>
                <Field><FieldLabel for="service-grid">瓦片网格</FieldLabel><Textarea id="service-grid" v-model="config.grid" required :rows="5" /><FieldDescription>填写服务元数据中的 origin、resolutions、matrixIds；局部网格还需 sizes。</FieldDescription></Field>
                <Button type="button" variant="outline" size="sm" @click="webMercatorGrid">使用标准 Web Mercator 网格</Button>
              </template>
              <Button type="submit" :disabled="!ready"><Globe data-icon="inline-start" />添加地图服务</Button>
            </FieldGroup>
          </form>
          <Separator v-if="state.services.length" />
          <Card v-for="service in state.services" :key="service.id" class="gap-3 py-4">
            <CardHeader class="px-4"><CardTitle>{{ service.name }}</CardTitle><CardDescription>{{ service.status }}</CardDescription></CardHeader>
            <CardContent class="px-4"><FieldGroup><Field orientation="horizontal"><FieldLabel :for="`service-${service.id}`">显示图层</FieldLabel><Switch :id="`service-${service.id}`" v-model="service.visible" @update:model-value="tools.updateService(service.id)" /></Field><MapRangeField v-model="service.opacity" :id="`service-opacity-${service.id}`" label="不透明度" percent @update:model-value="tools.updateService(service.id)" /></FieldGroup></CardContent>
            <CardFooter class="px-4"><Button variant="outline" size="sm" @click="tools.removeService(service.id)">移除服务</Button></CardFooter>
          </Card>
        </template>
      </CardContent>
    </ScrollArea>
    <Dialog :open="featureDetails !== null" @update:open="value => { if (!value) featureDetails = null }">
      <DialogContent v-if="featureDetails" class="max-h-[80vh] overflow-y-auto"><DialogHeader><DialogTitle>{{ featureDetails.name }}</DialogTitle><DialogDescription>{{ featureDetails.type }} · 编号 {{ featureDetails.id }}</DialogDescription></DialogHeader><Table><TableHeader><TableRow><TableHead>属性</TableHead><TableHead>值</TableHead></TableRow></TableHeader><TableBody><TableRow v-for="(value, key) in featureDetails.properties" :key="key"><TableCell>{{ key }}</TableCell><TableCell class="max-w-64 break-all whitespace-normal">{{ typeof value === 'object' ? JSON.stringify(value) : value }}</TableCell></TableRow></TableBody></Table><Button variant="outline" @click="tools.locateRow(featureDetails.key)"><LocateFixed data-icon="inline-start" />定位到要素</Button></DialogContent>
    </Dialog>
  </Card>
</template>
