<script setup lang="ts">
defineComponentJson({
  component: true,
})
</script>

<template>
  <view class="layout-default">
    <slot />
  </view>
</template>

<style>
.layout-default {
  min-height: 100%;
}
</style>
