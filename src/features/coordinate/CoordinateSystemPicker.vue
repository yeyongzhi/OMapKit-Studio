<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChevronDown } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { getCoordinateSystemCode, getCoordinateSystemLabel } from './coordinateSystems'

type Category = 'geographic' | 'projected'
type ProjectedKind = 'web-mercator' | 'utm' | 'gauss-kruger' | 'custom'

const props = withDefaults(defineProps<{
  modelValue: string
  customDefinition?: string
  label: string
  disabled?: boolean
  id?: string
}>(), {
  customDefinition: '',
  disabled: false,
  id: undefined,
})
const emit = defineEmits<{
  'update:modelValue': [value: string]
  'update:customDefinition': [value: string]
}>()

const open = ref(false)
const category = ref<Category>('geographic')
const projectedKind = ref<ProjectedKind>('utm')
const draftValue = ref('EPSG:4326')
const customDraft = ref('')
const bandWidth = ref<3 | 6>(3)
const centralMeridian = ref(117)
const utmZone = ref(51)
const hemisphere = ref<'north' | 'south'>('north')

const geographicSystems = [
  { value: 'EPSG:4326', title: 'WGS 84', description: 'EPSG:4326 · 全球常用经纬度' },
  { value: 'GCJ-02', title: 'GCJ-02', description: '国内互联网地图常用坐标' },
  { value: 'BD-09', title: 'BD-09', description: '百度地图坐标' },
  { value: 'EPSG:4490', title: 'CGCS2000', description: 'EPSG:4490 · 国家大地坐标系 2000' },
]
const projectedSystems = [
  { value: 'web-mercator', title: 'Web Mercator', description: '常见网络地图投影，单位为米' },
  { value: 'utm', title: 'WGS 84 / UTM', description: '选择 UTM 带号与南北半球' },
  { value: 'gauss-kruger', title: 'CGCS2000 / 高斯-克吕格', description: '选择 3°带或 6°带及中央经线' },
  { value: 'custom', title: '其他 EPSG / 自定义 PROJ', description: '输入已内置的 EPSG 编号或 PROJ 定义' },
] as const
const meridians = computed(() => {
  const step = bandWidth.value
  const first = step === 3 ? 75 : 75
  return Array.from({ length: Math.floor((135 - first) / step) + 1 }, (_, index) => first + index * step)
})
const currentLabel = computed(() => getCoordinateSystemLabel(props.modelValue, props.customDefinition))
const currentCode = computed(() => getCoordinateSystemCode(props.modelValue, props.customDefinition))
const canApply = computed(() => category.value === 'geographic'
  ? Boolean(draftValue.value)
  : projectedKind.value !== 'custom' || Boolean(customDraft.value.trim()))

function parseCurrentSelection(value: string) {
  const gaussKruger = value.match(/^CGCS2000_GK_([36])_(\d{2,3})$/)
  if (gaussKruger) {
    category.value = 'projected'
    projectedKind.value = 'gauss-kruger'
    bandWidth.value = Number(gaussKruger[1]) as 3 | 6
    centralMeridian.value = Number(gaussKruger[2])
    return
  }
  const utm = value.match(/^EPSG:(326|327)(\d{2})$/)
  if (utm) {
    category.value = 'projected'
    projectedKind.value = 'utm'
    hemisphere.value = utm[1] === '326' ? 'north' : 'south'
    utmZone.value = Number(utm[2])
    return
  }
  if (value === 'EPSG:3857') {
    category.value = 'projected'
    projectedKind.value = 'web-mercator'
    return
  }
  if (value === 'CUSTOM') {
    category.value = 'projected'
    projectedKind.value = 'custom'
    return
  }
  if (geographicSystems.some((system) => system.value === value)) {
    category.value = 'geographic'
    return
  }
  category.value = 'projected'
  projectedKind.value = 'custom'
  customDraft.value = value
}

function openPicker() {
  draftValue.value = props.modelValue
  customDraft.value = props.modelValue === 'CUSTOM' ? props.customDefinition : ''
  parseCurrentSelection(props.modelValue)
  open.value = true
}

