<script lang="ts">
import { defineComponent } from 'wevu'

export default defineComponent({
  data() {
    return {
      // reactive 对象
      user: {
        name: '张三',
        age: 25,
        address: {
          city: '北京',
          district: '海淀区',
        },
      },
      // ref 基本类型
      count: 0,
      message: 'Hello WeVu',
      // 数组
      items: ['苹果', '香蕉', '橙子'],
    }
  },
  methods: {
    updateName() {
      this.user.name = '李四'
    },
    updateAge() {
      this.user.age += 1
    },
    updateCity() {
      this.user.address.city = '上海'
    },
    increment() {
      this.count += 1
    },
    updateMessage() {
      this.message = `更新时间: ${new Date().toLocaleTimeString()}`
    },
    addItem() {
      this.items.push(`新项目 ${this.items.length + 1}`)
    },
    removeItem() {
      if (this.items.length > 0) {
        this.items.pop()
      }
    },
    updateFirstItem() {
      if (this.items.length > 0) {
        this.items[0] = '修改后的第一项'
      }
    },
  },
})
</script>

<template>
  <view class="container">
    <view class="page-title">
      基础响应式
    </view>

    <view class="section">
      <view class="section-title">
        Reactive 对象响应式
      </view>
      <view class="demo-item">
        <text class="label">
          姓名: {{ user.name }}
        </text>
        <button class="btn btn-primary" @click="updateName">
          修改姓名
        </button>
      </view>
      <view class="demo-item">
        <text class="label">
          年龄: {{ user.age }}
        </text>
        <button class="btn btn-primary" @click="updateAge">
          增加年龄
        </button>
      </view>
      <view class="demo-item">
        <text class="label">
          城市: {{ user.address.city }}
        </text>
        <button class="btn btn-primary" @click="updateCity">
          修改城市
        </button>
      </view>
    </view>

    <view class="section">
      <view class="section-title">
        Ref 基本类型响应式
      </view>
      <view class="demo-item">
        <text class="label">
          计数: {{ count }}
        </text>
        <button class="btn btn-success" @click="increment">
          +1
        </button>
      </view>
      <view class="demo-item">
        <text class="label">
          {{ message }}
        </text>
        <button class="btn btn-success" @click="updateMessage">
          更新消息
        </button>
      </view>
    </view>

    <view class="section">
      <view class="section-title">
        数组响应式
      </view>
      <view class="demo-item">
        <text class="label">
          项目数量: {{ items.length }}
        </text>
      </view>
      <view class="items-list">
        <view v-for="(item, index) in items" :key="index" class="item-row">
          <text>{{ index + 1 }}. {{ item }}</text>
        </view>
      </view>
      <view class="btn-group">
        <button class="btn btn-info" @click="addItem">
          添加项目
        </button>
        <button class="btn btn-warning" @click="removeItem">
          删除最后一项
        </button>
        <button class="btn btn-info" @click="updateFirstItem">
          修改第一项
        </button>
      </view>
    </view>

    <view class="tip">
      <text class="tip-text">
        💡 提示: 所有数据变化都会自动同步到视图
      </text>
    </view>
  </view>
</template>

<style>
/* stylelint-disable order/properties-order */
.demo-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx 0;
  border-bottom: 1rpx solid #eee;
}

.demo-item:last-child {
  border-bottom: none;
}

.label {
  font-size: 28rpx;
  color: #333;
}

.items-list {
  margin: 24rpx 0;
}

.item-row {
  padding: 16rpx;
  background: #f5f7fa;
  border-radius: 8rpx;
  margin-bottom: 12rpx;
  font-size: 26rpx;
  color: #666;
}

.btn-group {
  display: flex;
  gap: 16rpx;
  margin-top: 24rpx;
}

.btn-group .btn {
  flex: 1;
}

.tip {
  margin-top: 32rpx;
  padding: 24rpx;
  background: #fff3cd;
  border-radius: 12rpx;
  border-left: 4rpx solid #ffc107;
}

.tip-text {
  font-size: 26rpx;
  color: #856404;
}
/* stylelint-enable order/properties-order */
</style>

<json>
{
  "navigationBarTitleText": "基础响应式",
  "navigationBarBackgroundColor": "#667eea",
  "navigationBarTextStyle": "white"
}
</json>
