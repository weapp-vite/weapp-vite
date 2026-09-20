<script setup lang="ts">
import { reactive } from 'wevu'

interface ObjectCapture {
  id: string
  label: unknown
  rest: Record<string, unknown>
  restKeys: string[]
  rowIndex: number
  sectionName: string
}

interface TupleCapture {
  head: string
  tail: string[]
  tupleIndex: number
}

const sections = reactive([{
  sectionName: 'section-fallback',
  rows: [
    { id: 'missing', extra: 'A' },
    { id: 'null', label: null, extra: 'B' },
    { id: 'zero', label: 0, extra: 'C' },
    { id: 'false', label: false, extra: 'D' },
  ],
}])
const tuples = reactive([
  ['head', 'tail-a', 'tail-b'],
])
const objectCaptures = reactive<ObjectCapture[]>([])
const tupleCaptures = reactive<TupleCapture[]>([])

function captureObject(
  id: string,
  label: unknown,
  rest: Record<string, unknown>,
  sectionName: string,
  rowIndex: number,
) {
  objectCaptures.push({
    id,
    label,
    rest: { ...rest },
    restKeys: Object.keys(rest).sort(),
    rowIndex,
    sectionName,
  })
}

function captureTuple(head: string, tail: string[], tupleIndex: number) {
  tupleCaptures.push({ head, tail: [...tail], tupleIndex })
}

function _snapshot() {
  return {
    objectCaptures: objectCaptures.map(capture => ({ ...capture })),
    tupleCaptures: tupleCaptures.map(capture => ({ ...capture })),
  }
}

defineExpose({
  _snapshot,
})
</script>

<template>
  <view id="issue-1011-page">
    <view v-for="({ sectionName, rows }, sectionIndex) in sections" :key="sectionIndex">
      <button
        v-for="({ id, label = sectionName, ...rest }, rowIndex) in rows"
        :id="`issue1011-action-${id}`"
        :key="id"
        @tap="captureObject(id, label, rest, sectionName, rowIndex)"
      >
        <text :id="`issue1011-value-${id}`">
          {{ id }}|{{ label === null ? 'null' : label === false ? 'false' : label }}|{{ rest.extra }}|{{ rest.id === undefined ? 'excluded' : 'leaked' }}|{{ rest.label === undefined ? 'excluded' : 'leaked' }}
        </text>
      </button>
    </view>

    <button
      v-for="([head, ...tail], tupleIndex) in tuples"
      :id="`issue1011-tuple-${tupleIndex}`"
      :key="tupleIndex"
      @tap="captureTuple(head, tail, tupleIndex)"
    >
      {{ head }}|{{ tail[0] }}|{{ tail[1] }}
    </button>

    <text id="issue1011-capture-count">
      {{ objectCaptures.length + tupleCaptures.length }}
    </text>
  </view>
</template>
