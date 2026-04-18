<script setup lang="ts">
definePageJson({
  navigationBarTitleText: 'Legacy',
})
</script>

<template>
  <view class="page">
    <filter-bar />
    <view bindtap="handleLegacyTap">legacy json compatibility page</view>
  </view>
</template>

<json lang="jsonc">
{
  "navigationBarTitleText": "Legacy",
  "usingComponents": {
    "filter-bar": "/components/shared/filter-bar/index",
    "ghost-panel": "/components/missing/ghost-panel/index"
  }
}
</json>
