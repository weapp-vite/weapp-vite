<script setup>
import device from '@system.device'
import { ref } from 'vue'

const result = ref('idle')

function readDevice() {
  result.value = device.getInfo ? 'supported' : 'missing'
}
</script>

<template>
  <div class="page">
    <text id="api-result" class="value">{{ result }}</text>
    <text id="api-run" class="action" @click="readDevice">read device</text>
  </div>
</template>

<style>
@import '../../Common/base.css';
</style>
