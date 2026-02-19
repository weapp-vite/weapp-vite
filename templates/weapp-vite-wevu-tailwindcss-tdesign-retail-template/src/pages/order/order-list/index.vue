<script setup lang="ts">
import RetailPageShell from '@/components/RetailPageShell/index.vue'

definePageJson({
  navigationBarTitleText: '订单列表',
  backgroundColor: '#f8fafc',
})
</script>

<template>
  <RetailPageShell route="pages/order/order-list/index" />
</template>
