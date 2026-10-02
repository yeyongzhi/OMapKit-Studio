<script setup lang="ts">
import { Field, FieldLabel } from '@/components/ui/field'
import { Slider } from '@/components/ui/slider'
withDefaults(defineProps<{ modelValue: number; id: string; label: string; min?: number; max?: number; step?: number; disabled?: boolean; suffix?: string; percent?: boolean }>(), { min: 0, max: 1, step: .05 })
const emit = defineEmits<{ 'update:modelValue': [value: number] }>()
</script>
<template>
  <Field :data-disabled="disabled || undefined">
    <FieldLabel :for="id" class="justify-between"><span>{{ label }}</span><span>{{ percent ? Math.round(modelValue * 100) : modelValue }}{{ percent ? '%' : suffix }}</span></FieldLabel>
    <Slider :id="id" :thumb-label="label" :model-value="[modelValue]" :min="min" :max="max" :step="step" :disabled="disabled" @update:model-value="emit('update:modelValue', $event?.[0] ?? min)" />
  </Field>
</template>
