<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ShieldCheck } from '@lucide/vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useMapWorkspaceStore } from '@/stores/mapWorkspace'
import TopNavigation from '@/components/navigation/TopNavigation.vue'
import SpreadsheetToGeoJsonPanel from '@/features/transform/SpreadsheetToGeoJsonPanel.vue'
import TransformInputPanel from '@/features/transform/TransformInputPanel.vue'
import TransformOptionsPanel from '@/features/transform/TransformOptionsPanel.vue'
import TransformResultPanel from '@/features/transform/TransformResultPanel.vue'
import { useDataTransform } from '@/features/transform/useDataTransform'

const mode = ref<'spreadsheet' | 'vector'>('spreadsheet')
const {
  sourceText, sourceFormat, targetFormat, sourceProjection, targetProjection, sourceCustomProjection, targetCustomProjection,
  fileName, sourceSize, canConvert, result, resultName, error, message,
  readFile, loadSample, clearInput, convert, copyResult, downloadResult,
} = useDataTransform()
const router = useRouter()
const mapStore = useMapWorkspaceStore()

function loadResultToMap() {
  if (!result.value) return
  mapStore.pendingMapImport = {
    fileName: resultName.value,
    format: targetFormat.value,
    sourceProjection: targetProjection.value,
    sourceCustomProjection: targetCustomProjection.value,
    content: result.value.output,
  }
  void router.push('/map')
}

function loadSpreadsheetResultToMap(payload: { fileName: string; content: string }) {
  mapStore.pendingMapImport = {
    fileName: payload.fileName,
    format: 'GeoJSON',
    sourceProjection: 'EPSG:4326',
    sourceCustomProjection: '',
    content: payload.content,
  }
  void router.push('/map')
}
</script>

<template>
  <main class="transform-page">
    <TopNavigation class="top-nav" />
    <div class="page-content">
      <div class="privacy-line">
        <Badge variant="secondary"><ShieldCheck :size="14" /> 本地处理 · 无需上传服务器</Badge>
        <Badge variant="outline">WGS 84 · GCJ-02 · BD-09 · CGCS2000 · 高斯-克吕格分带</Badge>
      </div>

      <div class="mode-switch" role="tablist" aria-label="数据转换模式">
        <Button
          type="button"
          role="tab"
          :aria-selected="mode === 'spreadsheet'"
          :variant="mode === 'spreadsheet' ? 'default' : 'outline'"
          @click="mode = 'spreadsheet'"
        >表格转 GeoJSON</Button>
        <Button
          type="button"
          role="tab"
          :aria-selected="mode === 'vector'"
          :variant="mode === 'vector' ? 'default' : 'outline'"
          @click="mode = 'vector'"
        >空间格式与坐标转换</Button>
      </div>

      <SpreadsheetToGeoJsonPanel v-if="mode === 'spreadsheet'" @load-to-map="loadSpreadsheetResultToMap" />

      <template v-else>
        <div v-if="error" class="message error-message" role="alert">{{ error }}</div>
        <div v-else-if="message" class="message success-message" role="status">{{ message }}</div>

        <div class="workspace-grid">
          <TransformInputPanel
            v-model:text="sourceText"
            v-model:format="sourceFormat"
            :file-name="fileName"
            :source-size="sourceSize"
            @file-selected="readFile"
            @load-sample="loadSample"
            @clear="clearInput"
          />
          <TransformOptionsPanel
            v-model:target-format="targetFormat"
            v-model:source-projection="sourceProjection"
            v-model:target-projection="targetProjection"
            v-model:source-custom-projection="sourceCustomProjection"
            v-model:target-custom-projection="targetCustomProjection"
            :source-format="sourceFormat"
            :can-convert="canConvert"
            @convert="convert"
          />
          <TransformResultPanel
            :result="result"
            :result-name="resultName"
            :target-projection="targetProjection"
            @copy="copyResult"
            @download="downloadResult"
            @load-to-map="loadResultToMap"
          />
        </div>
      </template>

      <footer class="page-footer"><span>© OMAPKIT STUDIO</span><span>由 openlayers-map-kit 提供格式与投影转换能力</span></footer>
    </div>
  </main>
