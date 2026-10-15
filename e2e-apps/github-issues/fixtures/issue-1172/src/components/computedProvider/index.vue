<script lang="ts">
import type { SlotContext } from '../../context'
import { defineComponent, shallowRef } from 'wevu'
import { SLOT_CONTEXT } from '../../context'
import Leaf from '../leaf/index.vue'

export default defineComponent({
  components: { Leaf },
  setup() {
    const count = shallowRef(30)
    const increment = () => count.value++
    const context: SlotContext = {
      label: 'computed-provider',
      count,
      increment,
      isSame: (injected, injectedCount, injectedIncrement) => injected === context
        && injectedCount === count
        && injectedIncrement === increment,
    }
    return { count, contextHolder: shallowRef(context) }
  },
  computed: {
    holder(this: { contextHolder: { value: SlotContext } }) {
      return this.contextHolder
    },
    providedContext(this: { holder: { value: SlotContext } }) {
      return this.holder.value
    },
  },
  provide(this: { providedContext: SlotContext }) {
    return { [SLOT_CONTEXT]: this.providedContext }
  },
})
</script>

<template>
  <view id="provider-computed-provider">provider:{{ count }}</view>
  <Leaf probe="computed-internal" />
  <slot />
</template>