function chooseGeographic(value: string) {
  category.value = 'geographic'
  draftValue.value = value
}

function chooseProjected(kind: ProjectedKind) {
  category.value = 'projected'
  projectedKind.value = kind
  updateProjectedDraft()
}

function updateProjectedDraft() {
  if (projectedKind.value === 'web-mercator') {
    draftValue.value = 'EPSG:3857'
  } else if (projectedKind.value === 'utm') {
    const base = hemisphere.value === 'north' ? 32600 : 32700
    draftValue.value = `EPSG:${base + utmZone.value}`
  } else if (projectedKind.value === 'gauss-kruger') {
    draftValue.value = `CGCS2000_GK_${bandWidth.value}_${centralMeridian.value}`
  } else {
    draftValue.value = 'CUSTOM'
  }
}

function applySelection() {
  if (!canApply.value) return
  if (category.value === 'projected') updateProjectedDraft()
  emit('update:modelValue', draftValue.value)
  if (projectedKind.value === 'custom') emit('update:customDefinition', customDraft.value.trim())
  open.value = false
}
</script>

<template>
  <div class="crs-picker">
    <label v-if="label" class="crs-field-label" :for="id">{{ label }}</label>
    <Button
      :id="id"
      type="button"
      variant="outline"
      class="crs-trigger"
      :disabled="disabled"
      :aria-label="`${label}：${currentLabel}，打开坐标系选择`"
      @click="openPicker"
    >
      <span class="crs-trigger-copy">
        <strong>{{ currentLabel }}</strong>
        <small>{{ currentCode }}</small>
      </span>
      <ChevronDown :size="15" />
    </Button>

    <Dialog v-model:open="open">
      <DialogContent class="crs-picker-dialog">
        <DialogHeader class="crs-dialog-header">
          <DialogTitle>选择坐标系</DialogTitle>
          <DialogDescription>按坐标类型选择统一的源或目标参考系。</DialogDescription>
        </DialogHeader>

        <section class="selection-section">
          <h3 class="section-heading">地理坐标系</h3>
          <div class="system-grid">
          <button
            v-for="system in geographicSystems"
            :key="system.value"
            type="button"
            class="system-card"
            :class="{ selected: category === 'geographic' && draftValue === system.value }"
            @click="chooseGeographic(system.value)"
          >
            <strong>{{ system.title }}</strong>
            <span>{{ system.description }}</span>
          </button>
          </div>
        </section>

        <section class="selection-section projected-section">
          <h3 class="section-heading">投影坐标系</h3>
          <div class="projected-layout">
            <div class="projected-grid">
            <button
              v-for="system in projectedSystems"
              :key="system.value"
              type="button"
              class="system-card"
              :class="{ selected: category === 'projected' && projectedKind === system.value }"
              @click="chooseProjected(system.value)"
            >
              <strong>{{ system.title }}</strong>
              <span>{{ system.description }}</span>
            </button>
            </div>

          <div v-if="category === 'projected' && projectedKind === 'utm'" class="projection-config">
            <label>UTM 带号
              <select v-model.number="utmZone" @change="updateProjectedDraft">
                <option v-for="zone in 60" :key="zone" :value="zone">{{ zone }} 带</option>
              </select>
            </label>
            <label>半球
              <select v-model="hemisphere" @change="updateProjectedDraft">
                <option value="north">北半球</option>
                <option value="south">南半球</option>
              </select>
            </label>
          </div>
          <div v-else-if="category === 'projected' && projectedKind === 'gauss-kruger'" class="projection-config">
            <label>分带方式
              <select v-model.number="bandWidth" @change="updateProjectedDraft">
                <option :value="3">3°带</option>
                <option :value="6">6°带</option>
              </select>
            </label>
            <label>中央经线
              <select v-model.number="centralMeridian" @change="updateProjectedDraft">
                <option v-for="longitude in meridians" :key="longitude" :value="longitude">{{ longitude }}°E</option>
              </select>
            </label>
            <p>按 CGCS2000 椭球、高斯-克吕格横轴墨卡托参数计算，输出单位为米。</p>
          </div>
          <div v-else-if="category === 'projected' && projectedKind === 'custom'" class="projection-config custom-config">
            <label for="custom-projection">EPSG 编号或 PROJ 字符串
              <input id="custom-projection" v-model="customDraft" placeholder="例如 EPSG:32650 或 +proj=..." @input="updateProjectedDraft" />
            </label>
          </div>
          <div v-else-if="category === 'projected'" class="projection-config projection-summary">{{ getCoordinateSystemLabel(draftValue) }} · EPSG:3857</div>
          </div>
        </section>

        <DialogFooter class="crs-dialog-footer">
          <Button type="button" variant="outline" @click="open = false">取消</Button>
          <Button type="button" :disabled="!canApply" @click="applySelection">使用此坐标系</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<style scoped>
