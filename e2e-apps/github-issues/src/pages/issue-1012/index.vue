<script setup lang="ts">
import { ref } from 'wevu'

const mapResult = ref('pending')
const results = ref('pending')
const value = 99

function capture(nextMapResult: number[], nextResults: number[]) {
  mapResult.value = JSON.stringify(nextMapResult)
  results.value = JSON.stringify(nextResults)
}

function componentMethod(this: { value: number }) {
  return this.value
}
</script>

<template>
  <!-- eslint-disable vue/this-in-template -- 回归动态 this 的接收者语义，不能自动删除 this。 -->
  <view id="issue-1012-page" :data-context-value="value">
    <button
      id="issue1012-run"
      type="primary"
      @tap="capture(
        [1].map(function () { return this.value }, { value: 7 }),
        [
          (function () { return this.value }).call({ value: 8 }),
          (function () { return this.value }).apply({ value: 9 }),
          (function () { return this.value }).bind({ value: 10 })(),
          ({ value: 11, read() { return this.value } }).read(),
          new class { constructor() { this.value = 12 } read() { return this.value } }().read(),
          (function () { return (() => this.value)() }).call({ value: 13 }),
          this.value,
          (() => this.value)(),
          componentMethod(),
          this.componentMethod(),
        ],
      )"
    >
      run dynamic this checks
    </button>
    <text id="issue1012-map-result">{{ mapResult }}</text>
    <text id="issue1012-results">{{ results }}</text>
  </view>
</template>
