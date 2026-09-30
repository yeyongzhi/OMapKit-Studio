<script setup lang="ts">
import { ArrowDown, ArrowRight, Filter, Plus, X } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import type { useSpreadsheetGeoJson } from './useSpreadsheetGeoJson'

const props = defineProps<{ state: ReturnType<typeof useSpreadsheetGeoJson> }>()
const {
  headers, geometryKind, fieldCase, selectedProperties, filterRuleData,
  longitudeField, latitudeField, startLongitudeField, startLatitudeField, endLongitudeField, endLatitudeField,
  setGeometryKind, addFilter, removeFilter, setFilterField, toggleFilterValue,
  selectAllProperties, selectNoProperties, invertProperties,
} = props.state

function onFilterFieldChange(id: number, event: Event) {
  setFilterField(id, (event.target as HTMLSelectElement).value)
}
</script>

<template>
  <Card class="work-card options-card spreadsheet-options" aria-labelledby="spreadsheet-options-heading">
    <header class="card-heading">
      <div class="step-number">02</div>
      <div><h2 id="spreadsheet-options-heading">转换设置</h2><p>选择几何类型、坐标字段与导出属性</p></div>
      <Filter class="heading-icon" :size="19" />
    </header>

    <div class="card-body spreadsheet-options-body">
      <div class="flow-label">CONVERSION FLOW</div>
      <div class="flow-diagram">
        <div><span>FROM</span><strong>表格行</strong></div>
        <ArrowRight class="flow-arrow" :size="18" />
        <div><span>TO</span><strong>GeoJSON</strong></div>
      </div>

      <section class="option-section">
        <div class="section-title">几何类型</div>
        <div class="geometry-options">
          <Button type="button" size="sm" :variant="geometryKind === 'Point' ? 'default' : 'outline'" @click="setGeometryKind('Point')">点（Point）</Button>
          <Button type="button" size="sm" :variant="geometryKind === 'LineString' ? 'default' : 'outline'" @click="setGeometryKind('LineString')">线（LineString）</Button>
        </div>
      </section>

      <section class="option-section">
        <div class="section-title">坐标字段 <span>WGS 84 经纬度</span></div>
        <div v-if="geometryKind === 'Point'" class="coordinate-fields">
          <div class="form-field">
            <Label for="spreadsheet-longitude">经度字段</Label>
            <select id="spreadsheet-longitude" v-model="longitudeField" :disabled="!headers.length">
              <option value="">— 请选择 —</option>
              <option v-for="field in headers" :key="'lon-' + field" :value="field">{{ field }}</option>
            </select>
          </div>
          <div class="form-field">
            <Label for="spreadsheet-latitude">纬度字段</Label>
            <select id="spreadsheet-latitude" v-model="latitudeField" :disabled="!headers.length">
              <option value="">— 请选择 —</option>
              <option v-for="field in headers" :key="'lat-' + field" :value="field">{{ field }}</option>
            </select>
          </div>
        </div>
        <div v-else class="coordinate-fields">
          <div class="form-field"><Label for="spreadsheet-start-lon">起点经度</Label><select id="spreadsheet-start-lon" v-model="startLongitudeField" :disabled="!headers.length"><option value="">— 请选择 —</option><option v-for="field in headers" :key="'start-lon-' + field" :value="field">{{ field }}</option></select></div>
          <div class="form-field"><Label for="spreadsheet-start-lat">起点纬度</Label><select id="spreadsheet-start-lat" v-model="startLatitudeField" :disabled="!headers.length"><option value="">— 请选择 —</option><option v-for="field in headers" :key="'start-lat-' + field" :value="field">{{ field }}</option></select></div>
          <div class="form-field"><Label for="spreadsheet-end-lon">终点经度</Label><select id="spreadsheet-end-lon" v-model="endLongitudeField" :disabled="!headers.length"><option value="">— 请选择 —</option><option v-for="field in headers" :key="'end-lon-' + field" :value="field">{{ field }}</option></select></div>
          <div class="form-field"><Label for="spreadsheet-end-lat">终点纬度</Label><select id="spreadsheet-end-lat" v-model="endLatitudeField" :disabled="!headers.length"><option value="">— 请选择 —</option><option v-for="field in headers" :key="'end-lat-' + field" :value="field">{{ field }}</option></select></div>
        </div>
      </section>

      <section class="option-section">
        <div class="section-title">筛选条件 <span>多个值为 OR，多个条件为 AND</span></div>
        <div v-if="filterRuleData.length" class="filter-list">
          <div v-for="rule in filterRuleData" :key="rule.id" class="filter-rule">
            <div class="filter-top-row">
              <select :value="rule.field" :disabled="!headers.length" :aria-label="'筛选条件 ' + rule.id + ' 字段选择'" @change="onFilterFieldChange(rule.id, $event)">
                <option value="">选择字段</option>
                <option v-for="field in headers" :key="field" :value="field">{{ field }}</option>
              </select>
              <Button type="button" variant="ghost" size="sm" :disabled="!headers.length" :aria-label="'删除筛选条件 ' + rule.id" @click="removeFilter(rule.id)"><X :size="14" /></Button>
            </div>
            <div v-if="rule.options.length" class="value-options">
              <button v-for="value in rule.options" :key="value" type="button" class="value-chip" :class="{ selected: rule.values.includes(value) }" :aria-pressed="rule.values.includes(value)" @click="toggleFilterValue(rule.id, value)">{{ value }}</button>
            </div>
            <p v-else class="empty-hint">{{ rule.field ? '该字段没有非空值。' : '选择字段后勾选需要保留的值。' }}</p>
            <small class="filter-count">{{ rule.values.length ? '已选 ' + rule.values.length + ' 个值 · 命中 ' + rule.matchingRows + ' 行' : '未选择值，此条件暂不生效' }}</small>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" :disabled="!headers.length" @click="addFilter"><Plus data-icon="inline-start" />添加筛选条件</Button>
      </section>

      <section class="option-section property-section">
        <div class="section-title">导出属性 <span>已选 {{ selectedProperties.length }} / {{ headers.length }}</span></div>
        <div class="property-actions">
          <button type="button" :disabled="!headers.length" @click="selectAllProperties">全选</button>
          <button type="button" :disabled="!headers.length" @click="selectNoProperties">全不选</button>
          <button type="button" :disabled="!headers.length" @click="invertProperties">反选</button>
        </div>
        <div class="property-list">
          <label v-for="field in headers" :key="field" class="property-option"><input v-model="selectedProperties" type="checkbox" :value="field" :disabled="!headers.length"><span>{{ field }}</span></label>
          <span v-if="!headers.length" class="empty-hint">上传表格后选择要保留的属性字段。</span>
        </div>
        <div class="form-field field-case"><Label for="spreadsheet-field-case">字段名格式</Label><select id="spreadsheet-field-case" v-model="fieldCase" :disabled="!headers.length"><option value="preserve">保持原样</option><option value="upper">全大写</option><option value="lower">全小写</option></select></div>
      </section>
      <p class="local-note"><ArrowDown :size="13" />坐标按经度、纬度顺序写入 GeoJSON；无效坐标行会跳过。</p>
    </div>
  </Card>
