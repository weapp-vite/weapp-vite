<script setup lang="ts">
import { computed, reactive, ref } from "wevu";
import StatusLabel from "../../components/StatusLabel.vue";

const literal = ref("字面量初值");
const label = computed(() => "就绪");
const createState = () => ({ label: "工厂初值" });
const state = reactive(createState());
</script>

<template>
  <view>无模板兜底：观察冷启动时的属性类型警告</view>
  <view>字面量：<StatusLabel id="literal" :text="literal" /></view>
  <view>computed：<StatusLabel id="computed" :text="label" /></view>
  <view>工厂：<StatusLabel id="factory" :text="state.label" /></view>
  <navigator url="/pages/guarded/index" open-type="reLaunch">打开模板兜底对照页</navigator>
</template>
