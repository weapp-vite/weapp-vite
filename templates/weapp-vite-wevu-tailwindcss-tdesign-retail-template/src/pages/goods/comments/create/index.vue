<script setup lang="ts">
import RetailPageShell from '@/components/RetailPageShell/index.vue'

definePageJson({
  navigationBarTitleText: '发布评论',
  backgroundColor: '#f8fafc',
})
</script>

<template>
  <RetailPageShell route="pages/goods/comments/create/index" />
</template>
