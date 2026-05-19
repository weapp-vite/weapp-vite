<script lang="ts">
export default {
  props: {
    color: {
      type: String,
      required: true,
    },
    active: {
      type: Boolean,
      default: false,
    },
    label: {
      type: String,
      default: 'issue-590 badge',
    },
  },
}
</script>

<template>
  <view
    id="issue590-badge"
    class="issue590-badge"
    :class="{ 'issue590-badge--active': active }"
    :style="{ color }"
  >
    {{ label }}
  </view>
</template>

<style>
.issue590-badge {
  font-size: 16px;
}

.issue590-badge--active {
  font-weight: 600;
}
</style>
