<script setup lang="ts">
import { ShieldCheck } from '@lucide/vue'
import { Badge } from '@/components/ui/badge'
import TopNavigation from '@/components/navigation/TopNavigation.vue'
import TransformInputPanel from './TransformInputPanel.vue'
import TransformOptionsPanel from './TransformOptionsPanel.vue'
import TransformResultPanel from './TransformResultPanel.vue'
import { useDataTransform } from './useDataTransform'

const {
  sourceText, sourceFormat, targetFormat, sourceProjection, targetProjection,
  fileName, sourceSize, canConvert, result, resultName, error, message,
  readFile, loadSample, clearInput, convert, copyResult, downloadResult,
} = useDataTransform()
</script>

<template>
  <main class="transform-page">
    <TopNavigation class="top-nav" />
    <div class="page-content">
      <div class="privacy-line">
        <Badge variant="secondary"><ShieldCheck :size="14" /> 本地处理 · 无需上传服务器</Badge>
        <Badge variant="outline">支持 EPSG:4326 / EPSG:3857</Badge>
      </div>
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
        />
      </div>

      <footer class="page-footer"><span>© OMAPKIT STUDIO</span><span>由 openlayers-map-kit 提供格式与投影转换能力</span></footer>
    </div>
  </main>
</template>

<style scoped>
.transform-page { position:relative; min-height:100svh; background:#f3f5f0; color:#353535; }
.transform-page::before { position:absolute; inset:0; pointer-events:none; content:''; opacity:.35; background-image:radial-gradient(#c6c6c6 .6px,transparent .6px); background-size:16px 16px; mask-image:linear-gradient(to bottom,black,transparent 65%); }
.top-nav { position:absolute; z-index:2; top:24px; left:24px; }
.page-content { position:relative; z-index:1; max-width:1488px; margin:0 auto; padding:112px 24px 24px; }
.privacy-line { display:flex; flex-wrap:wrap; align-items:center; gap:8px; margin-bottom:18px; }
.privacy-line [data-slot="badge"] { gap:5px; color:#777777; background:#efefef; border-color:#e0e0e0; font-size:10px; }
.message { margin-bottom:16px; padding:10px 14px; border:1px solid; border-radius:9px; font-size:12px; }
.error-message { border-color:#e8cbc7; background:#fff5f3; color:#aa5446; }
.success-message { border-color:#e0e0e0; background:#f6f6f6; color:#6f6f6f; }
.workspace-grid { display:grid; grid-template-columns:minmax(0,1.2fr) minmax(250px,.7fr) minmax(0,1.16fr); align-items:stretch; gap:17px; }
.page-footer { display:flex; justify-content:space-between; gap:12px; padding:25px 1px 0; color:#acacac; font-size:10px; font-weight:700; letter-spacing:.06em; }
:deep(.work-card) { min-height:635px; gap:0; padding:0; border:1px solid #e9e9e9; border-radius:16px; background:rgba(255,255,255,.94); box-shadow:0 13px 44px rgba(51, 51, 51,.055),0 2px 8px rgba(51, 51, 51,.025); }
:deep(.card-heading) { display:flex; align-items:center; gap:11px; min-height:78px; padding:16px 19px; border-bottom:1px solid #edf0eb; }
:deep(.step-number) { display:grid; place-items:center; flex:none; width:31px; height:31px; border-radius:9px; background:#f0f0f0; color:#747474; font-size:11px; font-weight:850; }
:deep(.card-heading h2) { margin:0 0 3px; color:#464646; font-size:14px; font-weight:800; }
:deep(.card-heading p) { margin:0; color:#ababab; font-size:10px; }
:deep(.heading-icon) { margin-left:auto; color:#b5b5b5; }
:deep(.card-body) { padding:19px; }
@media (max-width:1120px) { .workspace-grid { grid-template-columns:minmax(0,1fr) minmax(240px,.7fr); } .workspace-grid > :last-child { grid-column:1/-1; } :deep(.work-card) { min-height:auto; } }
@media (max-width:700px) { .top-nav { top:13px; left:13px; } .page-content { padding:84px 14px 25px; } .workspace-grid { grid-template-columns:1fr; } .workspace-grid > :last-child { grid-column:auto; } .page-footer { flex-direction:column; } }
</style>
