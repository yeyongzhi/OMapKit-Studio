<script setup lang="ts">
import { computed, onMounted, shallowRef } from 'vue'
import { AlertCircle } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import TopNavigation from '@/components/navigation/TopNavigation.vue'
import MapToolRail from './MapToolRail.vue'
import MapInspector from './MapInspector.vue'
import MapBottomBar from './MapBottomBar.vue'
import { useMapWorkspace } from './useMapWorkspace'

const workspaceElement = shallowRef<HTMLElement | null>(null)
const mapElement = shallowRef<HTMLDivElement | null>(null)
onMounted(() => {
  const workspace = document.querySelector<HTMLElement>('[data-map-workspace]')
  workspaceElement.value = workspace
  mapElement.value = workspace?.querySelector<HTMLDivElement>('[data-map-canvas]') ?? null
})
const workspace = useMapWorkspace(mapElement)
const drawingDialogOpen = computed({
  get: () => workspace.selectedDrawing.value !== null,
  set: (open: boolean) => { if (!open) workspace.selectedDrawing.value = null },
})

function handleFullscreen() {
  if (workspaceElement.value) void workspace.toggleFullscreen(workspaceElement.value)
}

function deleteViewedDrawing() {
  const id = workspace.selectedDrawing.value?.id
  if (!id) return
  workspace.deleteDrawing(id)
  drawingDialogOpen.value = false
}
</script>

<template>
  <main data-map-workspace class="map-workspace">
    <div data-map-canvas class="map-canvas" aria-label="杭州高德地图" />
    <div class="map-tone" aria-hidden="true" />

    <TopNavigation class="top-navigation" />

    <MapToolRail class="tool-position" :active-tool="workspace.store.activeTool" @select="workspace.selectTool" />

    <MapInspector
      v-show="workspace.store.panelOpen"
      class="inspector-position"
      :active-tool="workspace.store.activeTool"
      :drawing-mode="workspace.store.drawingMode"
      :measuring-mode="workspace.store.measuringMode"
      :drawing-count="workspace.drawingCount.value"
      :drawing-enabled="workspace.drawingEnabled.value"
      :drawing-items="workspace.drawingItems.value"
      :selected-drawing-ids="workspace.selectedDrawingIds.value"
      :measure-result="workspace.measureResult.value"
      :base-visible="workspace.store.baseVisible"
      :drawings-visible="workspace.store.drawingsVisible"
      @close="workspace.store.panelOpen = false"
      @select-drawing-mode="workspace.selectDrawingMode"
      @select-measuring-mode="workspace.selectMeasuringMode"
      @set-base-visible="workspace.setBaseVisible"
      @set-drawings-visible="workspace.setDrawingsVisible"
      @finish="workspace.finishCurrent"
      @cancel="workspace.cancelCurrent"
      @clear-drawings="workspace.clearDrawings"
      @clear-measurement="workspace.clearMeasurement"
      @export-drawings="workspace.exportDrawings"
      @start-drawing="workspace.startDrawingNow"
      @stop-drawing="workspace.stopDrawingNow"
      @inspect-drawing="workspace.inspectDrawing"
      @toggle-drawing-selection="workspace.toggleDrawingSelection"
      @select-all-drawings="workspace.selectAllDrawings"
      @delete-drawing="workspace.deleteDrawing"
      @delete-selected-drawings="workspace.deleteDrawings(workspace.selectedDrawingIds.value)"
    />

    <MapBottomBar
      class="bottom-position"
      :panel-open="workspace.store.panelOpen"
      :fullscreen="workspace.fullscreen.value"
      :zoom="workspace.zoomLevel.value"
      :center="workspace.store.center"
      @locate="workspace.locate"
      @screenshot="workspace.screenshot"
      @toggle-fullscreen="handleFullscreen"
      @toggle-panel="workspace.store.panelOpen = !workspace.store.panelOpen"
    />

    <Dialog v-model:open="drawingDialogOpen">
      <DialogContent v-if="workspace.selectedDrawing.value" class="feature-dialog">
        <DialogHeader>
          <DialogTitle>{{ workspace.selectedDrawing.value.label }}</DialogTitle>
          <DialogDescription>{{ workspace.selectedDrawing.value.type }} · {{ workspace.selectedDrawing.value.coordinate }} · EPSG:4326</DialogDescription>
        </DialogHeader>
        <pre class="feature-json">{{ workspace.selectedDrawing.value.geoJson }}</pre>
        <Button variant="destructive" @click="deleteViewedDrawing">删除此要素</Button>
      </DialogContent>
    </Dialog>

    <div v-if="workspace.notice.value" class="map-notice" role="status"><AlertCircle :size="17" />{{ workspace.notice.value }}</div>
    <div v-if="!workspace.ready.value" class="loading-label">正在加载地图工作区…</div>
  </main>
</template>

<style scoped>
.map-workspace { position:relative; width:100%; height:100svh; min-height:520px; overflow:hidden; background:#eaeaea; }
.map-canvas { position:absolute; inset:0; }
.map-tone { position:absolute; inset:0; z-index:1; pointer-events:none; background:linear-gradient(90deg,rgba(48, 48, 48,.055),transparent 29%),linear-gradient(0deg,rgba(43, 43, 43,.08),transparent 25%); }
.top-navigation { position:absolute; z-index:10; left:24px; top:24px; }
.tool-position { position:absolute; z-index:9; top:106px; left:24px; }
.inspector-position { position:absolute; z-index:8; right:24px; top:24px; bottom:76px; width:300px; }
.bottom-position { position:absolute; z-index:10; left:0; right:0; bottom:0; }
.map-notice { position:absolute; z-index:20; left:50%; bottom:104px; display:flex; align-items:center; gap:8px; max-width:calc(100vw - 40px); padding:10px 14px; border:1px solid rgba(255,255,255,.7); border-radius:11px; background:rgba(50, 50, 50,.92); color:white; box-shadow:0 10px 30px rgba(43, 43, 43,.22); font-size:12px; transform:translateX(-50%); }
.loading-label { position:absolute; z-index:2; top:50%; left:50%; padding:12px 18px; border-radius:12px; background:rgba(255,255,255,.85); color:#5f5f5f; font-size:12px; transform:translate(-50%,-50%); }
.feature-dialog { display:flex; flex-direction:column; max-height:min(80vh,680px); }
.feature-json { max-height:52vh; margin:0; padding:14px; overflow:auto; border:1px solid rgba(63, 63, 63,.12); border-radius:10px; background:rgba(246,250,246,.9); color:#4b4b4b; font: .75rem/1.6 ui-monospace,SFMono-Regular,Consolas,monospace; white-space:pre-wrap; overflow-wrap:anywhere; }
@media (max-width:700px) { .top-navigation { top:13px; left:13px; } .tool-position { top:84px; left:13px; } .inspector-position { top:auto; right:13px; bottom:56px; left:66px; width:auto; max-height:min(46vh,390px); } .map-notice { bottom:58px; } }
</style>
