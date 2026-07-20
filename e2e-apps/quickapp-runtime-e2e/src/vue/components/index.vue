<script setup lang="ts">
import { ref } from 'vue'
import CounterCard from './CounterCard.vue'

const count = ref(1)

function setCount(event: { detail?: number } | number) {
  count.value = typeof event === 'number' ? event : event.detail ?? count.value
}
</script>

<template>
  <div class="page">
    <text class="title">Vue component</text>
    <CounterCard label="count" :count="count" @increment="setCount" />
  </div>
</template>

<style>
@import '../../Common/base.css';
</style>
