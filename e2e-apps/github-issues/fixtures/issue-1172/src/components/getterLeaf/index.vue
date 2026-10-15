<script setup lang="ts">
import type { SlotContext } from '../../context'

const source = (globalThis as typeof globalThis & { issue1172ContextSource: { readonly current: SlotContext | undefined } }).issue1172ContextSource
const { current: context } = source
const count = context?.count
const owner = context?.label ?? 'missing'
const identity = context
  ? context === source.current ? 'same' : 'different'
  : 'missing'
</script>

<template>
  <view>
    <view id="count-getter-primary">{{ count === undefined ? 'missing' : `count:${count}` }}</view>
    <view id="owner-getter-primary">{{ owner }}</view>
    <view id="identity-getter-primary">{{ identity }}</view>
  </view>
</template>
