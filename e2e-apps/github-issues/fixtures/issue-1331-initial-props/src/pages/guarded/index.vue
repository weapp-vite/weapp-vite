<script setup lang="ts">
import { computed, reactive, ref } from "wevu";
import StatusLabel from "../../components/StatusLabel.vue";

const literal = ref("字面量初值");
const label = computed(() => "就绪");
const createState = () => ({ label: "工厂初值" });
const state = reactive(createState());
</script>

<template>
  <view>同一 setup，仅在模板添加字符串兜底</view>
  <view>字面量：<StatusLabel id="literal" :text="literal" /></view>
  <view>computed：<StatusLabel id="computed" :text="label || ''" /></view>
  <view>工厂：<StatusLabel id="factory" :text="state.label || ''" /></view>
  <navigator url="/pages/raw/index" open-type="reLaunch">打开无兜底复现页</navigator>
</template>
