<script setup lang="ts">
import { shallowRef } from 'wevu'
import ForwardedOutlet from '../../components/forwardedOutlet/index.vue'
import Leaf from '../../components/leaf/index.vue'
import Outlet from '../../components/outlet/index.vue'
import Provider from '../../components/provider/index.vue'

const open = shallowRef(false)
const reports = shallowRef<Record<string, string>>({})
const setups: Record<string, number> = {}
const probes = ['closed', 'forwarded-default', 'forwarded-named']

function ready(report: { probe: string, owner: string, identity: string }) {
  const count = (setups[report.probe] ?? 0) + 1
  setups[report.probe] = count
  reports.value = { ...reports.value, [report.probe]: `${report.owner}:${report.identity}:${count}` }
}

function toggle() {
  open.value = !open.value
}
</script>

<template>
  <button id="toggle-outlet" @tap="toggle">Toggle outlets</button>
  <text id="outlet-state">{{ open ? 'open' : 'closed' }}</text>
  <view v-for="probe in probes" :id="`ready-${probe}`" :key="probe">{{ reports[probe] || 'waiting' }}</view>
  <Provider label="closed" :seed="7">
    <Outlet :open="open">
      <view><Leaf probe="closed" :report="true" @ready="ready" /></view>
    </Outlet>
  </Provider>
  <Provider label="forwarded-outer" :seed="100">
    <ForwardedOutlet label="forwarded" :seed="20" :open="open">
      <Leaf probe="forwarded-default" :report="true" @ready="ready" />
      <Leaf slot="named" probe="forwarded-named" :report="true" @ready="ready" />
    </ForwardedOutlet>
  </Provider>
</template>
