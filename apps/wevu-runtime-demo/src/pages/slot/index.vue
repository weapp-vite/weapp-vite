<script setup lang="ts">
const scopedMeta = {
  title: '作用域插槽',
  subtitle: '通过 v-bind 将子组件数据暴露给父组件',
  badge: 'scoped',
}

const checklist = [
  '默认插槽：直接写入组件标签内的内容',
  '具名插槽：使用 #header / #footer 覆盖局部结构',
  '作用域插槽：通过 v-bind 暴露 props 给父组件渲染',
  '小程序具名插槽需开启 multipleSlots，wevu 已默认启用，按官方 slot 写法即可使用',
]
</script>

<template>
  <view class="page">
    <view class="intro">
      <text class="title">
        Vue 插槽
      </text>
      <text class="subtitle">
        在小程序中使用 Vue SFC 的默认、具名与作用域插槽
      </text>
    </view>

    <slot-card title="默认插槽" subtitle="直接写内容即可填充">
      <text class="desc">
        这里是默认插槽的内容，可以放任意节点。
      </text>
      <text class="desc">
        插槽会保留父级的样式与响应式状态。
      </text>
    </slot-card>

    <slot-card title="具名插槽" subtitle="覆盖组件头部与底部" badge="named">
      <template #header>
        <view class="named-header">
          <text class="pill">
            #header
          </text>
          <text class="desc">
            通过具名插槽自定义头部
          </text>
        </view>
      </template>
      <text class="desc">
        主体仍由默认插槽渲染。
      </text>
      <template #footer>
        <text class="footer">
          #footer 可放置按钮、说明等元素。
        </text>
      </template>
    </slot-card>

    <slot-card
      :title="scopedMeta.title"
      :subtitle="scopedMeta.subtitle"
      :badge="scopedMeta.badge"
    >
      <template #default="{ title, subtitle, badge }">
        <view class="desc">
          <text>子组件 title：{{ title }}</text>
          <text>子组件 subtitle：{{ subtitle }}</text>
          <text>子组件 badge：{{ badge }}</text>
        </view>
      </template>
      <template #footer="{ title }">
        <text class="footer">
          footer 同样可以拿到作用域参数：{{ title }}
        </text>
      </template>
    </slot-card>

    <view class="card">
      <text class="card-title">
        要点速览
      </text>
      <view class="tips">
        <view v-for="(item, index) in checklist" :key="index" class="tip">
          <text>{{ item }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style>
/* stylelint-disable order/properties-order */
.page {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  padding: 24rpx;
  box-sizing: border-box;
}

.intro {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.title {
  font-size: 34rpx;
  font-weight: 700;
  color: #0f172a;
}

.subtitle {
  font-size: 26rpx;
  color: #475569;
}

.desc {
  display: block;
  margin-top: 8rpx;
  color: #1f2937;
  font-size: 26rpx;
  line-height: 1.5;
}

.named-header {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.pill {
  padding: 6rpx 12rpx;
  border-radius: 999rpx;
  background: #e0f2fe;
  color: #0369a1;
  font-size: 22rpx;
}

.footer {
  font-size: 24rpx;
  color: #475569;
}

.card {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 20rpx;
  box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.06);
}

.card-title {
  font-size: 28rpx;
  font-weight: 600;
  margin-bottom: 12rpx;
  color: #0f172a;
}

.tips {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.tip {
  padding: 14rpx;
  border-radius: 12rpx;
  background: #f8fafc;
  font-size: 24rpx;
  color: #1f2937;
}
/* stylelint-enable order/properties-order */
</style>

<config lang="json">
{
  "navigationBarTitleText": "Vue 插槽",
  "usingComponents": {
    "slot-card": "/components/slot-card/index"
  }
}
</config>
