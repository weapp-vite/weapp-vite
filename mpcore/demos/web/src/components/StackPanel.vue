<script setup lang="ts">
import SectionCard from './SectionCard.vue'

defineProps<{
  routes: string[]
}>()
</script>

<template>
  <SectionCard title="🕛 页面栈" subtitle="对应 getCurrentPages() 的当前顺序。">
    <ol class="sim-stack-list">
      <li
        v-for="(route, index) in routes"
        :key="`${route}-${index}`"
        :class="{ 'is-current': index === routes.length - 1 }"
      >
        {{ route }}
      </li>
    </ol>
  </SectionCard>
</template>
