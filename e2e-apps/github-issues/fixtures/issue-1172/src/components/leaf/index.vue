<script setup lang="ts">
import type { SlotContext } from '../../context'
import { inject } from 'wevu'
import { SLOT_CONTEXT } from '../../context'

defineProps<{ probe: string }>()
const context = inject<SlotContext | undefined>(SLOT_CONTEXT, undefined)
const count = context?.count
const action = context?.increment
const owner = context?.label ?? 'missing'
const identity = context
  ? context.isSame(context, count, action) ? 'same' : 'different'
  : 'missing'

function increment() {
  if (!action) {
    throw new Error('Missing slot provider action')
  }
  action()
}

defineComponentJson({ component: true })
</script>

<template>
  <view>
    <view :id="`count-${probe}`">{{ count === undefined ? 'missing' : `count:${count}` }}</view>
    <view :id="`owner-${probe}`">{{ owner }}</view>
    <view :id="`identity-${probe}`">{{ identity }}</view>
    <button :id="`increment-${probe}`" @tap="increment">Increment {{ probe }}</button>
  </view>
</template>
