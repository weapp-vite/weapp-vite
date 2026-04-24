<script setup lang="ts">
import { cn } from '../lib/cn'
import SectionCard from './SectionCard.vue'

defineProps<{
  routes: string[]
}>()
</script>

<template>
  <SectionCard title="🕛 页面栈" subtitle="对应 getCurrentPages() 的当前顺序。">
    <ol class="m-0 pl-5">
      <li
        v-for="(route, index) in routes"
        :key="`${route}-${index}`"
        :class="cn(
          'py-1 text-[13px] transition-colors',
          index === routes.length - 1 ? 'font-semibold text-(--sim-accent-strong)' : 'text-(--sim-muted)',
        )"
      >
        {{ route }}
      </li>
    </ol>
  </SectionCard>
</template>
