<script setup lang="ts">
import { ref } from 'wevu'
import ApplyProbe from '../../components/ApplyProbe.vue'
import EmitProbe from '../../components/EmitProbe.vue'
import IsolatedProbe from '../../components/IsolatedProbe.vue'
import PropProbe from '../../components/PropProbe.vue'
import SharedProbe from '../../components/SharedProbe.vue'

const clicks = ref(0)
const details = ref('')
const changes = ref(0)
const enabled = ref(false)
const nativeClicks = ref(0)
function clicked(payload: { marker: string }) {
  clicks.value++
  details.value = payload?.marker ?? 'native'
}
function changed() {
  changes.value++
}
function toggle() {
  enabled.value = !enabled.value
}
function nativeClick() {
  nativeClicks.value++
}
</script>

<template>
  <view id="global-style" class="global-probe inline-probe">Global style</view>
  <view id="theme-style" class="theme-probe">Theme variable</view>
  <EmitProbe @click="clicked" @confirmed="changed" />
  <view id="click-count">{{ clicks }}</view>
  <view id="event-detail">{{ details }}</view>
  <view id="custom-count">{{ changes }}</view>
  <button id="native-click" @tap="nativeClick">Native tap</button>
  <view id="native-count">{{ nativeClicks }}</view>
  <PropProbe id="default-prop" />
  <PropProbe id="controlled-prop" :back="enabled" />
  <PropProbe id="true-prop" :back="true" />
  <button id="toggle-prop" @tap="toggle">Toggle prop</button>
  <IsolatedProbe id="isolated-probe" />
  <SharedProbe id="shared-probe" />
  <ApplyProbe id="apply-probe" />
</template>

<style>
.theme-probe { color: var(--issue-theme); }
</style>
