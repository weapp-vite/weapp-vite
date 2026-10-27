<script setup lang="ts">
import { ref } from 'wevu'
import ConflictProbe from '../../components/conflictProbe/index.vue'
import MutableProbe from '../../components/mutableProbe/index.vue'
import NavBar from '../../components/navBar/index.vue'

const max = ref(3)
const canvas = ref('parent-canvas')

function extendMax() {
  max.value = 4
}

function updateParentCanvas() {
  canvas.value = 'updated-parent'
}
</script>

<template>
  <view id="issue1261-page">
    <NavBar id="nav-probe" :max="max" />
    <button id="extend-max" @tap="extendMax">Extend parent max</button>
    <ConflictProbe id="conflict-probe" :canvas-id="canvas" />
    <MutableProbe id="mutable-probe" :canvas-id="canvas" />
    <button id="update-parent-canvas" @tap="updateParentCanvas">Update parent canvas</button>
  </view>
</template>
