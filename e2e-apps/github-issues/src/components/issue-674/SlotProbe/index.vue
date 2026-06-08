<script setup lang="ts">
import { computed } from 'wevu'

const slots = defineSlots<{
  default?: () => any
  header?: () => any
}>()
const slotKeys = computed(() => Object.keys(slots).sort().join(',') || 'none')
</script>

<template>
  <view class="issue674-slot-probe">
    <text :data-issue674-slot-keys="slotKeys">
      {{ slotKeys }}
    </text>
    <slot />
    <slot name="header" />
  </view>
</template>
