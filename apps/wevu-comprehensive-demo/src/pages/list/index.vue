<script lang="ts">
export default {
  data() {
    return {
      todos: [
        { id: 1, text: '学习 WeVu', done: true },
        { id: 2, text: '编写示例代码', done: false },
        { id: 3, text: '测试功能', done: false },
      ],
      newTodo: '',
      filter: 'all',
    }
  },
  computed: {
    filteredTodos(): any[] {
      if (this.filter === 'active') {
        return this.todos.filter(t => !t.done)
      }
      if (this.filter === 'completed') {
        return this.todos.filter(t => t.done)
      }
      return this.todos
    },
    activeCount(): number {
      return this.todos.filter(t => !t.done).length
    },
  },
  methods: {
    onInput(e: any) {
      this.newTodo = e.detail.value
    },
    addTodo() {
      if (!this.newTodo.trim()) { return }
      this.todos.push({
        id: Date.now(),
        text: this.newTodo,
        done: false,
      })
      this.newTodo = ''
    },
    toggleTodo(event: any) {
      const { id } = event.currentTarget.dataset
      const todo = this.todos.find(t => t.id === Number(id))
      if (todo) {
        todo.done = !todo.done
      }
    },
    removeTodo(event: any) {
      const { id } = event.currentTarget.dataset
      this.todos = this.todos.filter(t => t.id !== Number(id))
    },
    setFilter(event: any) {
      const { filter } = event.currentTarget.dataset
      this.filter = filter
    },
  },
}
</script>

<template>
  <view class="container">
    <view class="page-title">
      列表渲染
    </view>

    <view class="section">
      <view class="section-title">
        添加待办
      </view>
      <view class="input-row">
        <input class="todo-input" value="{{newTodo}}" bindinput="onInput" placeholder="输入待办事项">
        <button class="btn btn-primary add-btn" @click="addTodo">
          添加
        </button>
      </view>
    </view>

    <view class="section">
      <view class="section-title">
        筛选
      </view>
      <view class="filter-group">
        <view class="filter-btn {{filter === 'all' ? 'active' : ''}}" data-filter="all" @click="setFilter">
          全部 ({{ todos.length }})
        </view>
        <view class="filter-btn {{filter === 'active' ? 'active' : ''}}" data-filter="active" @click="setFilter">
          未完成 ({{ activeCount }})
        </view>
        <view class="filter-btn {{filter === 'completed' ? 'active' : ''}}" data-filter="completed" @click="setFilter">
          已完成 ({{ todos.length - activeCount }})
        </view>
      </view>
    </view>

    <view class="section">
      <view class="section-title">
        待办列表
      </view>
      <view class="todo-list">
        <view v-for="item in filteredTodos" :key="item.id" class="todo-item">
          <view class="todo-content" :data-id="item.id" @click="toggleTodo">
            <view class="checkbox">
              {{ item.done ? '✓' : '○' }}
            </view>
            <text class="todo-text {{item.done ? 'done' : ''}}">
              {{ item.text }}
            </text>
          </view>
          <button class="btn-remove" :data-id="item.id" @click="removeTodo">
            删除
          </button>
        </view>
        <view v-if="filteredTodos.length === 0" class="empty">
          <text>暂无待办事项</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style>
/* stylelint-disable order/properties-order */
.input-row {
  display: flex;
  gap: 16rpx;
}

.todo-input {
  flex: 1;
  padding: 20rpx;
  background: #f5f7fa;
  border-radius: 8rpx;
  font-size: 28rpx;
}

.add-btn {
  padding: 0 32rpx;
}

.filter-group {
  display: flex;
  gap: 16rpx;
}

.filter-btn {
  flex: 1;
  padding: 16rpx;
  text-align: center;
  background: #f5f7fa;
  border-radius: 8rpx;
  font-size: 24rpx;
  color: #666;
}

.filter-btn.active {
  background: #667eea;
  color: #fff;
}

.todo-list {
  margin-top: 24rpx;
}

.todo-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx;
  background: #f5f7fa;
  border-radius: 8rpx;
  margin-bottom: 12rpx;
}

.todo-content {
  flex: 1;
  display: flex;
  align-items: center;
}

.checkbox {
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  background: #fff;
  border: 2rpx solid #ddd;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  margin-right: 24rpx;
}

.todo-text {
  font-size: 28rpx;
  color: #333;
}

.todo-text.done {
  text-decoration: line-through;
  color: #999;
}

.btn-remove {
  padding: 12rpx 24rpx;
  background: #f56c6c;
  color: #fff;
  border-radius: 8rpx;
  font-size: 24rpx;
}

.empty {
  padding: 48rpx;
  text-align: center;
  color: #999;
  font-size: 26rpx;
}
/* stylelint-enable order/properties-order */
</style>

<json>
{
  "navigationBarTitleText": "列表渲染"
}
</json>
