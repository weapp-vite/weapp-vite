<script lang="ts">
export default {
  data() {
    return {
      features: [
        '全局属性注册',
        '插件系统',
        '性能优化',
        '错误处理',
        '类型推导',
      ],
    }
  },
}
</script>

<template>
  <view class="container">
    <view class="page-title">
      高级特性
    </view>

    <view class="section">
      <view class="section-title">
        功能列表
      </view>
      <view class="feature-list">
        <view v-for="(item0, index0) in features" :key="item0" class="feature-item">
          <text class="feature-icon">
            🚀{{ index0 }}
          </text>
          <text class="feature-text">
            {{ item0 }}
          </text>
        </view>
      </view>
    </view>

    <view class="tip">
      <text class="tip-text">
        💡 这些高级特性帮助构建更强大的应用
      </text>
    </view>
  </view>
</template>

<style>
/* stylelint-disable order/properties-order */
.feature-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.feature-item {
  display: flex;
  align-items: center;
  padding: 24rpx;
  background: #f5f7fa;
  border-radius: 8rpx;
}

.feature-icon {
  font-size: 40rpx;
  margin-right: 24rpx;
}

.feature-text {
  font-size: 28rpx;
  color: #333;
}
/* stylelint-enable order/properties-order */
</style>

<config lang="ts">
// 高级特性：支持异步配置
import type { Page } from '@weapp-core/json'

// 可以使用 async 函数动态生成配置
export default async () => {
  // 模拟异步操作（例如从 API 获取配置）
  // const remoteConfig = await fetchRemoteConfig()

  return {
    navigationBarTitleText: '高级特性',
    navigationBarBackgroundColor: '#fa709a',
    navigationBarTextStyle: 'white',
    backgroundColor: '#f5f7fa',
  } satisfies Page
}
</config>
