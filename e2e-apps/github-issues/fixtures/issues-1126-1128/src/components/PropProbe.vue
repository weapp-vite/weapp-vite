<script setup lang="ts">
import { ref } from 'wevu'

const props = withDefaults(defineProps<{ back?: boolean }>(), { back: false })
const calls = ref(0)
function back() {
  calls.value++
}
defineComponentJson({ component: true })
</script>

<template>
  <text class="prop-value">{{ props.back ? 'true' : 'false' }}</text>
  <button class="call-back" @tap="back">Call same-name method</button>
  <text class="method-count">{{ calls }}</text>
</template>
