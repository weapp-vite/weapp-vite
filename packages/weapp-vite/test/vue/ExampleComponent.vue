<script setup>
import { computed, ref } from 'vue'

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
function increment() {
  count.value++
}

function toggle() {
  isVisible.value = !isVisible.value
}

function selectItem(item) {
  console.log('Selected:', item.name)
  inputValue.value = item.name
}

function switchComponent() {
  currentComponent.value = currentComponent.value === 'home' ? 'detail' : 'home'
}
</script>

<template>
  <view class="container">
    <!-- Header Section -->
    <view class="header">
      <text class="title">
        {{ title }}
      </text>
      <text class="subtitle">
        {{ subtitle }}
      </text>
    </view>

    <!-- Counter Example with v-model -->
    <view class="section">
      <text class="section-title">
        Counter: {{ count }}
      </text>
      <input v-model="inputValue" placeholder="Type something...">
      <text>You typed: {{ inputValue }}</text>
    </view>

    <!-- List Example with v-for -->
    <view class="section">
      <text class="section-title">
        Items List:
      </text>
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
      {{ itemCount }}
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
      <button @click="increment">
        Increment
      </button>
      <button @click="toggle">
        Toggle Visibility
      </button>
      <button @click="switchComponent">
        Switch Component
      </button>
    </view>
  </view>
</template>

<style scoped>
.container {
  min-height: 100vh;
  padding: 40rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.header {
  margin-bottom: 60rpx;
  text-align: center;
}

.title {
  display: block;
  margin-bottom: 20rpx;
  font-size: 48rpx;
  font-weight: bold;
  color: #fff;
}

.subtitle {
  display: block;
  font-size: 28rpx;
  color: rgb(255 255 255 / 80%);
}

.section {
  padding: 40rpx;
  margin-bottom: 40rpx;
  background: #fff;
  border-radius: 20rpx;
  box-shadow: 0 10rpx 30rpx rgb(0 0 0 / 10%);
}

.section-title {
  display: block;
  margin-bottom: 30rpx;
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
}

.item {
  padding: 30rpx;
  margin-bottom: 20rpx;
  background: #f7f7f7;
  border-radius: 10rpx;
}

.notice {
  padding: 30rpx;
  text-align: center;
  background: #e8f5e9;
  border-radius: 10rpx;
}

.notice.hidden {
  background: #ffebee;
}

.fade-box {
  padding: 40rpx;
  text-align: center;
  background: #fff3e0;
  border-radius: 10rpx;
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
<json>
{
  "navigationBarTitleText": "Vue SFC Demo",
  "navigationBarBackgroundColor": "#667eea",
  "navigationBarTextStyle": "white"
}
</json>
