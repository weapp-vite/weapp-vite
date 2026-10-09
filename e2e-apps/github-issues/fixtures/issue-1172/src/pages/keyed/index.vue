<script setup lang="ts">
import { computed, shallowRef } from 'wevu'
import Leaf from '../../components/leaf/index.vue'
import Outlet from '../../components/outlet/index.vue'
import Provider from '../../components/provider/index.vue'

const groups = shallowRef([
  { id: 'a', rows: [{ id: 'x', label: 'a-x', seed: 10 }, { id: 'y', label: 'a-y', seed: 20 }] },
  { id: 'b', rows: [{ id: 'x', label: 'b-x', seed: 30 }, { id: 'y', label: 'b-y', seed: 40 }] },
])
const nativeRows = shallowRef<Array<{ id: number | string, label: string, seed: number }>>([
  { id: 1, label: 'native-a', seed: 60 },
  { id: 2, label: 'native-b', seed: 70 },
])
const open = shallowRef(false)
const late = shallowRef(false)
const reports = shallowRef<Record<string, string>>({})
const setups: Record<string, number> = {}
const labels = ['a-x', 'a-y', 'b-x', 'b-y', 'native-a', 'native-b']
const probes: string[] = []
for (const label of labels) {
  probes.push(`${label}-main`, `${label}-late`)
}
const order = computed(() => groups.value.map(group => `${group.id}:${group.rows.map(row => row.id).join(',')}`).join('|'))
const nativeOrder = computed(() => nativeRows.value.map(row => row.id).join(','))

function ready(report: { probe: string, owner: string, identity: string }) {
  const count = (setups[report.probe] ?? 0) + 1
  setups[report.probe] = count
  reports.value = { ...reports.value, [report.probe]: `${report.owner}:${report.identity}:${count}` }
}

function toggle() {
  open.value = !open.value
}

function reverse() {
  groups.value = [...groups.value].reverse().map(group => ({ ...group, rows: [...group.rows].reverse() }))
  nativeRows.value = [...nativeRows.value].reverse()
}

function normalizeKeys() {
  nativeRows.value = nativeRows.value.map(row => ({ ...row, id: String(row.id) }))
}

function addLate() {
  late.value = true
}

function detach() {
  groups.value = groups.value.map(group => ({ ...group, rows: group.rows.filter(row => row.label !== 'a-x') }))
}

function recreate() {
  groups.value = groups.value.map(group => group.id === 'a'
    ? { ...group, rows: [...group.rows, { id: 'x', label: 'a-x', seed: 90 }] }
    : group)
}
</script>

<template>
  <button id="toggle-outlet" @tap="toggle">Toggle outlets</button>
  <button id="reverse" @tap="reverse">Reverse keyed groups and rows</button>
  <button id="normalize-keys" @tap="normalizeKeys">Normalize native key types</button>
  <button id="add-late" @tap="addLate">Mount hidden consumers</button>
  <button id="detach" @tap="detach">Detach a-x</button>
  <button id="recreate" @tap="recreate">Recreate a-x</button>
  <text id="outlet-state">{{ open ? 'open' : 'closed' }}</text>
  <text id="keyed-order">{{ order }}</text>
  <text id="native-order">{{ nativeOrder }}</text>
  <view v-for="probe in probes" :id="`ready-${probe}`" :key="probe">{{ reports[probe] || 'waiting' }}</view>
  <view v-for="(item, i) in groups" :key="item.id" :data-index="i">
    <!-- eslint-disable-next-line vue/no-template-shadow -- 回归嵌套同名 item/i 的作用域隔离与 keyed 身份，不能重命名消除遮蔽。 -->
    <Provider v-for="(item, i) in item.rows" :key="item.id" :label="item.label" :seed="item.seed" :data-index="i">
      <Outlet :open="open">
        <Leaf :probe="`${item.label}-main`" :report="true" @ready="ready" />
        <Leaf v-if="late" :probe="`${item.label}-late`" :report="true" @ready="ready" />
      </Outlet>
    </Provider>
  </view>
  <Provider wx:for="{{nativeRows}}" wx:for-item="entry" wx:for-index="position" wx:key="id" :label="entry.label" :seed="entry.seed">
    <Outlet :open="open">
      <Leaf :probe="`${entry.label}-main`" :report="true" @ready="ready" />
      <Leaf v-if="late" :probe="`${entry.label}-late`" :report="true" @ready="ready" />
    </Outlet>
  </Provider>
</template>
