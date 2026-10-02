<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChevronDown } from '@lucide/vue'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import MapChoiceField from '@/features/map/MapChoiceField.vue'
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
  <Field>
    <FieldLabel v-if="label" :for="id">{{ label }}</FieldLabel>
    <Button :id="id" type="button" variant="outline" class="h-auto w-full justify-between py-3 text-left" :disabled="disabled" :aria-label="`${label}：${currentLabel}，打开坐标系选择`" @click="openPicker"><span class="min-w-0"><span class="block truncate">{{ currentLabel }}</span><span class="block text-xs text-muted-foreground">{{ currentCode }}</span></span><ChevronDown class="size-4 shrink-0" /></Button>
    <Dialog v-model:open="open">
      <DialogContent class="max-h-[85svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>选择坐标系</DialogTitle><DialogDescription>选择源或目标数据使用的参考系。</DialogDescription></DialogHeader>
        <FieldGroup>
          <Field><FieldLabel>地理坐标系</FieldLabel><div class="grid grid-cols-2 gap-2">
            <Button v-for="system in geographicSystems" :key="system.value" :variant="category === 'geographic' && draftValue === system.value ? 'secondary' : 'outline'" class="h-auto items-start whitespace-normal p-3 text-left" @click="chooseGeographic(system.value)"><span><span class="block">{{ system.title }}</span><span class="block text-xs font-normal text-muted-foreground">{{ system.description }}</span></span></Button>
          </div></Field>
          <Field><FieldLabel>投影坐标系</FieldLabel><div class="grid grid-cols-2 gap-2">
            <Button v-for="system in projectedSystems" :key="system.value" :variant="category === 'projected' && projectedKind === system.value ? 'secondary' : 'outline'" class="h-auto items-start whitespace-normal p-3 text-left" @click="chooseProjected(system.value)"><span><span class="block">{{ system.title }}</span><span class="block text-xs font-normal text-muted-foreground">{{ system.description }}</span></span></Button>
          </div></Field>
          <template v-if="category === 'projected' && projectedKind === 'utm'">
            <MapChoiceField id="utm-zone" label="UTM 带号" :model-value="String(utmZone)" :options="Array.from({ length: 60 }, (_, index) => ({ value: String(index + 1), label: `${index + 1} 带` }))" @update:model-value="utmZone = Number($event); updateProjectedDraft()" />
            <MapChoiceField id="utm-hemisphere" label="半球" :model-value="hemisphere" :options="[{ value: 'north', label: '北半球' }, { value: 'south', label: '南半球' }]" @update:model-value="hemisphere = $event as 'north' | 'south'; updateProjectedDraft()" />
          </template>
          <template v-else-if="category === 'projected' && projectedKind === 'gauss-kruger'">
            <MapChoiceField id="gk-width" label="分带方式" :model-value="String(bandWidth)" :options="[{ value: '3', label: '3°带' }, { value: '6', label: '6°带' }]" @update:model-value="bandWidth = Number($event) as 3 | 6; if (!meridians.includes(centralMeridian)) centralMeridian = meridians[0]!; updateProjectedDraft()" />
            <MapChoiceField id="gk-meridian" label="中央经线" :model-value="String(centralMeridian)" :options="meridians.map(value => ({ value: String(value), label: `${value}°E` }))" @update:model-value="centralMeridian = Number($event); updateProjectedDraft()" />
          </template>
          <Field v-else-if="category === 'projected' && projectedKind === 'custom'"><FieldLabel for="custom-projection">EPSG 编号或 PROJ 字符串</FieldLabel><Input id="custom-projection" v-model="customDraft" placeholder="EPSG:32650 或 +proj=..." @input="updateProjectedDraft" /></Field>
        </FieldGroup>
        <DialogFooter><Button variant="outline" @click="open = false">取消</Button><Button :disabled="!canApply" @click="applySelection">使用此坐标系</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </Field>
</template>
