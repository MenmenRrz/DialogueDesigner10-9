import { createWebHashHistory, createRouter, type RouteRecordRaw } from 'vue-router'
import Layout from '@/layout/index.vue'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: Layout,
    redirect: 'import',
    children: [
      {
        path: 'import',
        name: 'Import',
        component: () => import(/* webpackChunkName: "import" */ '@/views/designer/Import.vue'),
      },
      {
        path: 'convert',
        name: 'Convert',
        component: () => import(/* webpackChunkName: "convert" */ '@/views/designer/Convert.vue'),
      },
      {
        path: 'admin',
        name: 'AdminMonitor',
        component: () => import(/* webpackChunkName: "admin" */ '@/views/admin/Monitor.vue'),
      },
    ],
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

export default router
