<script setup lang="ts">
import RetailPageShell from '@/components/RetailPageShell/index.vue'

definePageJson({
  navigationBarTitleText: '我的',
  backgroundColor: '#f8fafc',
})
</script>

<template>
  <RetailPageShell route="pages/usercenter/index" />
</template>
