<script setup lang="ts">
import RetailPageShell from '@/components/RetailPageShell/index.vue'

definePageJson({
  navigationBarTitleText: '确认订单',
  backgroundColor: '#f8fafc',
})
</script>

<template>
  <RetailPageShell route="pages/order/order-confirm/index" />
</template>
