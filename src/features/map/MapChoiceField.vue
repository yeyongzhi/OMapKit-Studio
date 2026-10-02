<script setup lang="ts">
import { Field, FieldLabel, FieldDescription } from '@/components/ui/field'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
defineProps<{ modelValue: string; id: string; label: string; options: { value: string; label: string }[]; disabled?: boolean; description?: string; placeholder?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
</script>
<template>
  <Field :data-disabled="disabled || undefined">
    <FieldLabel :for="id">{{ label }}</FieldLabel>
    <Select :model-value="modelValue || undefined" :disabled="disabled" @update:model-value="emit('update:modelValue', String($event))">
      <SelectTrigger :id="id" class="w-full"><SelectValue :placeholder="placeholder ?? '请选择'" /></SelectTrigger>
      <SelectContent><SelectGroup><SelectItem v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</SelectItem></SelectGroup></SelectContent>
    </Select>
    <FieldDescription v-if="description">{{ description }}</FieldDescription>
  </Field>
</template>
