<script setup lang="ts">
import { ref } from 'vue'

interface FormProps {
  initialText?: string
  initialBio?: string
  initialEnabled?: boolean
  initialProgress?: number
  pickerOptions?: string[]
  pickerIndex?: number
}

const props = withDefaults(defineProps<FormProps>(), {
  initialText: 'weapp-vite',
  initialBio: '将 Vue SFC 转成小程序的示例。',
  initialEnabled: true,
  initialProgress: 40,
  pickerOptions: () => ['原型', '开发中', '已上线'],
  pickerIndex: 1,
})

const text = ref(props.initialText)
const bio = ref(props.initialBio)
const enabled = ref(props.initialEnabled)
const progress = ref(props.initialProgress)
const pickerIndex = ref(props.pickerIndex)

function reset() {
  text.value = props.initialText
  bio.value = props.initialBio
  enabled.value = props.initialEnabled
  progress.value = props.initialProgress
  pickerIndex.value = props.pickerIndex
}
</script>

<template>
  <view class="card">
    <text class="card-title">
      表单双向绑定
    </text>
    <text class="hint">
      v-model：input / textarea / switch / slider / picker
    </text>

    <view class="field">
      <text class="label">
        文本输入
      </text>
      <input v-model="text" placeholder="输入任意内容">
    </view>

    <view class="field">
      <text class="label">
        多行文本
      </text>
      <textarea v-model="bio" placeholder="介绍一下场景" />
    </view>

    <view class="field inline">
      <text class="label">
        启用状态
      </text>
      <switch v-model="enabled" />
    </view>

    <view class="field">
      <text class="label">
        进度滑块
      </text>
      <slider v-model="progress" min="0" max="100" step="10" />
    </view>

    <view class="field">
      <text class="label">
        阶段选择
      </text>
      <picker v-model="pickerIndex" mode="selector" :range="pickerOptions">
        <view class="picker-display">
          <text>
            当前：{{ pickerOptions[pickerIndex] }}
          </text>
        </view>
      </picker>
    </view>

    <view class="summary">
      <text>
        文本：{{ text }}
      </text>
      <text>
        介绍：{{ bio }}
      </text>
      <text>
        启用：{{ enabled ? '是' : '否' }}
      </text>
      <text>
        进度：{{ progress }}%
      </text>
      <text>
        阶段：{{ pickerOptions[pickerIndex] }}
      </text>
    </view>

    <view class="actions">
      <button size="mini" @tap="reset">
        重置
      </button>
    </view>
  </view>
</template>

<style scoped>
.card {
  padding: 24rpx;
  background: #fff;
  border-radius: 16rpx;
  box-shadow: 0 12rpx 32rpx rgb(0 0 0 / 6%);
}

.card-title {
  font-size: 30rpx;
  font-weight: 700;
  color: #1a202c;
}

.hint {
  display: block;
  margin-bottom: 16rpx;
  font-size: 24rpx;
  color: #718096;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  margin-bottom: 18rpx;
}

.field.inline {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.label {
  font-size: 24rpx;
  color: #2d3748;
}

.picker-display {
  padding: 12rpx 16rpx;
  color: #2d3748;
  background: #f7fafc;
  border-radius: 12rpx;
}

.summary {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  padding: 14rpx;
  font-size: 24rpx;
  color: #2d3748;
  background: #f7fafc;
  border-radius: 12rpx;
}

.actions {
  margin-top: 12rpx;
}
</style>
