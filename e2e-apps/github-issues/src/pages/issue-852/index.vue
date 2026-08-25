<script setup lang="ts">
import Count from '@/components/issue-852/Count.vue'
</script>

<template>
  <view
    id="issue-852"
    :data-decimal="1_000_000_000_000"
    :data-fraction="1_050.95"
    :data-binary="0b1010_0001_1000_0101"
    :data-octal="0o2_2_5_6"
    :data-hex="0xA0_B0_C0"
    :data-bigint="1_000_000_000_000_000_000_000n"
  >
    <!-- eslint-disable-next-line vue/no-loss-of-precision -->
    {{ 0x123456789ABCDEF }}
  </view>
  <Count id="issue-852-count-component" :value="1_000_000" />
</template>
