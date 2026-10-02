<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, shallowRef } from 'vue'
import { BookmarkPlus, Camera, Check, Copy, House, LocateFixed, Maximize2, Minimize2, PanelRightClose, PanelRightOpen, Trash2 } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Empty, EmptyDescription } from '@/components/ui/empty'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import type { SavedMapView } from '@/stores/mapWorkspace'

const props = defineProps<{
  panelOpen: boolean
  fullscreen: boolean
  zoom: number
  center: [number, number]
  savedViews: SavedMapView[]
}>()

const emit = defineEmits<{
  locate: [longitude: number, latitude: number]
  screenshot: []
  toggleFullscreen: []
  togglePanel: []
  resetView: []
  saveView: [name: string]
  openView: [id: string]
  deleteView: [id: string]
}>()

const now = shallowRef(new Date())
const showLocation = shallowRef(false)
const showSavedViews = shallowRef(false)
const copiedCenter = shallowRef(false)
const savedViewName = shallowRef('')
const longitude = shallowRef('')
const latitude = shallowRef('')
const inputError = shallowRef('')
let clockTimer: number | undefined
let copyTimer: number | undefined

const dateLabel = computed(() => new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'long',
}).format(now.value))
const timeLabel = computed(() => new Intl.DateTimeFormat('zh-CN', {
  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
}).format(now.value))
const centerLabel = computed(() => `${props.center[0].toFixed(6)}, ${props.center[1].toFixed(6)}`)

async function copyCenter() {
  try {
    await navigator.clipboard.writeText(centerLabel.value)
    copiedCenter.value = true
    window.clearTimeout(copyTimer)
    copyTimer = window.setTimeout(() => { copiedCenter.value = false }, 1600)
  } catch {
    copiedCenter.value = false
  }
}

function openLocation() {
  showLocation.value = true
  showSavedViews.value = false
  if (showLocation.value) {
    longitude.value = props.center[0].toFixed(6)
    latitude.value = props.center[1].toFixed(6)
    inputError.value = ''
  }
}

function toggleSavedViews() {
  showSavedViews.value = true
  showLocation.value = false
  if (showSavedViews.value) savedViewName.value = `视图 ${props.savedViews.length + 1}`
}

function submitSavedView() {
  const name = savedViewName.value.trim()
  if (!name) return
  emit('saveView', name)
  showSavedViews.value = false
}

function submitLocation() {
  const lng = Number(longitude.value)
  const lat = Number(latitude.value)
  if (!longitude.value.trim() || !latitude.value.trim()
    || !Number.isFinite(lng) || !Number.isFinite(lat)
    || lng < -180 || lng > 180 || lat < -90 || lat > 90) {
    inputError.value = '经度范围 -180～180；纬度范围 -90～90。'
    return
  }
  emit('locate', lng, lat)
  showLocation.value = false
}

onMounted(() => { clockTimer = window.setInterval(() => { now.value = new Date() }, 1000) })
onBeforeUnmount(() => {
  window.clearInterval(clockTimer)
  window.clearTimeout(copyTimer)
})
</script>

