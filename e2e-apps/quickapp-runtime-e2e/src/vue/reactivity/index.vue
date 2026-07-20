<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const count = ref<number>(1)
const watchCount = ref(0)
const double = computed(() => count.value * 2)

watch(count, () => {
  watchCount.value += 1
})

function increment() {
  count.value += 1
}
</script>

<template>
  <div class="page">
    <text class="title">Vue reactivity</text>
    <text id="count" class="value">count={{ count }}</text>
    <text v-if="double >= 2" id="double" class="value">double={{ double }}</text>
    <text v-show="watchCount > 0" id="watch" class="value">watch={{ watchCount }}</text>
    <text id="increment" class="action" @click="increment">increment</text>
  </div>
</template>

<style>
@import '../../Common/base.css';

.page {
  flex: 1;
}
</style>
