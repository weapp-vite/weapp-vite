<script setup lang="ts">
import RetailPageShell from '@/components/RetailPageShell/index.vue'

definePageJson({
  navigationBarTitleText: '商品详情',
  backgroundColor: '#f8fafc',
})
</script>

<template>
  <RetailPageShell route="pages/goods/details/index" />
</template>
