<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router'
import { ArrowLeftRight, MapPinned, ScanLine } from '@lucide/vue'
import { Button } from '@/components/ui/button'

const route = useRoute()
</script>

<template>
  <nav class="navigation" aria-label="主导航">
    <Button as-child variant="ghost" class="brand"><RouterLink to="/map" aria-label="OMapKit Studio 地图">
      <span class="brand-mark"><MapPinned :size="19" :stroke-width="2.3" /></span>
      <span class="brand-label">OMAP<span>KIT</span></span>
    </RouterLink></Button>
    <span class="divider" aria-hidden="true" />
    <div class="routes">
      <Button as-child variant="ghost" class="route-link" :class="{ active: route.path === '/map' }"><RouterLink to="/map">
        <MapPinned :size="16" />
        <span>地图</span>
      </RouterLink></Button>
      <Button as-child variant="ghost" class="route-link" :class="{ active: route.path === '/transform' }"><RouterLink to="/transform">
        <ArrowLeftRight :size="16" />
        <span>数据转换</span>
      </RouterLink></Button>
      <Button as-child variant="ghost" class="route-link" :class="{ active: route.path === '/coordinate' }"><RouterLink to="/coordinate">
        <ScanLine :size="16" />
        <span>坐标处理</span>
      </RouterLink></Button>
    </div>
  </nav>
</template>

<style scoped>
.navigation {
  display: flex;
  align-items: center;
  gap: 12px;
  width: max-content;
  max-width: calc(100vw - 32px);
  padding: 7px;
  border: 1px solid rgba(255, 255, 255, .72);
  border-radius: 17px;
  background: rgba(250, 250, 248, .86);
  box-shadow: 0 18px 55px rgba(40, 40, 40, .16), 0 2px 10px rgba(40, 40, 40, .06);
  backdrop-filter: blur(22px) saturate(1.4);
  -webkit-backdrop-filter: blur(22px) saturate(1.4);
}
.brand { display: flex; align-items: center; gap: 9px; padding-left: 6px; color: #2e2e2e; text-decoration: none; white-space: nowrap; }
.brand-mark { display: grid; place-items: center; width: 33px; height: 33px; border-radius: 10px; color: var(--primary-foreground); background: var(--primary); }
.brand-label { font-size: 12px; font-weight: 800; letter-spacing: .075em; }
.brand-label span { color: #6d6d6d; }
.divider { width: 1px; height: 25px; background: #dfdfdf; }
.routes { display: flex; gap: 3px; }
.route-link { display: inline-flex; align-items: center; gap: 7px; height: 36px; padding: 0 13px; border-radius: 10px; color: #606060; font-size: 13px; font-weight: 600; text-decoration: none; white-space: nowrap; transition: background .18s, color .18s; }
.route-link:hover { background: var(--accent); color: var(--accent-foreground); }
.route-link.active { color: var(--primary-foreground); background: var(--primary); box-shadow: 0 4px 12px rgba(0, 0, 0, .14); }
@media (max-width: 560px) {
  .navigation { gap: 7px; padding: 6px; }
  .brand { gap: 6px; padding-left: 3px; }
  .brand-label { display: none; }
  .divider { display: none; }
  .route-link { padding: 0 10px; font-size: 12px; }
}
</style>
