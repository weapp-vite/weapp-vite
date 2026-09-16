<script setup lang="ts">
import { ref } from 'wevu'

definePageJson({
  navigationBarTitleText: 'issue-1009',
})

const rows = [{ name: 'A' }]
const items = [{ name: 'I' }]
const prefix = 'P'
const ctx = ref('C')
const scope = ref('S')
const results = ref({
  bindings: 'pending',
  control: 'pending',
  ctxCallback: 'pending',
  event: 'pending',
  nested: 'pending',
  scopeCallback: 'pending',
})

type ResultKey = keyof typeof results.value

function recordResult(key: ResultKey, value: string | string[]) {
  results.value[key] = Array.isArray(value) ? value.join(',') : value
}

function _runE2E() {
  return { ...results.value }
}

defineExpose({
  _runE2E,
})
</script>

<template>
  <view
    id="issue-1009-page"
    data-e2e-issue="1009"
  >
    <button
      id="issue1009-ctx-callback"
      @tap="recordResult('ctxCallback', rows.map(ctx => prefix + ctx.name))"
    >
      ctx callback
    </button>
    <view
      v-for="item in items"
      :key="item.name"
    >
      <button
        id="issue1009-scope-callback"
        @tap="recordResult('scopeCallback', rows.map(scope => item.name + scope.name))"
      >
        scope callback
      </button>
    </view>
    <button
      id="issue1009-component-bindings"
      @tap="recordResult('bindings', ctx + scope)"
    >
      component bindings
    </button>
    <button
      id="issue1009-nested-callbacks"
      @tap="recordResult('nested', rows.map(ctx => rows.map(scope => prefix + ctx.name + scope.name).join('')).join(''))"
    >
      nested callbacks
    </button>
    <button
      id="issue1009-event-boundary"
      @tap="recordResult('event', rows.map(_event => `${prefix + _event.name}-${$event.type}`).join(''))"
    >
      event boundary
    </button>
    <button
      id="issue1009-control"
      @tap="recordResult('control', rows.map(row => prefix + row.name).join(''))"
    >
      no-conflict control
    </button>
    <view id="issue1009-result-ctx">ctx: {{ results.ctxCallback }}</view>
    <view id="issue1009-result-scope">scope: {{ results.scopeCallback }}</view>
    <view id="issue1009-result-bindings">bindings: {{ results.bindings }}</view>
    <view id="issue1009-result-nested">nested: {{ results.nested }}</view>
    <view id="issue1009-result-event">event: {{ results.event }}</view>
    <view id="issue1009-result-control">control: {{ results.control }}</view>
  </view>
</template>
