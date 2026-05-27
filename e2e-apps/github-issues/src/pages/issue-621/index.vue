<script setup lang="ts">
import { ref } from 'wevu'

const count = ref(0)
const explicitCount = ref(0)
const derivedCount = ref(0)
const prefixCount = ref(0)
const conditionalCount = ref(0)
const sequenceCount = ref(0)
const argumentCount = ref(0)
const shorthandCount = ref(0)
const nestedState = {
  count: ref(0),
}

definePageJson({
  navigationBarTitleText: 'issue-621',
})

function _runE2E() {
  return {
    count: count.value,
    explicitCount: explicitCount.value,
    derivedCount: derivedCount.value,
    prefixCount: prefixCount.value,
    conditionalCount: conditionalCount.value,
    sequenceCount: sequenceCount.value,
    argumentCount: argumentCount.value,
    shorthandCount: shorthandCount.value,
    nestedCount: nestedState.count.value,
    ok: count.value >= 0 && explicitCount.value >= 0,
  }
}

function assignArgument(value: number) {
  argumentCount.value = value + 1
}

function assignShorthand(state: { shorthandCount: number }) {
  shorthandCount.value = state.shorthandCount + 1
}
</script>

<template>
  <view class="issue621-page">
    <view class="issue621-title">
      issue-621 inline assignment event
    </view>
    <button
      class="issue621-button issue621-button-count"
      data-issue621-action="count"
      @tap="count += 1"
    >
      count {{ count }}
    </button>
    <button
      class="issue621-button issue621-button-explicit"
      data-issue621-action="explicit"
      @tap="explicitCount.value += 1"
    >
      explicit {{ explicitCount }}
    </button>
    <button
      class="issue621-button issue621-button-derived"
      data-issue621-action="derived"
      @tap="derivedCount = derivedCount + 1"
    >
      derived {{ derivedCount }}
    </button>
    <button
      class="issue621-button issue621-button-prefix"
      data-issue621-action="prefix"
      @tap="++prefixCount"
    >
      prefix {{ prefixCount }}
    </button>
    <button
      class="issue621-button issue621-button-conditional"
      data-issue621-action="conditional"
      @tap="conditionalCount > 0 ? conditionalCount = conditionalCount + 2 : conditionalCount = conditionalCount + 1"
    >
      conditional {{ conditionalCount }}
    </button>
    <button
      class="issue621-button issue621-button-sequence"
      data-issue621-action="sequence"
      @tap="sequenceCount = sequenceCount + 1, sequenceCount++"
    >
      sequence {{ sequenceCount }}
    </button>
    <button
      class="issue621-button issue621-button-argument"
      data-issue621-action="argument"
      @tap="assignArgument(argumentCount)"
    >
      argument {{ argumentCount }}
    </button>
    <button
      class="issue621-button issue621-button-shorthand"
      data-issue621-action="shorthand"
      @tap="assignShorthand({ shorthandCount })"
    >
      shorthand {{ shorthandCount }}
    </button>
    <button
      class="issue621-button issue621-button-nested"
      data-issue621-action="nested"
      @tap="nestedState.count.value += 1"
    >
      nested {{ nestedState.count }}
    </button>
    <text
      class="issue621-count"
      :data-issue621-count="count"
    >
      {{ count }}
    </text>
    <text
      class="issue621-explicit-count"
      :data-issue621-explicit-count="explicitCount"
    >
      {{ explicitCount }}
    </text>
    <text
      class="issue621-derived-count"
      :data-issue621-derived-count="derivedCount"
    >
      {{ derivedCount }}
    </text>
    <text
      class="issue621-prefix-count"
      :data-issue621-prefix-count="prefixCount"
    >
      {{ prefixCount }}
    </text>
    <text
      class="issue621-conditional-count"
      :data-issue621-conditional-count="conditionalCount"
    >
      {{ conditionalCount }}
    </text>
    <text
      class="issue621-sequence-count"
      :data-issue621-sequence-count="sequenceCount"
    >
      {{ sequenceCount }}
    </text>
    <text
      class="issue621-argument-count"
      :data-issue621-argument-count="argumentCount"
    >
      {{ argumentCount }}
    </text>
    <text
      class="issue621-shorthand-count"
      :data-issue621-shorthand-count="shorthandCount"
    >
      {{ shorthandCount }}
    </text>
    <text
      class="issue621-nested-count"
      :data-issue621-nested-count="nestedState.count"
    >
      {{ nestedState.count }}
    </text>
  </view>
</template>

<style scoped>
.issue621-page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 28rpx;
  background: #f8fafc;
}

.issue621-title {
  margin-bottom: 24rpx;
  font-size: 30rpx;
  font-weight: 700;
  color: #111827;
}

.issue621-button {
  margin-bottom: 18rpx;
}

.issue621-count,
.issue621-explicit-count,
.issue621-derived-count,
.issue621-prefix-count,
.issue621-conditional-count,
.issue621-sequence-count,
.issue621-argument-count,
.issue621-shorthand-count,
.issue621-nested-count {
  display: block;
  margin-top: 12rpx;
  font-size: 28rpx;
  color: #0f172a;
}
</style>