</template>

<style scoped>
.transform-page { position:relative; min-height:100svh; background:#f3f5f0; color:#353535; }
.transform-page::before { position:absolute; inset:0; pointer-events:none; content:''; opacity:.35; background-image:radial-gradient(#c6c6c6 .6px,transparent .6px); background-size:16px 16px; mask-image:linear-gradient(to bottom,black,transparent 65%); }
.top-nav { position:absolute; z-index:2; top:24px; left:24px; }
.page-content { position:relative; z-index:1; width:min(1920px,100%); margin:0 auto; padding:112px 36px 24px; }
.privacy-line { display:flex; flex-wrap:wrap; align-items:center; gap:8px; margin-bottom:14px; }
.privacy-line [data-slot="badge"] { gap:5px; color:#777777; background:#efefef; border-color:#e0e0e0; font-size:10px; }
.mode-switch { display:flex; max-width:1180px; flex-wrap:wrap; gap:8px; margin:0 auto 16px; }
.mode-switch [role="tab"] { min-height:36px; font-size:11px; }
.message { margin-bottom:16px; padding:10px 14px; border:1px solid; border-radius:9px; font-size:12px; }
.error-message { border-color:#e8cbc7; background:#fff5f3; color:#aa5446; }
.success-message { border-color:#e0e0e0; background:#f6f6f6; color:#6f6f6f; }
.workspace-grid { display:grid; grid-template-columns:minmax(0,1.12fr) minmax(300px,.78fr) minmax(0,1.12fr); align-items:stretch; gap:18px; }
.page-footer { display:flex; justify-content:space-between; gap:12px; padding:25px 1px 0; color:#acacac; font-size:10px; font-weight:700; letter-spacing:.06em; }
:deep(.work-card) { min-height:clamp(620px,calc(100svh - 250px),900px); gap:0; padding:0; border:1px solid #e9e9e9; border-radius:16px; background:rgba(255,255,255,.94); box-shadow:0 13px 44px rgba(51, 51, 51,.055),0 2px 8px rgba(51, 51, 51,.025); }
:deep(.card-heading) { display:flex; align-items:center; gap:11px; min-height:78px; padding:16px 19px; border-bottom:1px solid #edf0eb; }
:deep(.step-number) { display:grid; place-items:center; flex:none; width:31px; height:31px; border-radius:9px; background:#f0f0f0; color:#747474; font-size:11px; font-weight:850; }
:deep(.card-heading h2) { margin:0 0 3px; color:#464646; font-size:14px; font-weight:800; }
:deep(.card-heading p) { margin:0; color:#ababab; font-size:10px; }
:deep(.heading-icon) { margin-left:auto; color:#b5b5b5; }
:deep(.card-body) { padding:19px; }
:deep(.input-card .card-body),:deep(.options-body),:deep(.result-body) { flex:1; }
:deep(.input-card .card-body) { display:flex; flex-direction:column; }
:deep(.source-editor) { min-height:clamp(290px,38vh,520px); }
:deep(.output-editor) { min-height:clamp(230px,36vh,500px); }
@media (max-width:1280px) { .page-content { max-width:1180px; } .workspace-grid { grid-template-columns:minmax(0,1fr) minmax(260px,.78fr); } .workspace-grid > :last-child { grid-column:1/-1; } :deep(.work-card) { min-height:620px; } }
@media (max-width:700px) { .top-nav { top:13px; left:13px; } .page-content { width:100%; padding:84px 14px 25px; } .workspace-grid { grid-template-columns:1fr; } .workspace-grid > :last-child { grid-column:auto; } :deep(.work-card) { min-height:auto; } :deep(.source-editor) { min-height:280px; } .page-footer { flex-direction:column; } }
</style>
