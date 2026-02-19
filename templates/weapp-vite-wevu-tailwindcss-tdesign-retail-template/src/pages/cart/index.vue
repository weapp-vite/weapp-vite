<script setup lang="ts">
import RetailPageShell from '@/components/RetailPageShell/index.vue'

definePageJson({
  navigationBarTitleText: '购物车',
  backgroundColor: '#f8fafc',
})
</script>

<template>
  <RetailPageShell route="pages/cart/index" />
</template>
