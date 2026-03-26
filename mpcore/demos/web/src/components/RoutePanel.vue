<script setup lang="ts">
import { chipWrapClass, pill } from '../lib/ui'
import SectionCard from './SectionCard.vue'

defineProps<{
  currentRoute: string
  routes: string[]
}>()

const emit = defineEmits<{
  open: [route: string]
}>()
</script>

<template>
  <SectionCard title="🕛 路由" subtitle="点击任意路由直接 reLaunch 进入。">
    <div :class="chipWrapClass">
      <button
        v-for="route in routes"
        :key="route"
        :class="pill({ tone: currentRoute === route ? 'accent' : 'neutral' })"
        @click="emit('open', route)"
      >
        {{ route }}
      </button>
    </div>
  </SectionCard>
</template>
