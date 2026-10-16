<script lang="ts">
import type { SlotContext } from '../../context'
import { defineComponent, shallowRef } from 'wevu'
import { SLOT_CONTEXT } from '../../context'
import Leaf from '../leaf/index.vue'

function createContext(seed: number): SlotContext {
  const count = shallowRef(seed)
  const increment = () => count.value++
  const context: SlotContext = {
    label: 'computed-provider',
    count,
    increment,
    isSame: (injected, injectedCount, injectedIncrement) => injected === context
      && injectedCount === count
      && injectedIncrement === increment,
  }
  return context
}

export default defineComponent({
  components: { Leaf },
  setup() {
    const watchedCount = shallowRef(-1)
    return {
      seedHolder: shallowRef(30),
      createContext,
      watchedCount,
      recordCount: (count: number) => { watchedCount.value = count },
    }
  },
  computed: {
    holder(this: { seedHolder: { value: number } }) {
      return this.seedHolder
    },
    providedContext(this: { holder: { value: number }, createContext: typeof createContext }) {
      return this.createContext(this.holder.value)
    },
    count(this: { providedContext: SlotContext }) {
      return this.providedContext.count.value
    },
  },
  watch: {
    count: { handler: 'recordCount', immediate: true },
  },
  provide(this: { providedContext: SlotContext }) {
    return { [SLOT_CONTEXT]: this.providedContext }
  },
})
</script>

<template>
  <view id="provider-computed-provider">provider:{{ count }}</view>
  <text id="computed-watched-count">watched:{{ watchedCount }}</text>
  <Leaf probe="computed-internal" />
  <slot />
</template>
