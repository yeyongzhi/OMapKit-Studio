<script setup lang="ts">
import { FileUp, Layers3, MapPin, PencilLine, Ruler, MousePointer2, SquarePen, Flame, FolderTree, Globe } from '@lucide/vue'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { MapTool } from '@/stores/mapWorkspace'
defineProps<{ activeTool: MapTool }>()
const emit = defineEmits<{ select: [tool: MapTool] }>()
const tools = [
  { id: 'layers', label: '图层', icon: Layers3 }, { id: 'import', label: '导入', icon: FileUp },
  { id: 'draw', label: '绘制', icon: PencilLine }, { id: 'annotations', label: '标注', icon: MapPin },
  { id: 'measure', label: '测量', icon: Ruler }, { id: 'select', label: '属性', icon: MousePointer2 },
  { id: 'edit', label: '编辑', icon: SquarePen }, { id: 'heatmap', label: '热力', icon: Flame },
  { id: 'groups', label: '分组', icon: FolderTree }, { id: 'services', label: '服务', icon: Globe },
] as const
function select(value: unknown) { if (tools.some(tool => tool.id === value)) emit('select', value as MapTool) }
</script>
<template>
  <Card class="gap-0 py-0 shadow-lg" aria-label="地图工具">
    <CardHeader class="sr-only"><CardTitle>地图工具</CardTitle></CardHeader>
    <CardContent class="max-h-[calc(100svh-180px)] overflow-y-auto p-1.5">
      <TooltipProvider>
        <ToggleGroup type="single" :model-value="activeTool" orientation="vertical" class="flex-col gap-1" @update:model-value="select">
          <Tooltip v-for="tool in tools" :key="tool.id">
            <TooltipTrigger as-child><ToggleGroupItem :value="tool.id" :aria-label="tool.label" class="h-12 w-11 shrink-0 flex-col gap-1"><component :is="tool.icon" /><span class="text-[10px]">{{ tool.label }}</span></ToggleGroupItem></TooltipTrigger>
            <TooltipContent side="right">{{ tool.label }}</TooltipContent>
          </Tooltip>
        </ToggleGroup>
      </TooltipProvider>
    </CardContent>
  </Card>
</template>
