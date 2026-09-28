<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, shallowRef } from 'vue'
import { Camera, Check, Copy, LocateFixed, Maximize2, Minimize2, PanelRightClose, PanelRightOpen, X } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const props = defineProps<{
  panelOpen: boolean
  fullscreen: boolean
  zoom: number
  center: [number, number]
}>()

const emit = defineEmits<{
  locate: [longitude: number, latitude: number]
  screenshot: []
  toggleFullscreen: []
  togglePanel: []
}>()

const now = shallowRef(new Date())
const showLocation = shallowRef(false)
const copiedCenter = shallowRef(false)
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
  showLocation.value = !showLocation.value
  if (showLocation.value) {
    longitude.value = props.center[0].toFixed(6)
    latitude.value = props.center[1].toFixed(6)
    inputError.value = ''
  }
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
  <Card class="bottom-bar" aria-label="地图底部工具栏">
    <div class="date-area">
      <span class="date-copy"><strong>{{ timeLabel }}</strong><small>{{ dateLabel }}</small></span>
    </div>
    <div class="center-readout" aria-label="地图中心经纬度">
      <span class="zoom-readout">ZOOM {{ zoom.toFixed(1) }}</span>
      <span class="readout-divider" aria-hidden="true">·</span>
      <span class="coordinate-label">中心点</span>
      <strong>{{ centerLabel }}</strong>
      <Button type="button" variant="ghost" size="icon" class="copy-coordinate" :title="copiedCenter ? '已复制' : '复制中心经纬度'" :aria-label="copiedCenter ? '已复制中心经纬度' : '复制中心经纬度'" @click="copyCenter">
        <Check v-if="copiedCenter" :size="15" /><Copy v-else :size="15" />
      </Button>
    </div>
    <div class="toolbar-actions">
      <div class="location-anchor">
        <Button type="button" variant="ghost" size="icon" class="action-button" title="经纬度定位" aria-label="经纬度定位" :aria-expanded="showLocation" @click="openLocation"><LocateFixed :size="19" /></Button>
        <div v-if="showLocation" class="location-popover">
          <div class="popover-heading"><strong>经纬度定位</strong><Button type="button" variant="ghost" size="icon" aria-label="关闭定位" @click="showLocation = false"><X :size="16" /></Button></div>
          <p>输入 WGS84 经纬度，快速前往目标位置。</p>
          <div class="coordinate-fields">
            <div><Label for="longitude">经度 (Lng)</Label><Input id="longitude" v-model="longitude" inputmode="decimal" placeholder="120.155100" /></div>
            <div><Label for="latitude">纬度 (Lat)</Label><Input id="latitude" v-model="latitude" inputmode="decimal" placeholder="30.274100" /></div>
          </div>
          <span v-if="inputError" class="input-error">{{ inputError }}</span>
          <Button class="w-full" size="sm" @click="submitLocation">定位到坐标</Button>
        </div>
      </div>
      <span class="toolbar-divider" />
      <Button type="button" variant="ghost" size="icon" class="action-button" title="只截地图" aria-label="只截地图" @click="emit('screenshot')"><Camera :size="19" /></Button>
      <Button type="button" variant="ghost" size="icon" class="action-button" :title="fullscreen ? '退出全屏' : '全屏'" :aria-label="fullscreen ? '退出全屏' : '全屏'" @click="emit('toggleFullscreen')"><Minimize2 v-if="fullscreen" :size="19" /><Maximize2 v-else :size="19" /></Button>
      <Button type="button" variant="ghost" size="icon" class="action-button" :title="panelOpen ? '收起面板' : '展开面板'" :aria-label="panelOpen ? '收起面板' : '展开面板'" @click="emit('togglePanel')"><PanelRightClose v-if="panelOpen" :size="19" /><PanelRightOpen v-else :size="19" /></Button>
    </div>
  </Card>
</template>

<style scoped>
.bottom-bar { display:flex; flex-direction:row; align-items:center; justify-content:space-between; min-height:50px; gap:12px; padding:4px max(20px,env(safe-area-inset-right)) max(4px,env(safe-area-inset-bottom)) max(20px,env(safe-area-inset-left)); border:0; border-top:1px solid rgba(255,255,255,.8); border-radius:0; background:rgba(250,251,249,.89); box-shadow:0 -8px 30px rgba(40, 40, 40,.12); backdrop-filter:blur(22px) saturate(1.4); -webkit-backdrop-filter:blur(22px) saturate(1.4); color:#363636; }
.date-area { display:flex; align-items:center; gap:9px; min-width:170px; }
.date-copy { display:flex; flex-direction:column; gap:2px; }
.date-copy strong { font-size:12px; font-weight:800; font-variant-numeric:tabular-nums; line-height:1.1; }
.date-copy small { color:#969696; font-size:9px; }
.center-readout { display:flex; align-items:center; justify-content:center; gap:8px; color:#686868; font-size:11px; font-weight:700; white-space:nowrap; }
.coordinate-label { color:#919191; font-size:10px; font-weight:600; }
.center-readout strong { color:#545454; font-size:11px; font-variant-numeric:tabular-nums; letter-spacing:.02em; }
.copy-coordinate { width:27px; height:27px; color:#777777; }
.zoom-readout { color:#a6a6a6; font-size:10px; letter-spacing:.06em; }
.readout-divider { color:#cdcdcd; }
.toolbar-actions { display:flex; align-items:center; gap:3px; }
.action-button { width:34px; height:34px; color:#666666; transition:background .18s,color .18s; }
.action-button:hover,.action-button:focus-visible { background:#ededed; color:#595959; outline:none; }
.toolbar-divider { width:1px; height:21px; margin:0 5px; background:#e0e0e0; }
.location-anchor { position:relative; }
.location-popover { position:absolute; right:-20px; bottom:calc(100% + 17px); width:290px; padding:17px; border:1px solid #e7e7e7; border-radius:16px; background:rgba(252,253,251,.97); box-shadow:0 15px 55px rgba(43, 43, 43,.2); backdrop-filter:blur(22px); }
.popover-heading { display:flex; justify-content:space-between; align-items:center; font-size:14px; }
.popover-heading button { color:#939393; }
.location-popover p { margin:5px 0 15px; color:#8d8d8d; font-size:11px; }
.coordinate-fields { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:12px; }
.coordinate-fields > div { display:flex; flex-direction:column; gap:6px; min-width:0; }
.coordinate-fields [data-slot="label"] { color:#686868; font-size:10px; font-weight:700; }
.coordinate-fields input { min-width:0; font-size:11px; }
.input-error { display:block; margin:-4px 0 10px; color:#b04942; font-size:10px; }
@media (max-width:700px) { .bottom-bar { min-height:46px; gap:6px; padding:4px 13px max(4px,env(safe-area-inset-bottom)); } .date-area { min-width:0; gap:6px; } .date-copy strong { font-size:11px; } .date-copy small { font-size:8px; } .center-readout { gap:4px; font-size:9px; } .center-readout strong { font-size:9px; } .coordinate-label,.zoom-readout,.readout-divider { display:none; } .copy-coordinate { width:24px; height:24px; } .action-button { width:32px; height:32px; } }
@media (max-width:400px) { .bottom-bar { padding-right:7px; padding-left:7px; } .date-copy small { display:none; } .date-copy strong { font-size:10px; } .toolbar-actions { gap:0; } .toolbar-divider { margin:0 2px; } .action-button { width:27px; } .center-readout { gap:2px; } .center-readout strong { font-size:8px; } .location-popover { right:-140px; width:min(290px,calc(100vw - 28px)); } }
</style>
