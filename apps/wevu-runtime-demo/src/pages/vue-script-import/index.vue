<script setup lang="ts">
import { ref } from 'wevu'
import SlotCard from '../../components/slot-card/index.vue'
import VueModelField from '../../components/vue-model-field/index.vue'

const message = ref('script setup 直接引入 .vue 组件')
const title = ref('显式 import 的组件可以直接参与模板推导')
const count = ref(3)
const logs = ref<string[]>([
  '页面没有写 usingComponents。',
  '组件来自 <script setup> 里的本地 import。',
  '模板里直接使用 PascalCase 组件标签。',
])

function onChange(value: string) {
  logs.value = [
    `change: ${value || '(empty)'}`,
    ...logs.value.slice(0, 2),
  ]
}
</script>

<template>
  <view class="page">
    <view class="hero">
      <text class="hero-title">
        Script Setup 显式引入组件
      </text>
      <text class="hero-desc">
        这个页面专门验证 script setup 显式 import Vue SFC 的路径，不依赖 usingComponents。
      </text>
    </view>

    <SlotCard
      :title="title"
      subtitle="当前页面模板直接消费 import 进来的 Vue SFC"
      badge="import"
      class="import-demo-card"
    >
      <text class="body-text">
        {{ message }}
      </text>

      <template #footer>
        <text class="footer-text">
          count = {{ count }}
        </text>
      </template>
    </SlotCard>

    <view class="panel">
      <text class="panel-title">
        交互组件同样来自 script import
      </text>
      <VueModelField
        v-model="message"
        v-model:title="title"
        v-model:numberValue="count"
        placeholder="修改消息"
        @change="onChange"
      />
    </view>

    <view class="panel">
      <text class="panel-title">
        观测点
      </text>
      <view v-for="item in logs" :key="item" class="log-row">
        <text>{{ item }}</text>
      </view>
    </view>
  </view>
</template>

<style>
/* stylelint-disable order/properties-order */
.page {
  padding: 24rpx;
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  box-sizing: border-box;
}

.hero {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  padding: 20rpx;
  border-radius: 18rpx;
  background: linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%);
  color: #ffffff;
}

.hero-title {
  display: block;
  font-size: 32rpx;
  font-weight: 700;
}

.hero-desc {
  display: block;
  font-size: 24rpx;
  line-height: 1.6;
  opacity: 0.88;
}

.import-demo-card {
  display: block;
}

.body-text {
  display: block;
  margin-top: 8rpx;
  font-size: 26rpx;
  color: #1f2937;
  line-height: 1.6;
}

.footer-text {
  display: block;
  font-size: 24rpx;
  color: #475569;
}

.panel {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  padding: 20rpx;
  border-radius: 18rpx;
  background: #ffffff;
  box-shadow: 0 10rpx 28rpx rgba(15, 23, 42, 0.06);
}

.panel-title {
  font-size: 28rpx;
  font-weight: 700;
  color: #0f172a;
}

.log-row {
  padding: 14rpx 16rpx;
  border-radius: 12rpx;
  background: #f8fafc;
  font-size: 24rpx;
  color: #334155;
  line-height: 1.6;
}
/* stylelint-enable order/properties-order */
</style>

<json>
{
  "navigationBarTitleText": "Script Import",
  "navigationBarBackgroundColor": "#0f172a",
  "navigationBarTextStyle": "white"
}
</json>
