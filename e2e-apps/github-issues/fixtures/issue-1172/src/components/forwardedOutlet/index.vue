<script setup lang="ts">
import Outlet from '../outlet/index.vue'
import Provider from '../provider/index.vue'

defineOptions({ options: { multipleSlots: true } })
defineProps<{ open: boolean, label: string, seed: number }>()
defineComponentJson({ component: true })
</script>

<template>
  <Provider :label="label" :seed="seed">
    <Outlet :open="open">
      <slot />
      <slot name="named" />
    </Outlet>
  </Provider>
</template>
