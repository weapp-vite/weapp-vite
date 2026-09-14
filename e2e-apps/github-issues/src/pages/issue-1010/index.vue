<script setup lang="ts">
/* eslint-disable prefer-const -- 模板事件写入 setup let，规则无法分析模板中的赋值。 */
import { ref } from 'wevu'

let count = 1
const next = { count: 2 }

let aliasCount = 0
let defaultCount = 0
let nestedCount = 0
const refCount = ref(0)
let objectRest: { count?: number, extra?: number } = {}
const defaultValue = 7
const objectNext = {
  count: 2,
  source: 3,
  missing: undefined,
  nested: [4, 5],
  extra: 6,
}

let arrayCount = 0
let arrayDefault = 0
const arrayRef = ref(0)
const arrayRest = ref<number[]>([])
const arrayNext = [8, undefined, 9, 'ignored', 10, 11]

let localResult = 0
const localNext = { count: 12 }

let orderedCount = 0
let orderedRest: { extra?: number } = {}
const evaluationOrder = ref<string[]>([])
const orderedNext = {
  get orderedCount() {
    evaluationOrder.value.push('source')
    return undefined
  },
  get extra() {
    evaluationOrder.value.push('rest')
    return 13
  },
}

let directCount = 1
const directRef = ref(1)

function readKey() {
  evaluationOrder.value.push('key')
  return 'orderedCount'
}

function readDefault() {
  evaluationOrder.value.push('default')
  return 14
}

function _runE2E() {
  return {
    count,
    aliasCount,
    defaultCount,
    nestedCount,
    refCount: refCount.value,
    objectRest: { ...objectRest },
    arrayCount,
    arrayDefault,
    arrayRef: arrayRef.value,
    arrayRest: [...arrayRest.value],
    localResult,
    orderedCount,
    orderedRest: { ...orderedRest },
    evaluationOrder: [...evaluationOrder.value],
    directCount,
    directRef: directRef.value,
  }
}

definePageJson({
  navigationBarTitleText: 'issue-1010',
})
</script>

<template>
  <view id="issue-1010-root">
    <button id="issue-1010-reported" @tap="({ count } = next)">
      reported
    </button>
    <button
      id="issue-1010-object"
      @tap="({ source: aliasCount, missing: defaultCount = defaultValue, nested: [nestedCount, refCount], ...objectRest } = objectNext)"
    >
      object
    </button>
    <button
      id="issue-1010-array"
      @tap="[arrayCount, arrayDefault = defaultValue, arrayRef, , ...arrayRest] = arrayNext"
    >
      array
    </button>
    <button
      id="issue-1010-local"
      @tap="((count) => (({ count } = localNext), localResult = count))(0)"
    >
      local
    </button>
    <button
      id="issue-1010-order"
      @tap="({ [readKey()]: orderedCount = readDefault(), ...orderedRest } = orderedNext)"
    >
      order
    </button>
    <button
      id="issue-1010-direct"
      @tap="directCount = directCount + 1, directRef += 1"
    >
      direct
    </button>

    <text id="issue-1010-count">{{ count }}</text>
    <text id="issue-1010-object-state">{{ aliasCount }}|{{ defaultCount }}|{{ nestedCount }}|{{ refCount }}|{{ objectRest.count }}|{{ objectRest.extra }}</text>
    <text id="issue-1010-array-state">{{ arrayCount }}|{{ arrayDefault }}|{{ arrayRef }}|{{ arrayRest[0] }}|{{ arrayRest[1] }}</text>
    <text id="issue-1010-local-state">{{ localResult }}|{{ count }}</text>
    <text id="issue-1010-order-state">{{ orderedCount }}|{{ orderedRest.extra }}|{{ evaluationOrder[0] }}|{{ evaluationOrder[1] }}|{{ evaluationOrder[2] }}|{{ evaluationOrder[3] }}</text>
    <text id="issue-1010-direct-state">{{ directCount }}|{{ directRef }}</text>
  </view>
</template>
