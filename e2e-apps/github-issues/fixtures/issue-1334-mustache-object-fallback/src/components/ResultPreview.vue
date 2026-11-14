<script setup lang="ts">
defineProps<{ preview: { rawValueText: string; valueText: string } }>();
</script>

<template>
  <view>
    <text>{{ preview.rawValueText }}</text>
    <text>{{ preview.valueText }}</text>
  </view>
</template>
