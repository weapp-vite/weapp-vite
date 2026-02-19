<script setup lang="ts">
import RetailPageShell from '@/components/RetailPageShell/index.vue'

definePageJson({
  navigationBarTitleText: '优惠券列表',
  backgroundColor: '#f8fafc',
})
</script>

<template>
  <RetailPageShell route="pages/coupon/coupon-list/index" />
</template>
