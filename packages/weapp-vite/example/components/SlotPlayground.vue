<script setup lang="ts">
import SlotHost from './SlotHost.vue'

interface SlotItem {
  id: string
  label: string
  detail: string
}

const props = withDefaults(
  defineProps<{
    items?: SlotItem[]
    footerText?: string
  }>(),
  {
    items: () => [],
    footerText: '具名 footer 插槽',
  },
)
</script>

<template>
  <view class="card">
    <text class="card-title">
      插槽系统
    </text>
    <text class="hint">
      默认 / 具名 / 作用域插槽 + fallback
    </text>

    <SlotHost :items="props.items.length ? props.items : undefined" :default-footer="props.footerText">
      <template #header>
        <text class="header-text">
          具名 header 插槽
        </text>
      </template>

      <template #default="{ items: scopedItems, expanded, toggle }">
        <view class="list">
          <view v-for="item in scopedItems" :key="item.id" class="row">
            <text class="name">
              {{ item.label }}
            </text>
            <text v-if="expanded" class="detail">
              {{ item.detail }}
            </text>
          </view>
        </view>
        <button size="mini" @tap="toggle">
          {{ expanded ? '折叠作用域内容' : '展开作用域内容' }}
        </button>
      </template>

      <template #footer>
        <text class="footer">
          {{ props.footerText }}
        </text>
      </template>
    </SlotHost>

    <SlotHost class="fallback-demo" />
  </view>
</template>

<style scoped>
.card {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 24rpx;
  box-shadow: 0 12rpx 32rpx rgba(0, 0, 0, 0.06);
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.card-title {
  font-size: 30rpx;
  font-weight: 700;
  color: #1a202c;
}

.hint {
  display: block;
  color: #718096;
  font-size: 24rpx;
}

.header-text {
  font-size: 26rpx;
  color: #2b6cb0;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  margin: 12rpx 0;
}

.row {
  display: flex;
  justify-content: space-between;
}

.name {
  color: #2d3748;
  font-size: 24rpx;
}

.detail {
  color: #4a5568;
  font-size: 22rpx;
}

.footer {
  color: #2f855a;
}

.fallback-demo {
  border-color: #c3dafe;
}
</style>