.crs-picker { display:flex; min-width:0; flex-direction:column; gap:6px; }
.crs-field-label { color:#5b645e; font-size:11px; font-weight:700; }
.crs-trigger { display:flex; width:100%; min-width:0; height:45px; align-items:center; justify-content:space-between; gap:8px; padding:6px 10px; border-color:#e0e4df; background:#fff; color:#4b544e; text-align:left; }
.crs-trigger-copy { display:flex; min-width:0; flex-direction:column; gap:2px; overflow:hidden; }
.crs-trigger-copy strong { overflow:hidden; font-size:11px; font-weight:700; text-overflow:ellipsis; white-space:nowrap; }
.crs-trigger-copy small { overflow:hidden; color:#909891; font-size:9px; font-weight:500; text-overflow:ellipsis; white-space:nowrap; }
.crs-trigger > svg { flex:none; color:#8b948d; }
.crs-picker-dialog { width:min(650px,calc(100vw - 28px)); max-width:650px; max-height:86svh; gap:14px; overflow-y:auto; padding:24px; }
.crs-dialog-header { gap:5px; padding-right:24px; }
.selection-section { display:flex; flex-direction:column; gap:8px; }
.section-heading { margin:0; color:#525b54; font-size:11px; font-weight:800; }
.projected-section { padding-top:12px; border-top:1px solid #eceeeb; }
.system-grid,.projected-grid { display:grid; grid-template-columns:1fr 1fr; gap:9px; }
.system-card { display:flex; min-width:0; min-height:73px; flex-direction:column; align-items:flex-start; justify-content:center; gap:7px; padding:12px 13px; border:1px solid #e4e8e3; border-radius:10px; background:#fff; color:#505951; text-align:left; cursor:pointer; transition:border-color .15s,background .15s,box-shadow .15s; }
.system-card:hover { border-color:#b7c0b8; background:#fafcf9; }
.system-card.selected { border-color:#798c7b; background:#f4f7f3; box-shadow:0 0 0 2px #798c7b16; }
.system-card strong { font-size:12px; font-weight:750; }
.system-card span { color:#89918b; font-size:10px; line-height:1.45; }
.projected-layout { display:flex; flex-direction:column; gap:12px; }
.projection-config { display:grid; grid-template-columns:1fr 1fr; gap:10px; padding:12px; border:1px solid #e7eae6; border-radius:10px; background:#fafbf9; }
.projection-config label { display:flex; min-width:0; flex-direction:column; gap:6px; color:#5e6760; font-size:10px; font-weight:700; }
.projection-config select,.projection-config input { width:100%; height:36px; padding:0 9px; border:1px solid #dde2dc; border-radius:8px; background:#fff; color:#465048; font:inherit; font-size:11px; }
.projection-config p { grid-column:1/-1; margin:0; color:#8a928c; font-size:10px; line-height:1.5; }
.custom-config { grid-template-columns:1fr; }
.projection-summary { display:block; color:#79827b; font-size:11px; }
.crs-dialog-footer { gap:8px; }
@media (max-width:560px) { .crs-picker-dialog { padding:19px; } .system-grid,.projected-grid { grid-template-columns:1fr; } }
</style>
