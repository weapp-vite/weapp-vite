<script setup lang="ts">
interface Issue599Data {
  color: string
  size: number
  label: string
}

defineProps<{
  data: Issue599Data
}>()
</script>

<template>
  <view
    class="issue599-probe"
    :style="{ color: data.color, fontSize: `${data.size}rpx` }"
    :data-issue599-label="data.label"
    :data-issue599-color="data.color"
  >
    {{ data.label }}
  </view>
</template>

<style scoped>
.issue599-probe {
  min-height: 48rpx;
  line-height: 48rpx;
}
</style>
