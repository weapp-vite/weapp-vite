<script setup lang="ts">
defineOptions(() => ({
  data: { ready: true },
}))
const sentinel = 1
</script>

<template>
  <view id="issue-1016-page">
    issue-1016 source map sentinel: {{ sentinel }}
  </view>
</template>
