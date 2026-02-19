<script setup lang="ts">
import RetailPageShell from '@/components/RetailPageShell/index.vue'

definePageJson({
  navigationBarTitleText: '发票抬头',
  backgroundColor: '#f8fafc',
})
</script>

<template>
  <RetailPageShell route="pages/order/receipt/index" />
</template>
