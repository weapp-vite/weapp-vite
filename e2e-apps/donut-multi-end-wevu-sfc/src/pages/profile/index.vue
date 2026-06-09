<script setup lang="ts">
import { computed, ref } from 'wevu'
import { useRoute, useRouter } from 'wevu/router'

definePageJson({
  navigationBarTitleText: 'Wevu 多端资料',
  usingComponents: {
    't-button': 'tdesign-miniprogram/button/button',
    't-cell': 'tdesign-miniprogram/cell/cell',
    't-cell-group': 'tdesign-miniprogram/cell-group/cell-group',
    't-switch': 'tdesign-miniprogram/switch/switch',
    't-tag': 'tdesign-miniprogram/tag/tag',
  },
})

const route = useRoute()
const router = useRouter()
const edits = ref(0)
const enabled = ref(true)

const source = computed(() => {
  const value = route.query.from
  return Array.isArray(value) ? value[0] || '' : value || ''
})

const profile = computed(() => ({
  status: 'loaded',
  entry: 'profile',
  from: source.value,
  edits: edits.value,
  mode: enabled.value ? 'multi-end' : 'standalone',
}))

const rows = computed(() => [
  { title: 'Status', note: profile.value.status },
  { title: 'Entry', note: profile.value.entry },
  { title: 'From', note: profile.value.from || 'direct' },
  { title: 'Edits', note: String(profile.value.edits) },
  { title: 'Mode', note: profile.value.mode },
])

function updateProfile() {
  edits.value += 1
}

function toggleMode(event: WechatMiniprogram.CustomEvent<{ value: boolean }>) {
  enabled.value = event.detail.value
}

async function backHome() {
  await router.nativeRouter.reLaunch({
    url: '/pages/index/index',
  })
}
</script>

<template>
  <view class="page">
    <view class="header">
      <view class="title">
        Profile
      </view>
      <view class="subtitle">
        多端资料页展示路由参数、状态更新与 TDesign 单元格。
      </view>
      <view class="tags">
        <t-tag theme="primary" variant="light">
          {{ profile.mode }}
        </t-tag>
        <t-tag theme="success" variant="light">
          {{ profile.status }}
        </t-tag>
      </view>
    </view>

    <view class="panel">
      <t-cell-group>
        <t-cell
          v-for="row in rows"
          :key="row.title"
          :title="row.title"
          :note="row.note"
        />
      </t-cell-group>
    </view>

    <view class="panel row-field">
      <view>
        <view class="label">
          多端资料模式
        </view>
        <view class="hint">
          切换后更新计算状态
        </view>
      </view>
      <t-switch :value="enabled" @change="toggleMode" />
    </view>

    <view class="actions">
      <t-button class="action-button" theme="primary" block @tap="updateProfile">
        Update profile
      </t-button>
      <t-button class="action-button" theme="default" variant="outline" block @tap="backHome">
        Back home
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
.panel {
  padding: 24rpx;
  background: #fff;
  border: 2rpx solid #e2e8f0;
  border-radius: 16rpx;
}

.title {
  font-size: 40rpx;
  font-weight: 700;
  color: #0f172a;
}

.subtitle,
.hint {
  margin-top: 10rpx;
  font-size: 24rpx;
  line-height: 1.55;
  color: #64748b;
}

.tags,
.actions,
.row-field {
  display: flex;
  gap: 14rpx;
  align-items: center;
}

.tags {
  flex-wrap: wrap;
  margin-top: 16rpx;
}

.panel,
.actions {
  margin-top: 20rpx;
}

.row-field {
  justify-content: space-between;
}

.label {
  font-size: 26rpx;
  font-weight: 700;
  color: #0f172a;
}

.action-button {
  flex: 1;
}
</style>
