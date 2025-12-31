<script lang="ts">
import { computed, ref } from 'wevu'

export default {
  setup() {
    const slotName = ref<'header' | 'footer'>('header')
    const counter = ref(0)
    const label = computed(() => (slotName.value === 'header' ? '#header' : '#footer'))

    function toggleSlot() {
      slotName.value = slotName.value === 'header' ? 'footer' : 'header'
    }

    function increment() {
      counter.value += 1
    }

    return {
      counter,
      label,
      slotName,
      increment,
      toggleSlot,
    }
  },
  data() {
    return {
      slotTips: [
        '在组件标签内写入内容即可填充默认插槽。',
        '使用 #header、#footer 等具名插槽，按需覆盖组件的局部结构。',
        '作用域插槽可通过 v-bind 暴露 props 给父组件自由渲染。',
        '小程序组件需启用 multipleSlots；WeVu 已默认开启，直接按文档的 slot="xxx" 写法即可。',
      ],
    }
  },
}
</script>

<template>
  <view class="container">
    <view class="page-title">
      插槽
    </view>

    <view class="section">
      <view class="section-title">
        默认插槽
      </view>
      <vue-card title="默认插槽" subtitle="直接写入组件标签即可填充">
        <text class="slot-desc">
          这是传递给默认插槽的内容。
        </text>
        <text class="slot-desc">
          支持多行文本与任意节点。
        </text>
      </vue-card>
    </view>

    <view class="section">
      <view class="section-title">
        具名插槽
      </view>
      <vue-card title="具名插槽" subtitle="自定义头部与底部" badge="slot">
        <template #header>
          <view class="slot-header">
            <text class="slot-tag">
              #header
            </text>
            <text class="slot-title">
              使用具名插槽覆盖组件头部
            </text>
          </view>
        </template>
        <text class="slot-desc">
          默认插槽仍可正常使用，作为卡片主体。
        </text>
        <template #footer>
          <text class="slot-footer">
            #footer 插槽渲染在组件底部
          </text>
        </template>
      </vue-card>
    </view>

    <view class="section">
      <view class="section-title">
        作用域插槽
      </view>
      <vue-card title="作用域插槽" subtitle="父组件可接收子组件暴露的插槽参数" badge="scoped">
        <template #default="{ title, subtitle, badge }">
          <view class="slot-desc">
            <text>子组件 title：{{ title }}</text>
            <text>子组件 subtitle：{{ subtitle || '未设置' }}</text>
            <text>子组件 badge：{{ badge || '无' }}</text>
          </view>
        </template>
        <template #footer="{ title }">
          <text class="slot-footer">
            footer 也能拿到作用域参数，当前标题：{{ title }}
          </text>
        </template>
      </vue-card>
    </view>

    <view class="section">
      <view class="section-title">
        插槽进阶
      </view>
      <view class="demo-item">
        <text class="label">
          动态插槽：{{ label }}
        </text>
        <button class="btn btn-primary" @click="toggleSlot">
          切换
        </button>
      </view>
      <view class="demo-item">
        <text class="label">
          counter: {{ counter }}
        </text>
        <button class="btn btn-success" @click="increment">
          +1
        </button>
      </view>

      <vue-slot-lab title="Slot Lab" subtitle="覆盖 v-slot / # / 动态插槽">
        <template #[slotName]>
          <view class="slot-box">
            <text class="slot-title">
              {{ label }} content
            </text>
            <text class="slot-muted">
              counter={{ counter }}
            </text>
          </view>
        </template>

        <template #default="{ items, now }">
          <view class="slot-box">
            <text class="slot-title">
              默认插槽（作用域参数）
            </text>
            <text class="slot-muted">
              now(): {{ now() }}
            </text>
            <view class="chips">
              <view v-for="item in items" :key="item.id" class="chip">
                <text>{{ item.name }}</text>
              </view>
            </view>
          </view>
        </template>

        <template #footer="{ time }">
          <view class="slot-box">
            <text class="slot-title">
              #footer scope
            </text>
            <text class="slot-muted">
              time={{ time }}
            </text>
          </view>
        </template>
      </vue-slot-lab>
    </view>

    <view class="section">
      <view class="section-title">
        要点速览
      </view>
      <view class="tips">
        <view v-for="(item, index) in slotTips" :key="index" class="tip-item">
          <text>{{ item }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style>
/* stylelint-disable order/properties-order */
.slot-desc {
  display: block;
  margin-bottom: 8rpx;
  color: #374151;
  font-size: 26rpx;
  line-height: 1.5;
}

.slot-header {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.slot-tag {
  padding: 6rpx 12rpx;
  border-radius: 999rpx;
  background: #eef2ff;
  color: #4f46e5;
  font-size: 22rpx;
}

.slot-title {
  font-size: 28rpx;
  color: #1f2937;
}

.slot-footer {
  font-size: 24rpx;
  color: #6b7280;
}

.tips {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.slot-box {
  padding: 14rpx;
  border-radius: 14rpx;
  background: #f1f5f9;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.slot-title {
  font-size: 26rpx;
  font-weight: 600;
  color: #0f172a;
}

.slot-muted {
  font-size: 22rpx;
  color: #64748b;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
}

.chip {
  padding: 6rpx 12rpx;
  border-radius: 999rpx;
  background: #e0f2fe;
  color: #0369a1;
  font-size: 22rpx;
}

.tip-item {
  padding: 16rpx;
  border-radius: 12rpx;
  background: #f3f4f6;
  color: #374151;
  font-size: 24rpx;
  line-height: 1.5;
}
/* stylelint-enable order/properties-order */
</style>

<json>
{
  "navigationBarTitleText": "插槽",
  "usingComponents": {
    "vue-card": "/components/vue-card/index",
    "vue-slot-lab": "/components/vue-slot-lab/index"
  }
}
</json>