</template>

<style scoped>
.spreadsheet-options { min-width:0; }
.spreadsheet-options-body { display:flex; flex-direction:column; gap:15px; }
.flow-label { color:#9f9f9f; font-size:9px; font-weight:800; letter-spacing:.14em; }
.flow-diagram { display:flex; align-items:center; justify-content:space-between; gap:9px; padding:12px 10px; border:1px solid #e7e7e7; border-radius:11px; background:#f7f7f7; }
.flow-diagram > div { display:flex; min-width:0; flex-direction:column; gap:4px; }
.flow-diagram span { color:#9e9e9e; font-size:9px; font-weight:800; letter-spacing:.11em; }
.flow-diagram strong { overflow:hidden; color:#5b5b5b; font-size:11px; text-overflow:ellipsis; }
.flow-arrow { flex:none; color:#979797; }
.option-section { display:flex; flex-direction:column; gap:9px; padding-bottom:14px; border-bottom:1px solid #ececec; }
.section-title { display:flex; flex-wrap:wrap; align-items:baseline; justify-content:space-between; gap:5px; color:#595959; font-size:11px; font-weight:800; }
.section-title span { color:#a0a0a0; font-size:9px; font-weight:500; }
.geometry-options { display:flex; gap:7px; }
.geometry-options button { flex:1; font-size:10px; }
.coordinate-fields { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:9px; }
.form-field { display:flex; min-width:0; flex-direction:column; gap:5px; }
.form-field :deep(label) { color:#6f6f6f; font-size:10px; }
.form-field select,.filter-top-row select { width:100%; min-width:0; height:34px; padding:0 9px; border:1px solid #e3e3e3; border-radius:8px; background:#fff; color:#414141; font-size:10px; }
.filter-list { display:flex; flex-direction:column; gap:8px; }
.filter-rule { display:flex; flex-direction:column; gap:8px; padding:9px; border:1px solid #ececec; border-radius:9px; background:#fafafa; }
.filter-top-row { display:flex; align-items:center; gap:6px; }
.filter-top-row select { flex:1; }
.filter-top-row button { width:29px; height:29px; }
.value-options { display:flex; flex-wrap:wrap; gap:5px; max-height:76px; overflow:auto; }
.value-chip { padding:4px 8px; border:1px solid #e3e3e3; border-radius:999px; background:#fff; color:#696969; font-size:9px; cursor:pointer; }
.value-chip.selected { border-color:#858585; background:#ededed; color:#454545; }
.empty-hint,.filter-count { margin:0; color:#999; font-size:9px; line-height:1.5; }
.property-actions { display:flex; gap:10px; }
.property-actions button { padding:0; border:0; background:none; color:#777; font-size:9px; text-decoration:underline; cursor:pointer; }
.property-actions button:disabled { color:#bbb; cursor:not-allowed; }
.property-list { display:grid; max-height:105px; grid-template-columns:repeat(2,minmax(0,1fr)); gap:5px; overflow:auto; }
.property-option { display:flex; min-width:0; align-items:center; gap:6px; padding:5px 7px; border:1px solid #ededed; border-radius:7px; color:#636363; font-size:9px; }
.property-option span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.field-case { display:grid; grid-template-columns:auto minmax(0,1fr); align-items:center; gap:10px; }
.local-note { display:flex; align-items:center; gap:5px; margin:0; color:#9c9c9c; font-size:9px; line-height:1.5; }
@media (max-width:1050px) { .property-list { max-height:150px; } }
</style>
