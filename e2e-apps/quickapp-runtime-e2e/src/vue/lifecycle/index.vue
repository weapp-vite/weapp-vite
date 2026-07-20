<script setup>
import { onMounted, ref } from 'vue'

const lifecycle = ref('created')

onMounted(() => {
  lifecycle.value = 'mounted'
})
</script>

<template>
  <div class="page">
    <text id="lifecycle" class="value">{{ lifecycle }}</text>
  </div>
</template>

<style>
@import '../../Common/base.css';
</style>
