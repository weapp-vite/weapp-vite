<script setup lang="ts">
import { computed, ref } from 'wevu'

const text = ref('')
const lazyText = ref('')
const numberText = ref<number | null>(null)
const trimmed = ref('')

const checked = ref(false)
const picked = ref('b')
const checkbox = ref<string[]>(['b'])

const modelValue = ref('hello')
const title = ref('title')
const numberValue = ref(1)

const summary = computed(() => ({
  text: text.value,
  lazyText: lazyText.value,
  numberText: numberText.value,
  trimmed: trimmed.value,
  checked: checked.value,
  picked: picked.value,
  checkbox: checkbox.value,
  modelValue: modelValue.value,
  title: title.value,
  numberValue: numberValue.value,
}))

function reset() {
  text.value = ''
  lazyText.value = ''
  numberText.value = null
  trimmed.value = ''
  checked.value = false
  picked.value = 'b'
  checkbox.value = ['b']
  modelValue.value = 'hello'
  title.value = 'title'
  numberValue.value = 1
}
</script>

<template>
  <view class="container">
    <view class="page-title">v-model 全写法</view>

    <view class="section">
      <view class="section-title">表单元素</view>

      <view class="card">
        <view class="field">
          <text class="label">input</text>
          <input class="input" v-model="text" placeholder="v-model" />
        </view>
        <view class="field">
          <text class="label">.lazy</text>
          <input class="input" v-model.lazy="lazyText" placeholder="v-model.lazy" />
        </view>
        <view class="field">
          <text class="label">.number</text>
          <input class="input" v-model.number="numberText" type="number" placeholder="v-model.number" />
        </view>
        <view class="field">
          <text class="label">.trim</text>
          <input class="input" v-model.trim="trimmed" placeholder="v-model.trim" />
        </view>

        <view class="field row">
          <text class="label">switch</text>
          <switch v-model="checked" />
          <text class="muted">{{ checked }}</text>
        </view>

        <view class="field">
          <text class="label">radio-group</text>
          <radio-group v-model="picked">
            <label class="choice">
              <radio value="a" /> A
            </label>
            <label class="choice">
              <radio value="b" /> B
            </label>
            <label class="choice">
              <radio value="c" /> C
            </label>
          </radio-group>
        </view>

        <view class="field">
          <text class="label">checkbox-group</text>
          <checkbox-group v-model="checkbox">
            <label class="choice">
              <checkbox value="a" /> A
            </label>
            <label class="choice">
              <checkbox value="b" /> B
            </label>
            <label class="choice">
              <checkbox value="c" /> C
            </label>
          </checkbox-group>
        </view>
      </view>
    </view>

    <view class="section">
      <view class="section-title">自定义组件 v-model / v-model:arg</view>
      <vue-model-field
        v-model="modelValue"
        v-model:title="title"
        v-model:numberValue="numberValue"
        placeholder="通过组件透传更新"
      />
    </view>

    <view class="section">
      <view class="section-title">输出</view>
      <view class="demo-item">
        <text class="label">summary</text>
        <button class="btn btn-warning" @click="reset">重置</button>
      </view>
      <view class="card">
        <text class="code">{{ JSON.stringify(summary, null, 2) }}</text>
      </view>
    </view>
  </view>
</template>

<style>
/* stylelint-disable order/properties-order */
.card {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  padding: 16rpx;
  border-radius: 16rpx;
  background: #f8fafc;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.row {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.label {
  font-size: 24rpx;
  color: #475569;
}

.muted {
  font-size: 22rpx;
  color: #64748b;
}

.input {
  padding: 14rpx 16rpx;
  background: #ffffff;
  border-radius: 12rpx;
  border: 1rpx solid #e2e8f0;
  font-size: 26rpx;
}

.choice {
  display: inline-flex;
  align-items: center;
  gap: 10rpx;
  margin-right: 18rpx;
  font-size: 24rpx;
  color: #0f172a;
}

.code {
  font-size: 22rpx;
  color: #0f172a;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  white-space: pre-wrap;
}
/* stylelint-enable order/properties-order */
</style>

<config lang="json">
{
  "navigationBarTitleText": "v-model",
  "usingComponents": {
    "vue-model-field": "/components/vue-model-field/index"
  }
}
</config>
