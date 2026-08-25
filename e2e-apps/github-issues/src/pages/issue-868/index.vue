<script setup lang="ts">
import GalleryCard from '../../components/issue-868/GalleryCard/index.vue'

const column = [
  { item: { id: 'issue-868' } },
]
</script>

<template>
  <view id="issue-868-page">
    <GalleryCard v-for="entry in column" :key="entry.item.id" :entry="entry" />
  </view>
</template>
