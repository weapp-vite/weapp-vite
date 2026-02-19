<script setup lang="ts">
import RetailPageShell from '@/components/RetailPageShell/index.vue'

definePageJson({
  navigationBarTitleText: '搜索结果',
  backgroundColor: '#f8fafc',
})
</script>

<template>
  <RetailPageShell route="pages/goods/result/index" />
</template>
