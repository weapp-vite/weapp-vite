<script setup lang="ts">
defineProps<{
  entry: {
    item: {
      id: string
    }
  }
}>()
</script>

<template>
  <view class="issue868-gallery-card">{{ entry.item.id }}</view>
</template>

<style>
.issue868-gallery-card {
  display: block;
}
</style>
