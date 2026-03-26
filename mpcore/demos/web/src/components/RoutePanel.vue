<script setup lang="ts">
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
    <div class="sim-chip-wrap">
      <button
        v-for="route in routes"
        :key="route"
        class="sim-chip"
        :class="{ 'is-active': currentRoute === route }"
        @click="emit('open', route)"
      >
        {{ route }}
      </button>
    </div>
  </SectionCard>
</template>
