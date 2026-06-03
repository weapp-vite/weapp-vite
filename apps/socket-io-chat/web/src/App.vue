<script setup lang="ts">
import { computed, ref } from 'vue'
import ChatRoom from './components/ChatRoom.vue'
import ContactProfile from './components/ContactProfile.vue'
import ConversationInsights from './components/ConversationInsights.vue'
import MomentsFeed from './components/MomentsFeed.vue'

const pages = [
  {
    id: 'chat',
    label: '聊天',
    title: 'Socket.IO 聊天室',
  },
  {
    id: 'axios',
    label: '联系人',
    title: 'Axios 联系人档案',
  },
  {
    id: 'fetch',
    label: '朋友圈',
    title: 'Fetch 朋友圈动态',
  },
  {
    id: 'graphql',
    label: '洞察',
    title: 'GraphQL 会话洞察',
  },
] as const

type PageId = typeof pages[number]['id']

const activePage = ref<PageId>('chat')
const activeTitle = computed(() => pages.find(page => page.id === activePage.value)?.title ?? pages[0].title)
</script>

<template>
  <main class="app-shell">
    <section class="app-window" :aria-label="activeTitle">
      <nav class="app-nav" aria-label="示例页面">
        <button
          v-for="page in pages"
          :key="page.id"
          class="app-nav__item"
          :class="{ 'app-nav__item--active': activePage === page.id }"
          type="button"
          @click="activePage = page.id"
        >
          {{ page.label }}
        </button>
      </nav>

      <ChatRoom v-if="activePage === 'chat'" />
      <ContactProfile v-else-if="activePage === 'axios'" />
      <MomentsFeed v-else-if="activePage === 'fetch'" />
      <ConversationInsights v-else />
    </section>
  </main>
</template>
