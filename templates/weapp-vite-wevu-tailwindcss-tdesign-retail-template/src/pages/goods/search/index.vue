<script setup lang="ts">
import RetailPageShell from '@/components/RetailPageShell/index.vue'

definePageJson({
  navigationBarTitleText: '商品搜索',
  backgroundColor: '#f8fafc',
})
</script>

<template>
  <RetailPageShell route="pages/goods/search/index" />
</template>
