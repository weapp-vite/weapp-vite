<script setup lang="ts">
import { computed, reactive, ref } from 'wevu'

import { useLayoutFeedback } from '@/hooks/useLayoutFeedback'

definePageJson({
  navigationBarTitleText: 'Wevu 多端表单',
  usingComponents: {
    't-button': 'tdesign-miniprogram/button/button',
    't-input': 'tdesign-miniprogram/input/input',
    't-rate': 'tdesign-miniprogram/rate/rate',
    't-stepper': 'tdesign-miniprogram/stepper/stepper',
    't-switch': 'tdesign-miniprogram/switch/switch',
    't-tag': 'tdesign-miniprogram/tag/tag',
    't-textarea': 'tdesign-miniprogram/textarea/textarea',
  },
})

const submitted = ref(false)
const { showMessage, showToast } = useLayoutFeedback()
const form = reactive({
  name: '多端体验巡检',
  owner: 'E2E Runner',
  urgent: false,
  count: 3,
  score: 4,
  notes: '覆盖 TDesign 表单组件和多端配置字段。',
})

const summary = computed(() => ({
  priority: form.urgent ? 'urgent' : 'normal',
  coverage: `样本 ${form.count} 页 / 评分 ${form.score}`,
  status: submitted.value ? '已提交' : '待提交',
}))

function getValue<T>(event: WechatMiniprogram.CustomEvent<{ value: T }>, fallback: T) {
  return event.detail?.value ?? fallback
}

function onNameChange(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
  form.name = getValue(event, form.name)
}

function onOwnerChange(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
  form.owner = getValue(event, form.owner)
}

function onUrgentChange(event: WechatMiniprogram.CustomEvent<{ value: boolean }>) {
  form.urgent = getValue(event, form.urgent)
}

function onCountChange(event: WechatMiniprogram.CustomEvent<{ value: number }>) {
  form.count = getValue(event, form.count)
}

function onScoreChange(event: WechatMiniprogram.CustomEvent<{ value: number }>) {
  form.score = getValue(event, form.score)
}

function onNotesChange(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
  form.notes = getValue(event, form.notes)
}

function submitForm() {
  submitted.value = true
  showToast('表单已提交')
}

function showFormMessage() {
  showMessage(`巡检样本 ${form.count} 页，评分 ${form.score}`, form.urgent ? 'warning' : 'info')
}
</script>

<template>
  <view class="page">
    <view class="header">
      <view class="title">
        巡检表单
      </view>
      <view class="subtitle">
        组合输入、开关、步进器、评分和文本域。
      </view>
    </view>

    <view class="panel">
      <view class="field">
        <view class="label">
          任务名称
        </view>
        <t-input :value="form.name" placeholder="输入任务名称" @change="onNameChange" />
      </view>
      <view class="field">
        <view class="label">
          负责人
        </view>
        <t-input :value="form.owner" placeholder="输入负责人" @change="onOwnerChange" />
      </view>
      <view class="field row-field">
        <view>
          <view class="label">
            加急处理
          </view>
          <view class="hint">
            开启后视为高优先级巡检
          </view>
        </view>
        <t-switch :value="form.urgent" @change="onUrgentChange" />
      </view>
      <view class="field row-field">
        <view>
          <view class="label">
            页面样本数
          </view>
          <view class="hint">
            覆盖更多页面与组件组合
          </view>
        </view>
        <t-stepper :value="form.count" :min="1" :max="8" @change="onCountChange" />
      </view>
      <view class="field">
        <view class="label">
          体验评分
        </view>
        <t-rate :value="form.score" @change="onScoreChange" />
      </view>
      <view class="field">
        <view class="label">
          巡检说明
        </view>
        <t-textarea :value="form.notes" autosize placeholder="补充说明" @change="onNotesChange" />
      </view>
    </view>

    <view class="summary">
      <t-tag :theme="form.urgent ? 'danger' : 'success'" variant="light">
        {{ summary.priority }}
      </t-tag>
      <text class="summary-text">
        {{ summary.coverage }}
      </text>
      <text class="summary-text">
        {{ summary.status }}
      </text>
    </view>

    <view class="actions">
      <t-button theme="primary" block @tap="submitForm">
        提交巡检 Toast
      </t-button>
      <t-button theme="default" variant="outline" block @tap="showFormMessage">
        显示表单 Message
      </t-button>
    </view>
  </view>
</template>

<style>
.page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 32rpx;
}

.header,
.panel,
.summary {
  padding: 24rpx;
  background: #fff;
  border: 2rpx solid #e2e8f0;
  border-radius: 16rpx;
}

.header {
  background: #fff7ed;
}

.title {
  font-size: 38rpx;
  font-weight: 700;
  color: #0f172a;
}

.subtitle,
.hint {
  margin-top: 8rpx;
  font-size: 24rpx;
  line-height: 1.55;
  color: #64748b;
}

.panel,
.summary,
.actions {
  margin-top: 20rpx;
}

.field + .field {
  margin-top: 22rpx;
}

.label {
  margin-bottom: 10rpx;
  font-size: 25rpx;
  font-weight: 700;
  color: #0f172a;
}

.row-field {
  display: flex;
  gap: 20rpx;
  align-items: center;
  justify-content: space-between;
}

.summary {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  align-items: center;
}

.summary-text {
  font-size: 24rpx;
  color: #334155;
}
</style>
