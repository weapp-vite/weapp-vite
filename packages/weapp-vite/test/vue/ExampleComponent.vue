<template>
  <view class="container">
    <!-- Header Section -->
    <view class="header">
      <text class="title">{{ title }}</text>
      <text class="subtitle">{{ subtitle }}</text>
    </view>

    <!-- Counter Example with v-model -->
    <view class="section">
      <text class="section-title">Counter: {{ count }}</text>
      <input v-model="inputValue" placeholder="Type something..." />
      <text>You typed: {{ inputValue }}</text>
    </view>

    <!-- List Example with v-for -->
    <view class="section">
      <text class="section-title">Items List:</text>
      <view
        v-for="(item, index) in items"
        :key="item.id"
        class="item"
        @tap="selectItem(item)"
      >
        <text>{{ index + 1 }}. {{ item.name }}</text>
      </view>
    </view>

    <!-- Conditional Rendering -->
    <view class="section">
      <view v-if="isVisible" class="notice">
        <text>This is visible</text>
      </view>
      <view v-else class="notice hidden">
        <text>This is hidden</text>
      </view>
    </view>

    <!-- Dynamic Component -->
    <view class="section">
      <component :is="currentComponent" :data="componentData" />
    </view>

    <!-- Transition Example -->
    <transition name="fade">
      <view v-if="showTransition" class="fade-box">
        <text>Fade Transition</text>
      </view>
    </transition>

    <!-- Buttons -->
    <view class="actions">
      <button @click="increment">Increment</button>
      <button @click="toggle">Toggle Visibility</button>
      <button @click="switchComponent">Switch Component</button>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'

// State
const title = ref('Vue SFC Example')
const subtitle = ref('Built with weapp-vite')
const count = ref(0)
const inputValue = ref('')
const isVisible = ref(true)
const showTransition = ref(true)
const currentComponent = ref('home')
const componentData = ref({ message: 'Hello from component' })

// List data
const items = ref([
  { id: 1, name: 'Item 1' },
  { id: 2, name: 'Item 2' },
  { id: 3, name: 'Item 3' },
])

// Computed
const itemCount = computed(() => items.value.length)

// Methods
const increment = () => {
  count.value++
}

const toggle = () => {
  isVisible.value = !isVisible.value
}

const selectItem = (item) => {
  console.log('Selected:', item.name)
  inputValue.value = item.name
}

const switchComponent = () => {
  currentComponent.value = currentComponent.value === 'home' ? 'detail' : 'home'
}
</script>

<style scoped>
.container {
  padding: 40rpx;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.header {
  margin-bottom: 60rpx;
  text-align: center;
}

.title {
  display: block;
  font-size: 48rpx;
  font-weight: bold;
  color: #ffffff;
  margin-bottom: 20rpx;
}

.subtitle {
  display: block;
  font-size: 28rpx;
  color: rgba(255, 255, 255, 0.8);
}

.section {
  background: #ffffff;
  border-radius: 20rpx;
  padding: 40rpx;
  margin-bottom: 40rpx;
  box-shadow: 0 10rpx 30rpx rgba(0, 0, 0, 0.1);
}

.section-title {
  display: block;
  font-size: 32rpx;
  font-weight: bold;
  color: #333333;
  margin-bottom: 30rpx;
}

.item {
  padding: 30rpx;
  margin-bottom: 20rpx;
  background: #f7f7f7;
  border-radius: 10rpx;
}

.notice {
  padding: 30rpx;
  background: #e8f5e9;
  border-radius: 10rpx;
  text-align: center;
}

.notice.hidden {
  background: #ffebee;
}

.fade-box {
  padding: 40rpx;
  background: #fff3e0;
  border-radius: 10rpx;
  text-align: center;
}

.actions {
  display: flex;
  gap: 20rpx;
}

.actions button {
  flex: 1;
}
</style>

<!-- Custom config block for mini-program -->
<config>
{
  "navigationBarTitleText": "Vue SFC Demo",
  "navigationBarBackgroundColor": "#667eea",
  "navigationBarTextStyle": "white"
}
</config>
