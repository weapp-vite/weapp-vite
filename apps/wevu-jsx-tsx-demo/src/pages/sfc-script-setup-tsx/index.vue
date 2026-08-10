<script setup lang="tsx">
import { ref } from 'wevu'

const label = ref('setup-tsx-ready')
const fragment = <text id="sfc-setup-tsx-fragment">{label.value}</text>

function updateLabel() {
  label.value = 'setup-tsx-updated'
}

void fragment
</script>

<template>
  <view class="page">
    <view class="title">
      SFC script setup TSX
    </view>
    <text id="sfc-setup-tsx-label">
      {{ label }}
    </text>
    <button id="sfc-setup-tsx-update" @tap="updateLabel">
      update
    </button>
  </view>
</template>
