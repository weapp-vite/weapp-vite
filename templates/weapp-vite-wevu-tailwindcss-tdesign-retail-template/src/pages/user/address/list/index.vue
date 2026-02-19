<script setup lang="ts">
import RetailPageShell from '@/components/RetailPageShell/index.vue'

definePageJson({
  navigationBarTitleText: '地址列表',
  backgroundColor: '#f8fafc',
})
</script>

<template>
  <RetailPageShell route="pages/user/address/list/index" />
</template>
