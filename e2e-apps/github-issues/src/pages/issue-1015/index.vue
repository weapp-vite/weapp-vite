<script setup lang="ts">
import { ref } from 'wevu'

definePageJson({
  navigationBarTitleText: 'issue-1015',
})

const themeColor = ref('red')
const accentColor = ref('orange')
const state = ref<'initial' | 'updated'>('initial')

function _runE2E(action?: 'mutate') {
  if (action === 'mutate') {
    themeColor.value = 'blue'
    accentColor.value = 'purple'
    state.value = 'updated'
  }
  return {
    accentColor: accentColor.value,
    state: state.value,
    themeColor: themeColor.value,
  }
}

defineExpose({
  _runE2E,
})
</script>

<template>
  <view
    id="issue-1015-page"
    class="issue1015-page"
    :data-theme-color="themeColor"
  >
    <text id="issue-1015-state">
      external css vars {{ state }}
    </text>
  </view>
</template>

<style src="./index.css"></style>
