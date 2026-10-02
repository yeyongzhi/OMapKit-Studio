<script setup lang="ts">
import { computed, onMounted, shallowRef, watch } from 'vue'
import { ClipboardCopy, ZoomIn } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Empty, EmptyDescription } from '@/components/ui/empty'
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table'
import { Toaster } from '@/components/ui/sonner'
import { toast } from 'vue-sonner'
import { Card } from '@/components/ui/card'
import TopNavigation from '@/components/navigation/TopNavigation.vue'
import MapToolRail from './MapToolRail.vue'
import MapInspector from './MapInspector.vue'
import MapBottomBar from './MapBottomBar.vue'
import MapToolsPanel from './MapToolsPanel.vue'
import { useMapWorkspace } from './useMapWorkspace'

const workspaceElement = shallowRef<HTMLElement | null>(null)
const mapElement = shallowRef<HTMLDivElement | null>(null)
onMounted(() => {
  const workspace = document.querySelector<HTMLElement>('[data-map-workspace]')
  workspaceElement.value = workspace
  mapElement.value = workspace?.querySelector<HTMLDivElement>('[data-map-canvas]') ?? null
})
const workspace = useMapWorkspace(mapElement)
watch(workspace.notice, value => { if (value) toast(value) })
const toolsMode = computed(() => {
  const tool = workspace.store.activeTool
  return tool === 'select' || tool === 'edit' || tool === 'heatmap' || tool === 'groups' || tool === 'services' ? tool : null
})
const featureDialogOpen = computed({
  get: () => workspace.featurePopup.value !== null,
  set: (open: boolean) => { if (!open) workspace.featurePopup.value = null },
})

function handleFullscreen() {
  if (workspaceElement.value) void workspace.toggleFullscreen(workspaceElement.value)
}

</script>

<template>
  <main data-map-workspace class="map-workspace">
    <div data-map-canvas class="map-canvas" aria-label="地图工作区" />
    <div class="map-tone" aria-hidden="true" />

    <TopNavigation class="top-navigation" />

    <MapToolRail class="tool-position" :active-tool="workspace.store.activeTool" @select="workspace.selectTool" />

    <MapInspector
      v-show="workspace.store.panelOpen && !toolsMode"
      class="inspector-position"
      :active-tool="workspace.store.activeTool"
      :drawing-mode="workspace.store.drawingMode"
      :measuring-mode="workspace.store.measuringMode"
      :drawing-count="workspace.drawingCount.value"
      :drawing-enabled="workspace.drawingEnabled.value"
      :drawing-items="workspace.drawingItems.value"
      :annotations="workspace.store.annotations"
      :map-ready="workspace.ready.value"
      :annotation-pick-mode="workspace.annotationPickMode.value"
      :picked-annotation-coordinate="workspace.pickedAnnotationCoordinate.value"
      :selected-drawing-ids="workspace.selectedDrawingIds.value"
      :measure-result="workspace.measureResult.value"
      :layers="workspace.layerItems.value"
      :import-busy="workspace.importBusy.value"
      :import-reports="workspace.importReports.value"
      :basemap="workspace.store.baseStyle"
      @close="workspace.store.panelOpen = false"
      @set-basemap="workspace.setBasemap"
      @select-drawing-mode="workspace.selectDrawingMode"
      @select-measuring-mode="workspace.selectMeasuringMode"
      @set-layer-visible="workspace.setLayerVisible"
      @set-layer-opacity="workspace.setLayerOpacity"
      @zoom-to-layer="workspace.zoomToLayer"
      @rename-layer="workspace.renameLayer"
      @move-layer="workspace.moveLayer"
      @remove-layer="workspace.removeLayer"
      @import-files="workspace.importFiles"
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
      @save-annotation="workspace.saveAnnotation"
      @delete-annotation="workspace.deleteAnnotation"
      @zoom-to-annotation="workspace.zoomToAnnotation"
      @start-map-pick="workspace.startAnnotationPick"
      @cancel-map-pick="workspace.cancelAnnotationPick"
    />

    <MapToolsPanel
      v-if="toolsMode && workspace.store.panelOpen"
      class="inspector-position tools-position"
      :tools="workspace.tools"
      :mode="toolsMode"
      :ready="workspace.ready.value"
      @select-tool="workspace.selectTool"
      @close="workspace.store.panelOpen = false"
    />

    <MapBottomBar
      class="bottom-position"
      :panel-open="workspace.store.panelOpen"
      :fullscreen="workspace.fullscreen.value"
      :zoom="workspace.zoomLevel.value"
      :center="workspace.store.center"
      :saved-views="workspace.store.savedViews"
      @locate="workspace.locate"
      @screenshot="workspace.screenshot"
      @toggle-fullscreen="handleFullscreen"
      @toggle-panel="workspace.store.panelOpen = !workspace.store.panelOpen"
      @reset-view="workspace.resetView"
      @save-view="workspace.saveView"
      @open-view="workspace.openSavedView"
      @delete-view="workspace.deleteSavedView"
    />

    <Dialog v-model:open="featureDialogOpen">
      <DialogContent v-if="workspace.featurePopup.value" class="feature-dialog">
        <DialogHeader>
          <DialogTitle>{{ workspace.featurePopup.value.geometryType }}</DialogTitle>
          <DialogDescription>{{ workspace.featurePopup.value.layerName }} · {{ workspace.featurePopup.value.coordinate }} · EPSG:4326</DialogDescription>
        </DialogHeader>
        <div class="max-h-[40vh] overflow-auto">
          <Table v-if="workspace.featurePopup.value.properties.length"><TableBody><TableRow v-for="property in workspace.featurePopup.value.properties" :key="property.name"><TableCell class="align-top text-muted-foreground">{{ property.name }}</TableCell><TableCell class="max-w-72 whitespace-pre-wrap break-words">{{ property.value }}</TableCell></TableRow></TableBody></Table>
          <Empty v-else class="border p-4"><EmptyDescription>这个要素没有可显示的属性。</EmptyDescription></Empty>
        </div>
        <div class="feature-actions">
          <Button type="button" variant="outline" size="sm" :disabled="workspace.featurePopup.value.coordinate === '坐标不可用'" @click="workspace.copyFeatureCoordinate"><ClipboardCopy :size="15" />复制坐标</Button>
          <Button type="button" size="sm" :disabled="!workspace.featurePopup.value.extent" @click="workspace.zoomToFeature"><ZoomIn :size="15" />缩放到要素</Button>
        </div>
        <Accordion type="single" collapsible><AccordionItem value="geojson"><AccordionTrigger>查看 GeoJSON</AccordionTrigger><AccordionContent><pre class="feature-json">{{ workspace.featurePopup.value.geoJson }}</pre></AccordionContent></AccordionItem></Accordion>
      </DialogContent>
    </Dialog>

    <Toaster position="bottom-center" :offset="80" />
    <Card v-if="!workspace.ready.value" class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 p-4 text-sm" role="status">正在加载地图工作区…</Card>
  </main>
