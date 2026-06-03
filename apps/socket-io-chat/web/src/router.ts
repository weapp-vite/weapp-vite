import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import AxiosView from './views/AxiosView.vue'
import ChatView from './views/ChatView.vue'
import FetchView from './views/FetchView.vue'
import GraphqlView from './views/GraphqlView.vue'

export const routesMeta = [
  {
    path: '/chat',
    label: '聊天',
    title: 'Socket.IO 聊天室',
  },
  {
    path: '/axios',
    label: '联系人',
    title: 'Axios 联系人档案',
  },
  {
    path: '/fetch',
    label: '朋友圈',
    title: 'Fetch 朋友圈动态',
  },
  {
    path: '/graphql',
    label: '洞察',
    title: 'GraphQL 会话洞察',
  },
] as const

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/chat',
  },
  {
    path: '/chat',
    component: ChatView,
    meta: {
      title: 'Socket.IO 聊天室',
    },
  },
  {
    path: '/axios',
    component: AxiosView,
    meta: {
      title: 'Axios 联系人档案',
    },
  },
  {
    path: '/fetch',
    component: FetchView,
    meta: {
      title: 'Fetch 朋友圈动态',
    },
  },
  {
    path: '/graphql',
    component: GraphqlView,
    meta: {
      title: 'GraphQL 会话洞察',
    },
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})
