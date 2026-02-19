<script setup lang="ts">
import RetailPageShell from '@/components/RetailPageShell/index.vue'

definePageJson({
  navigationBarTitleText: '首页',
  backgroundColor: '#f8fafc',
})
</script>

<template>
  <RetailPageShell route="pages/home/home" />
</template>