</template>

<style scoped>
.map-workspace { position:relative; width:100%; height:100svh; min-height:520px; overflow:hidden; background:#eaeaea; }
.map-canvas { position:absolute; inset:0; }
.map-tone { position:absolute; inset:0; z-index:1; pointer-events:none; background:linear-gradient(90deg,rgba(48, 48, 48,.055),transparent 29%),linear-gradient(0deg,rgba(43, 43, 43,.08),transparent 25%); }
.top-navigation { position:absolute; z-index:10; left:24px; top:24px; }
.tool-position { position:absolute; z-index:9; top:106px; left:24px; }
.inspector-position { position:absolute; z-index:8; right:24px; top:24px; bottom:76px; width:360px; }
.tools-position { width:380px; }
.bottom-position { position:absolute; z-index:10; left:0; right:0; bottom:0; }
.map-notice { position:absolute; z-index:20; left:50%; bottom:104px; display:flex; align-items:center; gap:8px; max-width:calc(100vw - 40px); padding:10px 14px; border:1px solid rgba(255,255,255,.7); border-radius:11px; background:rgba(50, 50, 50,.92); color:white; box-shadow:0 10px 30px rgba(43, 43, 43,.22); font-size:12px; transform:translateX(-50%); }
.loading-label { position:absolute; z-index:2; top:50%; left:50%; padding:12px 18px; border-radius:12px; background:rgba(255,255,255,.85); color:#5f5f5f; font-size:12px; transform:translate(-50%,-50%); }
.feature-dialog { display:flex; flex-direction:column; max-height:min(80vh,680px); }
.feature-properties { display:flex; flex-direction:column; max-height:42vh; overflow:auto; border:1px solid rgba(63,63,63,.12); border-radius:10px; background:rgba(255,255,255,.82); }
.feature-property { display:grid; grid-template-columns:minmax(90px,.7fr) minmax(0,1.3fr); gap:12px; padding:9px 12px; border-bottom:1px solid rgba(63,63,63,.08); font-size:12px; line-height:1.45; }
.feature-property:last-child { border-bottom:0; }
.feature-property strong { overflow-wrap:anywhere; color:#777; font-size:11px; }
.feature-property span { overflow-wrap:anywhere; color:#454545; white-space:pre-wrap; }
.feature-property-complex { min-width:0; color:#626262; font-size:11px; }
.feature-property-complex summary { cursor:pointer; }
.feature-property-complex pre { max-height:180px; margin:7px 0 0; padding:9px; overflow:auto; border-radius:7px; background:#f5f7f5; color:#555; font:10px/1.5 ui-monospace,SFMono-Regular,Consolas,monospace; white-space:pre-wrap; overflow-wrap:anywhere; }
.feature-actions { display:flex; justify-content:flex-end; gap:8px; }
.feature-empty-properties { padding:14px; border:1px dashed rgba(63,63,63,.16); border-radius:10px; color:#888; font-size:12px; text-align:center; }
.feature-raw-details { min-height:0; }
.feature-raw-details summary { padding:7px 0; color:#747474; font-size:11px; cursor:pointer; }
.feature-raw-details[open] { min-height:0; }
.feature-raw-details .feature-json { max-height:28vh; }
.feature-json { max-height:52vh; margin:0; padding:14px; overflow:auto; border:1px solid rgba(63, 63, 63,.12); border-radius:10px; background:rgba(246,250,246,.9); color:#4b4b4b; font: .75rem/1.6 ui-monospace,SFMono-Regular,Consolas,monospace; white-space:pre-wrap; overflow-wrap:anywhere; }
@media (max-width:700px) { .top-navigation { top:13px; left:13px; } .tool-position { top:84px; left:13px; } .inspector-position { top:auto; right:13px; bottom:56px; left:66px; width:auto; max-height:min(46vh,390px); } .map-notice { bottom:58px; } }
</style>
