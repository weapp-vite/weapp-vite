<script setup lang="ts">
import { shallowRef } from 'wevu'

const props = withDefaults(defineProps<{ back?: boolean }>(), { back: false })
const calls = shallowRef(0)
function back() {
  calls.value++
}
defineComponentJson({ component: true })
</script>

<template>
  <text v-if="props.back" id="true-branch">back prop is true</text>
  <text v-else id="false-branch">PASS: back prop is false</text>
  <button id="call-back" @tap="back">Invoke back</button>
  <text id="handler-count">{{ calls }}</text>
</template>
