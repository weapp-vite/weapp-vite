<script setup lang="ts">
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { routesMeta } from './router'

const route = useRoute()
</script>

<template>
  <main class="flex min-h-dvh items-center justify-center bg-[#d8d8d8] bg-[linear-gradient(rgba(255,255,255,0.4),rgba(255,255,255,0.1))] p-6 max-[520px]:p-0">
    <section
      class="flex h-[min(780px,calc(100vh-48px))] min-h-[580px] w-[min(100%,430px)] flex-col overflow-hidden rounded-lg border border-black/10 bg-[#ededed] shadow-[0_18px_60px_rgba(0,0,0,0.18)] max-[520px]:h-dvh max-[520px]:min-h-dvh max-[520px]:w-full max-[520px]:rounded-none max-[520px]:border-0"
      :aria-label="String(route.meta.title ?? 'Socket.IO 聊天示例')"
    >
      <nav class="grid grid-cols-4 gap-1.5 border-b border-black/10 bg-[#f7f7f7] p-2" aria-label="示例页面">
        <RouterLink
          v-for="item in routesMeta"
          :key="item.path"
          :to="item.path"
          class="flex h-8.5 items-center justify-center rounded text-sm text-[#444] transition-colors"
          :class="route.path === item.path ? 'bg-[#111] text-white' : 'hover:bg-white'"
        >
          {{ item.label }}
        </RouterLink>
      </nav>

      <RouterView />
    </section>
  </main>
</template>
