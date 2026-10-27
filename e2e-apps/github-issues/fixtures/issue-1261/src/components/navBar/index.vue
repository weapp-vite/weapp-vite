<script setup lang="ts">
import { computed, ref } from 'wevu'
import { navProps } from '../../props/nav'

const { max } = defineProps(navProps)
const current = ref(1)
const haveNext = computed(() => current.value < (max ?? 0))
const havePrev = computed(() => current.value > 1)

function next() {
  if (haveNext.value) {
    current.value++
  }
}

function previous() {
  if (havePrev.value) {
    current.value--
  }
}

defineComponentJson({ component: true })
</script>

<template>
  <view id="nav-state">
    <text id="nav-position">{{ current }}/{{ max }}</text>
    <button id="next" :disabled="!haveNext" @tap="next">Next</button>
    <button id="previous" :disabled="!havePrev" @tap="previous">Previous</button>
  </view>
</template>