<template>
  <Card class="flex flex-row items-center justify-between gap-2 rounded-none border-x-0 border-b-0 px-4 py-2 shadow-lg" aria-label="地图底部工具栏">
    <div class="hidden text-xs md:block"><p class="font-semibold">{{ timeLabel }}</p><p class="text-muted-foreground">{{ dateLabel }}</p></div>
    <div class="flex min-w-0 items-center gap-1 text-xs">
      <span class="hidden text-muted-foreground lg:inline">缩放 {{ zoom.toFixed(1) }} · 中心点</span><span class="truncate font-mono">{{ centerLabel }}</span>
      <Button variant="ghost" size="icon" class="size-8 shrink-0" :aria-label="copiedCenter ? '已复制中心经纬度' : '复制中心经纬度'" @click="copyCenter"><Check v-if="copiedCenter" class="size-4" /><Copy v-else class="size-4" /></Button>
    </div>
    <div class="flex shrink-0 items-center gap-1">
      <Button variant="ghost" size="icon" class="size-8" aria-label="回到默认视图" @click="emit('resetView')"><House class="size-4" /></Button>
      <Popover v-model:open="showSavedViews">
        <PopoverTrigger as-child><Button variant="ghost" size="icon" class="size-8" aria-label="视图收藏" @click="toggleSavedViews"><BookmarkPlus class="size-4" /></Button></PopoverTrigger>
        <PopoverContent side="top" align="end" class="w-80 max-w-[calc(100vw-24px)] space-y-4">
          <p class="font-semibold">视图收藏</p>
          <form @submit.prevent="submitSavedView"><FieldGroup><Field><FieldLabel for="saved-view-name">视图名称</FieldLabel><Input id="saved-view-name" v-model="savedViewName" maxlength="40" placeholder="输入视图名称" /></Field><Button type="submit" size="sm" :disabled="!savedViewName.trim()">保存当前视图</Button></FieldGroup></form>
          <div v-if="savedViews.length" class="max-h-60 space-y-2 overflow-y-auto">
            <div v-for="view in savedViews" :key="view.id" class="flex items-center gap-1 rounded-lg border p-1">
              <Button variant="ghost" class="h-auto min-w-0 flex-1 justify-start text-left" @click="emit('openView', view.id); showSavedViews = false"><span class="min-w-0"><span class="block truncate">{{ view.name }}</span><span class="block truncate text-xs text-muted-foreground">{{ view.center[0].toFixed(4) }}, {{ view.center[1].toFixed(4) }} · {{ view.zoom.toFixed(1) }}</span></span></Button>
              <Button variant="ghost" size="icon" :aria-label="`删除${view.name}`" @click="emit('deleteView', view.id)"><Trash2 class="size-4" /></Button>
            </div>
          </div>
          <Empty v-else class="p-3"><EmptyDescription>还没有收藏的地图视图。</EmptyDescription></Empty>
        </PopoverContent>
      </Popover>
      <Separator orientation="vertical" class="h-5" />
      <Popover v-model:open="showLocation">
        <PopoverTrigger as-child><Button variant="ghost" size="icon" class="size-8" aria-label="经纬度定位" @click="openLocation"><LocateFixed class="size-4" /></Button></PopoverTrigger>
        <PopoverContent side="top" align="end" class="w-80 max-w-[calc(100vw-24px)] space-y-4">
          <p class="font-semibold">经纬度定位</p><p class="text-xs text-muted-foreground">输入 WGS 84 经纬度前往目标位置。</p>
          <form @submit.prevent="submitLocation"><FieldGroup>
            <div class="grid grid-cols-2 gap-3"><Field><FieldLabel for="longitude">经度</FieldLabel><Input id="longitude" v-model="longitude" inputmode="decimal" /></Field><Field><FieldLabel for="latitude">纬度</FieldLabel><Input id="latitude" v-model="latitude" inputmode="decimal" /></Field></div>
            <Alert v-if="inputError" variant="destructive"><AlertDescription>{{ inputError }}</AlertDescription></Alert>
            <Button type="submit">定位到坐标</Button>
          </FieldGroup></form>
        </PopoverContent>
      </Popover>
      <Button variant="ghost" size="icon" class="size-8" aria-label="只截地图" @click="emit('screenshot')"><Camera class="size-4" /></Button>
      <Button variant="ghost" size="icon" class="size-8" :aria-label="fullscreen ? '退出全屏' : '全屏'" @click="emit('toggleFullscreen')"><Minimize2 v-if="fullscreen" class="size-4" /><Maximize2 v-else class="size-4" /></Button>
      <Button variant="ghost" size="icon" class="size-8" :aria-label="panelOpen ? '收起面板' : '展开面板'" @click="emit('togglePanel')"><PanelRightClose v-if="panelOpen" class="size-4" /><PanelRightOpen v-else class="size-4" /></Button>
    </div>
  </Card>
</template>
