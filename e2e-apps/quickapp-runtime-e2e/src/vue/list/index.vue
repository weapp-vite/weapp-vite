<script setup lang="ts">
import { reactive } from 'vue'

const items = reactive([
  { name: 'alpha' },
  { name: 'beta' },
])
</script>

<template>
  <div class="page">
    <text class="title">Vue list</text>
    <text v-for="(item, index) in items" :key="item.name" class="value" :data-index="index">
      {{ index }}:{{ item.name }}
    </text>
  </div>
</template>

<style>
@import '../../Common/base.css';
</style>
