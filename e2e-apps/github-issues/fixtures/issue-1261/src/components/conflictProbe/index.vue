<script setup lang="ts">
import { ref } from 'wevu'
import { conflictProps } from '../../props/conflict'

const props = defineProps(conflictProps)
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
