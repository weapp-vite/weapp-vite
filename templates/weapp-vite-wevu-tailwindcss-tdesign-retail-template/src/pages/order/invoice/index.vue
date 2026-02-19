<script setup lang="ts">
import RetailPageShell from '@/components/RetailPageShell/index.vue'

definePageJson({
  navigationBarTitleText: '发票信息',
  backgroundColor: '#f8fafc',
})
</script>

<template>
  <RetailPageShell route="pages/order/invoice/index" />
</template>
