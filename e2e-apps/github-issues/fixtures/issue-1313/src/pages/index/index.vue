<script setup lang="ts">
import { reactive } from "wevu";

const controls = reactive({
  scope: false,
  settings: false,
});
</script>

<template>
  <button @tap="controls.scope = !controls.scope">
    切换地点与批次
  </button>
  <view v-if="controls.scope">地点与批次设置</view>

  <button @tap="controls.settings = !controls.settings">
    切换重量与分组
  </button>
  <view v-if="controls.settings">重量与分组设置</view>
</template>
