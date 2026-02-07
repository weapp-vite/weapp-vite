<script setup lang="ts">
defineComponentJson(() => ({
  styleIsolation: 'apply-shared',
  options: {
    virtualHost: true,
    multipleSlots: true,
  },
}))
</script>

<template>
  <view class="card">
    auto-card
  </view>
</template>
