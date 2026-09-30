<script setup lang="ts">
import { ref } from 'wevu'
import SlotProbe from '../../components/slot-probe/index.vue'

const count = ref(0)
const input = ref('initial')
</script>

<template>
  <view>
    <text>wevu 示例</text>
    <text>wevu 计数：{{ count }}</text>
    <button @tap="count++">wevu 加一</button>
    <input v-model="input" placeholder="输入双向绑定内容">
    <text>输入：{{ input }}</text>
    <SlotProbe :value="count">
      <template #header><text>具名插槽</text></template>
      <template #default="scope">
        <text>作用域值：{{ scope.value }}</text>
        <button @tap="count++">插槽加一</button>
      </template>
    </SlotProbe>
  </view>
</template>
