<script setup lang="ts">
import { ref } from 'wevu'
import Outlet from '../../components/outlet/index.vue'
import PlainContainer from '../../components/plainContainer/index.vue'

const count = ref(0)
const open = ref(true)
</script>

<template>
  <view id="plain-root">
    <PlainContainer />
    <Outlet :open="open">
      <text id="plain-count">{{ count }}</text>
    </Outlet>
    <button id="plain-increment" @tap="count++">Increment</button>
    <button id="plain-toggle" @tap="open = !open">Toggle</button>
  </view>
</template>
