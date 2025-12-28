<script setup lang="ts">
import BasicsSection from './components/BasicsSection.vue'
import DynamicShowcase from './components/DynamicShowcase.vue'
import FormControls from './components/FormControls.vue'
import ListAndCondition from './components/ListAndCondition.vue'
import RenderFunctionShowcase from './components/RenderFunctionShowcase.vue'
import SlotPlayground from './components/SlotPlayground.vue'
import StyleShowcase from './components/StyleShowcase.vue'
</script>

<template>
  <view class="page">
    <text class="page-title">
      Vue 用法全覆盖示例
    </text>
    <text class="page-desc">
      标准 Vue 语法（无 wevu 依赖）的编译与运行要点示例。
    </text>

    <BasicsSection
      :greetings="['你好 weapp-vite', 'Hello Vue', 'Hola Mini Program', 'Bonjour Vite']"
      :initial-active="false"
      :base-font="30"
    />
    <ListAndCondition
      :initial-stock="[
        { id: 11, name: '组件化', description: 'v-for + v-if 示例', featured: true },
        { id: 22, name: 'Props', description: '传入 props 生成列表', featured: false },
      ]"
    />
    <FormControls
      initial-text="demo 输入"
      initial-bio="通过 props 控制初始值"
      :initial-enabled="false"
      :initial-progress="60"
      :picker-options="['准备', '开发', '发布']"
      :picker-index="2"
    />
    <SlotPlayground
      footer-text="来自 props 的 footer 文案"
      :items="[
        { id: 'x', label: 'X-Ray', detail: '作用域数据 X' },
        { id: 'y', label: 'Yarn', detail: '作用域数据 Y' },
      ]"
    />
    <DynamicShowcase
      :items="[
        { id: 1, name: '入口', desc: 'Props 传入的入口项' },
        { id: 2, name: '详情', desc: 'Props 传入的详情项' },
      ]"
      :keep-alive="true"
      :enable-transition="true"
    />
    <StyleShowcase :initial-highlight="true" />
    <RenderFunctionShowcase ts-title="Props 控制 TS Render" tsx-title="Props 控制 TSX" />
  </view>
</template>

<style scoped>
.page {
  padding: 32rpx;
  background: #f5f7fb;
  display: flex;
  flex-direction: column;
  gap: 28rpx;
}

.page-title {
  font-size: 40rpx;
  font-weight: 700;
  color: #111;
}

.page-desc {
  font-size: 26rpx;
  color: #4a5568;
  margin-bottom: 8rpx;
}
</style>

<config>
{
  "navigationBarTitleText": "Vue 示例",
  "navigationBarBackgroundColor": "#111111",
  "navigationBarTextStyle": "white"
}
</config>
