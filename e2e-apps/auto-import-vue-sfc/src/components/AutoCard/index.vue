<script setup lang="ts">
const props = defineProps({
  title: String,
  score: {
    type: Number,
    optionalTypes: [String],
  },
  enabled: Boolean,
  tags: Array,
  payload: Object,
  mode: [String, Number],
  customProp: String,
})

void props

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
