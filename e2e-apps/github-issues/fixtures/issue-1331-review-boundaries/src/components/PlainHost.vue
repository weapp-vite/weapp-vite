<script>
import { computed } from 'wevu'

defineComponentJson({ usingComponents: { 'status-label': '/components/StatusLabel' } })
export default {
  setup() {
    return { label: computed(() => 'ready') }
  },
}
</script>

<template>
  <status-label probe="plain" :text="label" />
</template>
