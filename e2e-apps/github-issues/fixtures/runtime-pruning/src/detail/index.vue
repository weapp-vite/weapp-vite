<script setup lang="ts">
import { onMounted, ref } from 'wevu'

const phase = ref('setup')
onMounted(() => phase.value = 'mounted')
</script>

<template>
  <text id="pruning-detail">{{ phase }}</text>
</template>
