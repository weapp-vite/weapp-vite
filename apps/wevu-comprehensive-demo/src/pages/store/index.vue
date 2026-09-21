<script lang="ts">
import type { TodoFilter } from '../../stores/storeDemo'
import { defineComponent, ref, storeToRefs, toRef } from 'wevu'
import {

  useCounterStore,
  usePluginDemoStore,
  useTodoStore,
  useUserStore,
} from '../../stores/storeDemo'

export default defineComponent({

  setup() {
    // 使用 Setup Store
    const counterStore = useCounterStore()
    const { count, doubleCount, displayName } = storeToRefs(counterStore)
    const { increment, decrement, reset, setValue } = counterStore

    // 使用 Options Store
    const userStore = useUserStore()
    const { label, canVote } = storeToRefs(userStore)
    const { grow, setName } = userStore

    // Todo Store：演示 $patch / $state / $subscribe
    const todoStore = useTodoStore()
    const {
      visibleItems: visibleTodos,
      summary: todoSummary,
      filter: todoFilter,
    } = storeToRefs(todoStore)
    const todoMutations = ref<string[]>([])
    const newTodoTitle = ref('')
    const { toggle, addQuick, completeAll, setFilter, loadPreset } = todoStore

    todoStore.$subscribe((mutation, state) => {
      todoMutations.value.unshift(`${mutation.type} - ${state.items.length} 条`)
      todoMutations.value = todoMutations.value.slice(0, 5)
    })

    function addTodo() {
      const title = newTodoTitle.value.trim() || '新的待办'
      addQuick(title)
      newTodoTitle.value = ''
    }

    function toggleTodo(id: number) {
      toggle(id)
    }

    function markAllCompleted() {
      completeAll()
    }

    function applyPresetTodos() {
      loadPreset()
    }

    function changeFilter(filter: TodoFilter) {
      setFilter(filter)
    }

    function resetTodos() {
      todoStore.$reset()
    }

    function handleTodoInput(event: any) {
      newTodoTitle.value = event?.detail?.value ?? ''
    }

    // 插件扩展示例
    const pluginStore = usePluginDemoStore()
    const {
      status,
      statusText,
      requestCount,
    } = storeToRefs(pluginStore)
    const pluginLog = toRef(pluginStore as any, '$pluginLog')
    const pluginLastMutation = toRef(pluginStore as any, '$lastMutation')
    const pluginLastAction = toRef(pluginStore as any, '$lastAction')

    async function runPluginTask() {
      await pluginStore.runAsyncTask()
    }

    function failPluginTask() {
      try {
        pluginStore.failOnce()
      }
      catch (error) {
        console.error('[Plugin Demo] failOnce', error)
      }
    }

    function resetPluginStore() {
      pluginStore.clearStatus()
    }

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

      // Todo Store
      visibleTodos,
      todoSummary,
      todoFilter,
      todoMutations,
      newTodoTitle,
      addTodo,
      toggleTodo,
      markAllCompleted,
      applyPresetTodos,
      changeFilter,
      resetTodos,
      handleTodoInput,

      // 插件示例
      pluginStatus: status,
      pluginStatusText: statusText,
      pluginRequestCount: requestCount,
      pluginLog,
      pluginLastMutation,
      pluginLastAction,
      runPluginTask,
      failPluginTask,
      resetPluginStore,

      // Local state
      localCount: 0,
    }
  },
  data() {
    return {
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
})
</script>

<template>
  <view class="container">
    <view class="page-title">
      状态管理 (Pinia 风格)
    </view>

    <!-- Setup Store 示例 -->
    <view class="section">
      <view class="section-title">
        Setup Store (推荐)
      </view>
      <view class="demo-item">
        <text class="label">
          Count: {{ count }}
        </text>
        <view class="buttons">
          <button class="btn btn-small" @click="decrement">
            -
          </button>
          <button class="btn btn-small btn-primary" @click="increment">
            +
          </button>
        </view>
      </view>
      <view class="demo-item">
        <text class="label">
          Double: {{ doubleCount }}
        </text>
      </view>
      <view class="demo-item">
        <text class="label">
          Display: {{ displayName }}
        </text>
      </view>
      <view class="demo-item">
        <button class="btn btn-secondary" @click="reset">
          重置
        </button>
        <button class="btn btn-secondary" @click="setValue(42)">
          设置为 42
        </button>
        <button class="btn btn-secondary" @click="patchCounter">
          Patch 到 100
        </button>
      </view>
    </view>

    <!-- Options Store 示例 -->
    <view class="section">
      <view class="section-title">
        Options Store
      </view>
      <view class="demo-item">
        <text class="label">
          Label: {{ label }}
        </text>
      </view>
      <view class="demo-item">
        <text class="label">
          Can Vote: {{ canVote ? '是' : '否' }}
        </text>
      </view>
      <view class="demo-item">
        <button class="btn btn-primary" @click="grow">
          增长年龄
        </button>
        <button class="btn btn-secondary" @click="setName('李四')">
          改名
        </button>
        <button class="btn btn-secondary" @click="resetUser">
          重置
        </button>
      </view>
    </view>

    <!-- Todo Store 高级用法 -->
    <view class="section">
      <view class="section-title">
        列表状态 ($patch / $state)
      </view>
      <view class="demo-item">
        <view>
          <text class="label">
            完成度: {{ todoSummary }}
          </text>
          <view class="sub-text">
            筛选: {{ todoFilter }}
          </view>
        </view>
        <view class="buttons">
          <button class="{{ 'btn btn-small ' + (todoFilter === 'all' ? 'btn-primary' : '') }}" @click="changeFilter('all')">
            全部
          </button>
          <button class="{{ 'btn btn-small ' + (todoFilter === 'todo' ? 'btn-primary' : '') }}" @click="changeFilter('todo')">
            待完成
          </button>
          <button class="{{ 'btn btn-small ' + (todoFilter === 'done' ? 'btn-primary' : '') }}" @click="changeFilter('done')">
            已完成
          </button>
        </view>
      </view>

      <view v-for="todo in visibleTodos" :key="todo.id" class="todo-row">
        <view class="todo-title {{ todo.done ? 'done' : '' }}">
          {{ todo.title }}
        </view>
        <button class="btn btn-small" @click="toggleTodo(todo.id)">
          {{ todo.done ? '恢复' : '完成' }}
        </button>
      </view>

      <view class="demo-item">
        <input
          class="todo-input"
          placeholder="添加待办，留空则使用“新的待办”"
          value="{{newTodoTitle}}"
          bindinput="handleTodoInput"
        >
        <view class="buttons">
          <button class="btn btn-small btn-primary" @click="addTodo">
            添加
          </button>
          <button class="btn btn-small" @click="markAllCompleted">
            函数式 Patch 全部完成
          </button>
        </view>
      </view>

      <view class="demo-item">
        <button class="btn btn-secondary" @click="applyPresetTodos">
          $state 替换预置列表
        </button>
        <button class="btn btn-secondary" @click="resetTodos">
          $reset 回到初始
        </button>
      </view>

      <view class="log-box">
        <view class="log-title">
          Mutation 记录（$subscribe）
        </view>
        <view v-for="(item, index) in todoMutations" :key="index" class="log-line">
          {{ item }}
        </view>
      </view>
    </view>

    <!-- 插件扩展示例 -->
    <view class="section">
      <view class="section-title">
        插件扩展 ($onAction / $subscribe)
      </view>
      <view class="demo-item">
        <view>
          <text class="label">
            状态: {{ pluginStatusText }}
          </text>
          <view class="sub-text">
            请求次数: {{ pluginRequestCount }}
          </view>
          <view class="sub-text">
            最后 mutation: {{ pluginLastMutation }}
          </view>
          <view class="sub-text">
            最后 action: {{ pluginLastAction }}
          </view>
        </view>
        <view class="buttons">
          <button class="btn btn-small btn-primary" @click="runPluginTask">
            执行异步任务
          </button>
          <button class="btn btn-small btn-secondary" @click="failPluginTask">
            触发错误
          </button>
          <button class="btn btn-small" @click="resetPluginStore">
            $reset
          </button>
        </view>
      </view>
      <view class="log-box">
        <view class="log-title">
          插件注入的日志
        </view>
        <view v-for="(item, index) in pluginLog" :key="index" class="log-line">
          {{ item }}
        </view>
      </view>
      <view class="tip-inline">
        <text>通过 createStore().use() 按需挂载插件，安装到应用后观察 action/mutation。</text>
      </view>
    </view>

    <!-- 局部状态对比 -->
    <view class="section">
      <view class="section-title">
        局部状态 (对比)
      </view>
      <view class="demo-item">
        <text class="label">
          局部计数: {{ localCount }}
        </text>
        <button class="btn btn-primary" @click="incrementLocal">
          +1
        </button>
      </view>
    </view>

    <!-- 说明 -->
    <view class="tips">
      <view class="tip-item">
        <text class="tip-icon">
          💡
        </text>
        <text class="tip-text">
          Setup Store: 类似 Vue 3 Composition API，更灵活，类型推导更好
        </text>
      </view>
      <view class="tip-item">
        <text class="tip-icon">
          📦
        </text>
        <text class="tip-text">
          Options Store: 类似 Vue 2 Options API，更容易上手
        </text>
      </view>
      <view class="tip-item">
        <text class="tip-icon">
          🔄
        </text>
        <text class="tip-text">
          storeToRefs: 解构时保持响应式，actions 可以直接解构
        </text>
      </view>
      <view class="tip-item">
        <text class="tip-icon">
          🎯
        </text>
        <text class="tip-text">
          API 完全兼容 Pinia，零学习成本
        </text>
      </view>
      <view class="tip-item">
        <text class="tip-icon">
          🧩
        </text>
        <text class="tip-text">
          $patch/$state 会触发 $subscribe，适合批量更新和状态还原
        </text>
      </view>
      <view class="tip-item">
        <text class="tip-icon">
          🔌
        </text>
        <text class="tip-text">
          createStore().use() 可以按需挂载插件，跨 store 复用能力
        </text>
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

.sub-text {
  margin-top: 6rpx;
  font-size: 24rpx;
  color: #888;
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

.todo-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16rpx 0;
  border-bottom: 1rpx solid #f0f0f0;
}

.todo-title {
  font-size: 28rpx;
  color: #333;
}

.todo-title.done {
  color: #9aa0a6;
  text-decoration: line-through;
}

.todo-input {
  flex: 1;
  min-height: 72rpx;
  padding: 16rpx 20rpx;
  margin-right: 16rpx;
  font-size: 26rpx;
  border: 1rpx solid #e0e0e0;
  border-radius: 12rpx;
  background: #fff;
}

.log-box {
  margin-top: 16rpx;
  padding: 16rpx;
  background: #f8f8f8;
  border: 1rpx solid #eee;
  border-radius: 12rpx;
}

.log-title {
  font-size: 26rpx;
  color: #555;
  margin-bottom: 12rpx;
}

.log-line {
  font-size: 24rpx;
  color: #666;
  line-height: 1.6;
}

.tip-inline {
  margin-top: 16rpx;
  padding: 12rpx 14rpx;
  font-size: 24rpx;
  color: #577399;
  background: #f0f7ff;
  border-radius: 10rpx;
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

<json>
{
  "navigationBarTitleText": "状态管理"
}
</json>
