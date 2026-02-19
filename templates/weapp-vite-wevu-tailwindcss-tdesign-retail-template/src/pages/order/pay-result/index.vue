<script setup lang="ts">
import RetailPageShell from '@/components/RetailPageShell/index.vue'

definePageJson({
  navigationBarTitleText: '支付结果',
  backgroundColor: '#f8fafc',
})
</script>

<template>
  <RetailPageShell route="pages/order/pay-result/index" />
</template>
