import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'dashboard-home',
    component: () => import('./pages/index.vue'),
  },
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
})
