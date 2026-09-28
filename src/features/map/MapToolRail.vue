<script setup lang="ts">
import { Layers3, PencilLine, Ruler } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { MapTool } from '@/stores/mapWorkspace'

defineProps<{ activeTool: MapTool }>()
const emit = defineEmits<{ select: [tool: MapTool] }>()

const tools = [
  { id: 'layers', label: '图层', icon: Layers3 },
  { id: 'draw', label: '绘制', icon: PencilLine },
  { id: 'measure', label: '测量', icon: Ruler },
] as const
</script>

<template>
  <Card class="tool-rail" aria-label="地图工具">
    <Button
      v-for="tool in tools"
      :key="tool.id"
      type="button"
      variant="ghost"
      class="tool-button"
      :class="{ active: activeTool === tool.id }"
      :aria-label="tool.label"
      :aria-pressed="activeTool === tool.id"
      :title="tool.label"
      @click="emit('select', tool.id)"
    >
      <component :is="tool.icon" :size="19" :stroke-width="1.9" />
      <span>{{ tool.label }}</span>
    </Button>
  </Card>
</template>

<style scoped>
.tool-rail { display: flex; flex-direction: column; gap: 4px; padding: 6px; border: 1px solid rgba(255,255,255,.76); border-radius: 15px; background: rgba(250,250,248,.86); box-shadow: 0 16px 46px rgba(40, 40, 40,.17); backdrop-filter: blur(22px) saturate(1.4); -webkit-backdrop-filter: blur(22px) saturate(1.4); }
.tool-button { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; width: 47px; height: 50px; border: 0; border-radius: 10px; background: transparent; color: #606060; cursor: pointer; font-size: 9px; font-weight: 700; transition: background .18s, color .18s; }
.tool-button:hover { background: var(--accent); color: var(--accent-foreground); }
.tool-button.active { background: var(--primary); color: var(--primary-foreground); box-shadow: 0 5px 14px rgba(0,0,0,.16); }
.tool-button:focus-visible { outline: 2px solid #6a6a6a; outline-offset: 2px; }
@media (max-width: 640px) { .tool-rail { padding: 5px; } .tool-button { width: 43px; height: 46px; gap: 2px; font-size: 9px; } }
</style>
