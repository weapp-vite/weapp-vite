<script lang="ts">
import { ref } from 'wevu'

const seed = ref(0)
</script>

<script setup lang="ts">
import { ref } from 'wevu'

const count = ref(seed.value)
</script>

<template>
  <view>
    <text id="plain-dual-count">{{ count }}</text>
    <button id="plain-dual-increment" @tap="count++">Increment dual script</button>
  </view>
</template>
