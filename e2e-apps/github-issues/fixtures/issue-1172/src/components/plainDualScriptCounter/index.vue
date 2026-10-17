<script lang="ts">
// eslint-disable-next-line import/no-duplicates -- 回归两个独立 SFC 脚本各自导入同名绑定。
import { ref } from 'wevu'

const makeSeed = () => ref(0)
</script>

<script setup lang="ts">
// eslint-disable-next-line import/no-duplicates, import/first, ts/no-redeclare -- 编译器必须正确合并两个脚本的同名导入。
import { ref } from 'wevu'

const count = ref(makeSeed().value)
</script>

<template>
  <view>
    <text id="plain-dual-count">{{ count }}</text>
    <button id="plain-dual-increment" @tap="count++">Increment dual script</button>
  </view>
</template>
