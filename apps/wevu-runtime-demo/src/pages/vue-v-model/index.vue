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
    <view class="page-title">
      v-model 全写法
    </view>

    <view class="section">
      <view class="section-title">
        表单元素
      </view>

      <view class="card">
        <view class="field">
          <text class="label">
            input
          </text>
          <input v-model="text" class="input" placeholder="v-model">
        </view>
        <view class="field">
          <text class="label">
            .lazy
          </text>
          <input v-model.lazy="lazyText" class="input" placeholder="v-model.lazy">
        </view>
        <view class="field">
          <text class="label">
            .number
          </text>
          <input v-model.number="numberText" class="input" type="number" placeholder="v-model.number">
        </view>
        <view class="field">
          <text class="label">
            .trim
          </text>
          <input v-model.trim="trimmed" class="input" placeholder="v-model.trim">
        </view>

        <view class="field row">
          <text class="label">
            switch
          </text>
          <switch v-model="checked" />
          <text class="muted">
            {{ checked }}
          </text>
        </view>

        <view class="field">
          <text class="label">
            radio-group
          </text>
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
          <text class="label">
            checkbox-group
          </text>
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
      <view class="section-title">
        自定义组件 v-model / v-model:arg
      </view>
      <vue-model-field
        v-model="modelValue"
        v-model:title="title"
        v-model:numberValue="numberValue"
        placeholder="通过组件透传更新"
      />
    </view>

    <view class="section">
      <view class="section-title">
        输出
      </view>
      <view class="demo-item">
        <text class="label">
          summary
        </text>
        <button class="btn btn-warning" @tap="reset">
          重置
        </button>
      </view>
      <view class="card">
        <text class="code">
          {{ JSON.stringify(summary, null, 2) }}
        </text>
      </view>
    </view>
  </view>
</template>

<style>
/* stylelint-disable order/properties-order */
.container {
  padding: 24rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  box-sizing: border-box;
}

.page-title {
  font-size: 34rpx;
  font-weight: 700;
}

.section {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 18rpx;
  box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.06);
}

.section-title {
  font-size: 28rpx;
  font-weight: 700;
  margin-bottom: 12rpx;
}

.demo-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
  padding: 14rpx 0;
}

.label {
  font-size: 24rpx;
  color: #475569;
}

.btn {
  padding: 14rpx 18rpx;
  border-radius: 12rpx;
  font-size: 24rpx;
}

.btn-warning {
  background: #f59e0b;
  color: #111827;
}

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

<json>
{
  "navigationBarTitleText": "v-model",
  "usingComponents": {
    "vue-model-field": "/components/vue-model-field/index"
  }
}
</json>
