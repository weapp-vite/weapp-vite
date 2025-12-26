<script lang="ts">
import { computed, ref } from 'wevu'
import { defineStore } from 'wevu/store'
import { storeToRefs } from 'wevu/store'

// Setup Store 示例
const useCounterStore = defineStore('counter', () => {
  const count = ref(0)
  const name = ref('Counter')

  const doubleCount = computed(() => count.value * 2)
  const displayName = computed(() => `${name.value}: ${count.value}`)

  function increment() {
    count.value++
  }

  function decrement() {
    count.value--
  }

  function reset() {
    count.value = 0
  }

  function setValue(value: number) {
    count.value = value
  }

  return {
    count,
    name,
    doubleCount,
    displayName,
    increment,
    decrement,
    reset,
    setValue,
  }
})

// Options Store 示例
const useUserStore = defineStore('user', {
  state: () => ({
    userName: '张三',
    age: 25,
  }),

  getters: {
    label(state): string {
      return `${state.userName}: ${this.age}岁`
    },

    canVote(): boolean {
      return this.age >= 18
    },
  },

  actions: {
    grow() {
      this.age++
    },

    setName(name: string) {
      this.userName = name
    },
  },
})

export default {
  data() {
    return {
      localCount: 0,
    }
  },

  setup() {
    // 使用 Setup Store
    const counterStore = useCounterStore()
    const { count, doubleCount, displayName } = storeToRefs(counterStore)
    const { increment, decrement, reset, setValue } = counterStore

    // 使用 Options Store
    const userStore = useUserStore()
    const { label, canVote } = storeToRefs(userStore)
    const { grow, setName } = userStore

    // 监听状态变化
    counterStore.$subscribe((mutation, state) => {
      console.log('[Counter] Mutation:', mutation.type, 'State:', state)
    })

    userStore.$subscribe((mutation, state) => {
      console.log('[User] Mutation:', mutation.type, 'State:', state)
    })

    // 监听 action 调用
    counterStore.$onAction(({ name, after }) => {
      after(() => {
        console.log(`[Counter] Action ${name} completed`)
      })
    })

    return {
      // Setup Store
      count,
      doubleCount,
      displayName,
      increment,
      decrement,
      reset,
      setValue,

      // Options Store
      label,
      canVote,
      grow,
      setName,

      // Local state
      localCount: 0,
    }
  },

  methods: {
    incrementLocal() {
      this.localCount += 1
    },

    patchCounter() {
      const counterStore = useCounterStore()
      counterStore.$patch({
        count: 100,
      })
    },

    resetUser() {
      const userStore = useUserStore()
      userStore.$reset()
    },
  },
}
</script>

<template>
  <view class="container">
    <view class="page-title">状态管理 (Pinia 风格)</view>

    <!-- Setup Store 示例 -->
    <view class="section">
      <view class="section-title">Setup Store (推荐)</view>
      <view class="demo-item">
        <text class="label">Count: {{ count }}</text>
        <view class="buttons">
          <button class="btn btn-small" @click="decrement">-</button>
          <button class="btn btn-small btn-primary" @click="increment">+</button>
        </view>
      </view>
      <view class="demo-item">
        <text class="label">Double: {{ doubleCount }}</text>
      </view>
      <view class="demo-item">
        <text class="label">Display: {{ displayName }}</text>
      </view>
      <view class="demo-item">
        <button class="btn btn-secondary" @click="reset">重置</button>
        <button class="btn btn-secondary" @click="setValue(42)">设置为 42</button>
        <button class="btn btn-secondary" @click="patchCounter">Patch 到 100</button>
      </view>
    </view>

    <!-- Options Store 示例 -->
    <view class="section">
      <view class="section-title">Options Store</view>
      <view class="demo-item">
        <text class="label">Label: {{ label }}</text>
      </view>
      <view class="demo-item">
        <text class="label">Can Vote: {{ canVote ? '是' : '否' }}</text>
      </view>
      <view class="demo-item">
        <button class="btn btn-primary" @click="grow">增长年龄</button>
        <button class="btn btn-secondary" @click="setName('李四')">改名</button>
        <button class="btn btn-secondary" @click="resetUser">重置</button>
      </view>
    </view>

    <!-- 局部状态对比 -->
    <view class="section">
      <view class="section-title">局部状态 (对比)</view>
      <view class="demo-item">
        <text class="label">局部计数: {{ localCount }}</text>
        <button class="btn btn-primary" @click="incrementLocal">+1</button>
      </view>
    </view>

    <!-- 说明 -->
    <view class="tips">
      <view class="tip-item">
        <text class="tip-icon">💡</text>
        <text class="tip-text">Setup Store: 类似 Vue 3 Composition API，更灵活，类型推导更好</text>
      </view>
      <view class="tip-item">
        <text class="tip-icon">📦</text>
        <text class="tip-text">Options Store: 类似 Vue 2 Options API，更容易上手</text>
      </view>
      <view class="tip-item">
        <text class="tip-icon">🔄</text>
        <text class="tip-text">storeToRefs: 解构时保持响应式，actions 可以直接解构</text>
      </view>
      <view class="tip-item">
        <text class="tip-icon">🎯</text>
        <text class="tip-text">API 完全兼容 Pinia，零学习成本</text>
      </view>
    </view>
  </view>
</template>

<style>
/* stylelint-disable order/properties-order */
.section {
  margin-bottom: 40rpx;
}

.section-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 24rpx;
  padding-bottom: 16rpx;
  border-bottom: 2rpx solid #e0e0e0;
}

.demo-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx 0;
  border-bottom: 1rpx solid #eee;
}

.label {
  font-size: 28rpx;
  color: #333;
}

.buttons {
  display: flex;
  gap: 16rpx;
}

.btn-small {
  min-width: 80rpx;
  padding: 8rpx 24rpx;
  font-size: 24rpx;
}

.btn-primary {
  background-color: #07c160;
  color: #fff;
}

.btn-secondary {
  background-color: #10aeff;
  color: #fff;
}

.tips {
  margin-top: 40rpx;
  padding: 24rpx;
  background-color: #f7f7f7;
  border-radius: 12rpx;
}

.tip-item {
  display: flex;
  margin-bottom: 16rpx;
}

.tip-icon {
  font-size: 32rpx;
  margin-right: 12rpx;
}

.tip-text {
  flex: 1;
  font-size: 26rpx;
  color: #666;
  line-height: 1.6;
}
/* stylelint-enable order/properties-order */
</style>

<config lang="json">
{
  "navigationBarTitleText": "状态管理"
}
</config>
