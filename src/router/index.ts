import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router'

const history = import.meta.env.PROD && import.meta.env.BASE_URL !== '/'
  ? createWebHashHistory(import.meta.env.BASE_URL)
  : createWebHistory(import.meta.env.BASE_URL)

export const router = createRouter({
  history,
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
