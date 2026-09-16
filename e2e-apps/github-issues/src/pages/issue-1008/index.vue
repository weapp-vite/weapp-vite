<script setup lang="ts">
import { computed, ref } from 'wevu'

const count = ref(1)
const rows = [2]
const parameterResult = ref<number[]>([])
const blockResult = ref<number[]>([])
const closureResult = ref<number[]>([])

const parameterLabel = computed(() => JSON.stringify(parameterResult.value))
const blockLabel = computed(() => JSON.stringify(blockResult.value))
const closureLabel = computed(() => JSON.stringify(closureResult.value))

definePageJson({
  navigationBarTitleText: 'issue-1008',
})

function _runE2E() {
  return {
    blockResult: [...blockResult.value],
    closureResult: [...closureResult.value],
    count: count.value,
    parameterResult: [...parameterResult.value],
  }
}

defineExpose({
  _runE2E,
})
</script>

<template>
  <view
    id="issue1008-page"
    data-e2e-issue="1008"
  >
    <text id="issue1008-count">
      {{ count }}
    </text>
    <button
      id="issue1008-parameter"
      @tap="parameterResult = rows.map(count => count++)"
    >
      run parameter shadow
    </button>
    <text id="issue1008-parameter-result">
      {{ parameterLabel }}
    </text>
    <button
      id="issue1008-block"
      @tap="blockResult = (() => { let count = 2; count = 3; count += 4; const returned = count++; return [returned, count] })()"
    >
      run block shadow
    </button>
    <text id="issue1008-block-result">
      {{ blockLabel }}
    </text>
    <button
      id="issue1008-closure"
      @tap="closureResult = ((count) => () => { count += 2; const returned = ++count; return [returned, count] })(2)()"
    >
      run closure shadow
    </button>
    <text id="issue1008-closure-result">
      {{ closureLabel }}
    </text>
    <button
      id="issue1008-setup-ref"
      @tap="count = 2, count += 3, count++, ++count"
    >
      run setup ref writes
    </button>
  </view>
</template>
