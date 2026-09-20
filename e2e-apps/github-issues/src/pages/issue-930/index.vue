<script setup lang="ts">
/* eslint-disable vue/no-deprecated-html-element-is, vue/no-lone-template -- 该 fixture 专门验证原生 WXML template 定义与调用。 */
import { ref } from 'wevu'
import BindingProbe from '../../components/issue-930/BindingProbe/index.vue'

definePageJson({
  navigationBarTitleText: 'issue-930',
})

// eslint-disable-next-line ts/no-unused-vars -- 编译器会在原生 template is 属性中消费该绑定。
const activeTemplate = ref('issue930Card')
const directiveState = ref('directive-initial')
const modelValue = ref('model-initial')
const records = ref({
  primary: { label: 'member-initial' },
  secondary: { label: 'member-updated' },
})
const selected = ref<'primary' | 'secondary'>('primary')
const templateData = ref({ label: 'template-initial' })
const themeColor = ref('red')

function _runE2E(action?: 'mutate') {
  if (action === 'mutate') {
    directiveState.value = 'directive-updated'
    modelValue.value = 'model-updated'
    selected.value = 'secondary'
    templateData.value = { label: 'template-updated' }
    themeColor.value = 'blue'
  }
  return {
    directiveState: directiveState.value,
    memberValue: records.value[selected.value].label,
    modelValue: modelValue.value,
    templateLabel: templateData.value.label,
    themeColor: themeColor.value,
  }
}

defineExpose({
  _runE2E,
})
</script>

<template>
  <template name="issue930Card">
    <view id="issue-930-template-value">
      {{ label }}
    </view>
  </template>
  <view
    id="issue-930-root"
    v-issue-probe="directiveState"
    :data-member-value="records[selected].label"
  >
    <BindingProbe
      id="issue-930-model-component"
      v-model.trim="modelValue"
    />
    <view id="issue-930-member">
      {{ records[selected].label }}
    </view>
    <template
      is="{{activeTemplate}}"
      data="{{...templateData}}"
    />
  </view>
</template>

<style>
#issue-930-root {
  color: v-bind(themeColor); /* stylelint-disable-line value-keyword-case -- CSS v-bind 变量名区分大小写。 */
}
</style>
