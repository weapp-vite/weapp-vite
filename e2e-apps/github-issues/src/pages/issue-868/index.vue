<script setup lang="ts">
import { reactive } from 'wevu'
import GalleryCard from '../../components/issue-868/GalleryCard/index.vue'

const column = reactive([
  {
    item: {
      count: 0,
      id: 'entry-a',
      title: 'alpha',
    },
  },
  {
    item: {
      count: 0,
      id: 'entry-b',
      title: 'beta',
    },
  },
])
const values = ['primitive-a', 'primitive-b']

function increment(entry: (typeof column)[number]) {
  entry.item.count += 1
}
</script>

<template>
  <view id="issue-868-page">
    <text id="issue-868-status">
      {{ column[0].item.title }}|{{ column[0].item.count }}
    </text>

    <GalleryCard
      v-for="entry in column"
      :id="`issue-868-card-${entry.item.id}`"
      :key="entry.item.id"
      v-model="entry.item.title"
      :entry="entry"
      @increment="increment(entry)"
    />

    <view
      v-for="item in values"
      :key="`${item}-key`"
      class="issue-868-primitive"
    >
      {{ item }}
    </view>
  </view>
</template>
