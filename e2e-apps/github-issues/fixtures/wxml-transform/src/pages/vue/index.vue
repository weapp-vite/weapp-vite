<script setup lang="ts">
import { ref } from 'wevu'

const label = ref('dynamic')
const count = ref(0)
const track = ref('')
function tap(event: { currentTarget: { dataset: { analytics: string } } }) {
  count.value++
  track.value = event.currentTarget.dataset.analytics
}
</script>

<template>
<div :data-label="label" id="transform-root" data-testid="remove">
  <text id="retained" data-testid="keep">retained</text>
  <text id="renamed" data-use-view data-clean="remove">renamed</text>
  <button id="tap" data-track="track" @tap="tap">tap</button>
  <div id="result">{{count}}:{{track}}</div>
</div>
</template>
