<script setup lang="ts">
definePageJson({
  navigationBarTitleText: 'Home',
})

const cards = [
  {
    description: 'registered page',
    title: 'Overview',
  },
  {
    description: 'used by pages tree',
    title: 'Pages Explorer',
  },
]
</script>

<template>
  <view class="page">
    <view class="hero" bindtap="handleHeroTap">feature coverage workspace</view>
    <shared-card
      v-for="card in cards"
      :key="card.title"
      :title="card.title"
      :description="card.description"
    />
  </view>
</template>
