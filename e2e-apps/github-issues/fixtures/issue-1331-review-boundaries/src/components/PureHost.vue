<script setup>
import { ref } from 'wevu'

defineComponentJson({ usingComponents: { 'status-label': '/components/StatusLabel' } })
defineOptions({ options: { pureDataPattern: /^_/ } })
const label = ref('ready')
</script>

<template>
  <status-label probe="pure" :text="label" />
</template>
