<script lang="ts">
export default {
  data() {
    return {
      features: [
        { title: '基础响应式', desc: 'reactive, ref, 嵌套对象响应式', path: '/pages/basic/index', icon: '🎯' },
        { title: '计算属性', desc: 'computed 只读和可写模式', path: '/pages/computed/index', icon: '🧮' },
        { title: '侦听器', desc: 'watch immediate, deep 选项', path: '/pages/watch/index', icon: '👀' },
        { title: '生命周期', desc: '所有生命周期钩子演示', path: '/pages/lifecycle/index', icon: '♻️' },
        { title: '全生命周期 onXXX', desc: '覆盖 App / 页面 / 分享钩子', path: '/pages/wevu-hooks/index', icon: '🧭' },
        { title: 'Setup 语法', desc: 'setup 函数组合式 API', path: '/pages/setup/index', icon: '⚙️' },
        { title: 'Script Setup', desc: 'script setup 语法糖', path: '/pages/setup-script/index', icon: '🍬' },
        { title: '表单绑定', desc: 'bindModel 双向绑定', path: '/pages/form/index', icon: '📝' },
        { title: '列表渲染', desc: '数组操作和响应式更新', path: '/pages/list/index', icon: '📋' },
        { title: '组件通信', desc: '父子组件通信和事件', path: '/pages/component/index', icon: '🔗' },
        { title: '插槽', desc: '默认、具名与作用域插槽', path: '/pages/slot/index', icon: '🧩' },
        { title: '组件互操作', desc: 'Vue 组件与原生组件互引', path: '/pages/component-interop/index', icon: '🧩' },
        { title: '状态管理', desc: 'Store 跨页面状态共享', path: '/pages/store/index', icon: '🏪' },
        { title: 'Store 跨页面', desc: '多个页面复用同一 store 实例', path: '/pages/store-shared/index', icon: '🛰️' },
        { title: 'Vue 模板指令', desc: 'v-if/v-for/v-show/v-text/v-html 等', path: '/pages/vue-template/index', icon: '🧱' },
        { title: '属性与样式', desc: ':class/:style/v-bind 透传', path: '/pages/vue-bindings/index', icon: '🎨' },
        { title: '事件绑定', desc: '@click/@tap 与修饰符写法', path: '/pages/vue-events/index', icon: '🖱️' },
        { title: 'v-model', desc: '表单 + 自定义组件 v-model:arg', path: '/pages/vue-v-model/index', icon: '🔁' },
        { title: '插槽进阶', desc: 'v-slot/# 动态插槽名', path: '/pages/vue-slots-advanced/index', icon: '🧩' },
        { title: '动态组件', desc: 'component :is / keep-alive / transition 等', path: '/pages/vue-dynamic/index', icon: '🧬' },
        { title: 'Script Setup 宏', desc: 'defineProps/defineEmits/useAttrs 等', path: '/pages/vue-script-setup/index', icon: '🧪' },
        { title: 'Render 函数', desc: 'render() + h() 写法', path: '/pages/vue-render/index', icon: '🧠' },
        { title: '样式写法', desc: 'scoped + CSS modules', path: '/pages/vue-style/index', icon: '👗' },
        { title: '高级特性', desc: '插件、全局属性等', path: '/pages/advanced/index', icon: '🚀' },
      ],
    }
  },
  methods: {
    navigateTo(event: any) {
      const { path } = event.currentTarget.dataset
      wx.navigateTo({ url: path })
    },
  },
}
</script>

<template>
  <view class="container">
    <view class="header">
      <text class="title">
        WeVu 综合示例
      </text>
      <text class="subtitle">
        探索所有 WeVu 功能特性
      </text>
    </view>

    <view class="feature-grid">
      <view v-for="item in features" :key="item.path" class="feature-cell">
        <view class="feature-item" :data-path="item.path" @click="navigateTo">
          <view class="feature-icon">
            {{ item.icon }}
          </view>
          <text class="feature-title">
            {{ item.title }}
          </text>
          <text class="feature-desc">
            {{ item.desc }}
          </text>
        </view>
      </view>
    </view>
  </view>
</template>

<style>
/* stylelint-disable order/properties-order */
.header {
  padding: 48rpx 32rpx;
  text-align: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  border-radius: 0 0 32rpx 32rpx;
  margin-bottom: 32rpx;
}

.title {
  display: block;
  font-size: 52rpx;
  font-weight: 700;
  margin-bottom: 16rpx;
}

.subtitle {
  display: block;
  font-size: 28rpx;
  opacity: 0.9;
}

.feature-grid {
  display: flex;
  flex-wrap: wrap;
  padding: 0 24rpx 32rpx;
}

.feature-cell {
  width: 33.3333%;
  padding: 8rpx;
  box-sizing: border-box;
}

.feature-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  background: #fff;
  border-radius: 16rpx;
  padding: 20rpx;
  box-shadow: 0 2rpx 12rpx rgb(0 0 0 / 8%);
  transition: transform 0.2s;
  min-height: 220rpx;
}

.feature-item:active {
  transform: scale(0.98);
}

.feature-icon {
  font-size: 56rpx;
  margin-bottom: 12rpx;
}

.feature-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 8rpx;
}

.feature-desc {
  font-size: 22rpx;
  color: #666;
  line-height: 1.4;
}
/* stylelint-enable order/properties-order */
</style>

<config lang="json">
{
  "navigationBarTitleText": "WeVu 综合示例"
}
</config>
