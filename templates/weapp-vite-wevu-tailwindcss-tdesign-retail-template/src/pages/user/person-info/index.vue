<script setup lang="ts">
import RetailPageShell from '@/components/RetailPageShell/index.vue'

definePageJson({
  navigationBarTitleText: '个人信息',
  backgroundColor: '#f8fafc',
})
</script>

<template>
  <RetailPageShell route="pages/user/person-info/index" />
</template>
