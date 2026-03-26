<script setup lang="ts">
import SectionCard from './SectionCard.vue'

defineProps<{
  markup: string
  route: string
}>()

const emit = defineEmits<{
  back: []
}>()
</script>

<template>
  <SectionCard title="🕛 模拟器" subtitle="左侧固定预览区，始终显示当前页面。">
    <div class="sim-device">
      <div class="sim-device__bar">
        <span>{{ route }}</span>
        <button class="sim-mini-btn" @click="emit('back')">
          返回
        </button>
      </div>
      <div class="sim-device__screen" v-html="markup" />
    </div>
  </SectionCard>
</template>
