import { createRouter, createWebHistory } from 'vue-router'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/map',
    },
    {
      path: '/map',
      name: 'map',
      component: () => import('@/views/MapView.vue'),
    },
    {
      path: '/transform',
      name: 'transform',
      component: () => import('@/views/TransformView.vue'),
    },
    {
      path: '/coordinate',
      name: 'coordinate',
      component: () => import('@/views/CoordinateView.vue'),
    },
  ],
})
