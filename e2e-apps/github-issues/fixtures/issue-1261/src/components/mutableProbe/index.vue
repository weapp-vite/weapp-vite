<script setup lang="ts">
import { ref } from 'wevu'
import { mutableProps } from '../../props/mutable'

const props = defineProps(mutableProps)
const canvasId = ref('local-canvas')

function changeLocal() {
  canvasId.value = 'changed-local'
}

defineComponentJson({ component: true })
</script>

<template>
  <text id="local-canvas">{{ canvasId }}</text>
  <text id="parent-canvas">{{ props.canvasId }}</text>
  <button id="change-local" @tap="changeLocal">Change local canvas</button>
</template>
