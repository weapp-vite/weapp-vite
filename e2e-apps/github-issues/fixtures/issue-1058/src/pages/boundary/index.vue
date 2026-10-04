<script setup lang="ts">
import { ref } from 'wevu'
import Month from '../../components/CaseCard/index.vue'

const visible = ref(true)
</script>

<template>
  <view id="boundary-page">
    <template v-if="visible">
      <Month id="lowercase" label="explicit-lowercase" />
      <Month id="explicit-pascal" label="explicit-pascal" />
    </template>
    <button id="toggle" @tap="visible = !visible">
      {{ visible ? 'visible' : 'hidden' }}
    </button>
  </view>
</template>
