<script setup lang="ts">
import { shallowRef } from 'wevu'
import Leaf from '../../components/leaf/index.vue'
import Provider from '../../components/provider/index.vue'

const mounted = shallowRef(true)
const seed = shallowRef(0)

function detach() {
  mounted.value = false
}

function recreate() {
  seed.value += 40
  mounted.value = true
}
</script>

<template>
  <view id="mount-state">{{ mounted ? 'mounted' : 'detached' }}</view>
  <button v-if="mounted" id="detach" @tap="detach">Detach provider</button>
  <button v-else id="recreate" @tap="recreate">Create fresh provider</button>
  <Provider v-if="mounted" label="current" :seed="seed">
    <Leaf probe="current" />
  </Provider>
</template>
