<script setup lang="ts">
import { ref } from 'wevu'

defineOptions({
  name: 'UiTDesignPickerPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'TDesign / t-picker',
}))

const visible = ref(false)
const value = ref(['A', '1'])
const optionsA = ref(['A', 'B', 'C'])
const optionsB = ref(['1', '2', '3'])
function open() { visible.value = true }
function onConfirm(event) { const v = event?.detail?.value; if (Array.isArray(v)) value.value = v; visible.value = false }
function onCancel() { visible.value = false }
</script>

<template>
  <view class="container">
    <view class="page-title">
      t-picker
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <t-button size="small" variant="outline" @click="open">打开</t-button>
      <t-picker title="picker" :visible="visible" :value="value" @confirm="onConfirm" @cancel="onCancel">
        <t-picker-item :options="optionsA" />
        <t-picker-item :options="optionsB" />
      </t-picker>
    </view>
  </view>
</template>

