<script setup lang="ts">
/* eslint-disable mini-program/no-implicit-runtime-polyfill -- native 模式验收 Vue SFC 中的自由标识符注入与词法遮蔽。 */
import { onLoad, ref } from 'wevu'

const result = ref('pending')

onLoad(() => {
  const shadowedFetch = () => 'shadowed'
  result.value = [
    atob('dnVl'),
    new URL('https://vue.example/a/../b').pathname,
    typeof fetch,
    shadowedFetch(),
  ].join('|')
})
</script>

<template>
  <view id="route" data-e2e-route="native-vue">native-vue</view>
  <view id="native-vue-result">{{ result }}</view>
</template>
