<script setup lang="ts">
import { computed, ref, watch } from 'vue'

interface StockItem {
  id: number
  name: string
  description: string
  featured?: boolean
}

const props = withDefaults(
  defineProps<{
    initialStock?: StockItem[]
  }>(),
  {
    initialStock: () => [
      { id: 1, name: 'Weapp 主题色', description: '展示 class/style 绑定的色值', featured: true },
      { id: 2, name: 'Vue 指令', description: '校验 v-if / v-show / v-text', featured: false },
      { id: 3, name: '列表渲染', description: '含 index 与 key 的 v-for', featured: false },
    ],
  },
)

const stock = ref<StockItem[]>([...props.initialStock])
const baseLength = ref(props.initialStock.length)
const lowStock = computed(() => stock.value.length > 0 && stock.value.length < baseLength.value)

watch(
  () => props.initialStock,
  (val) => {
    stock.value = [...val]
    baseLength.value = val.length
  },
  { deep: true },
)

function removeOne() {
  if (stock.value.length) {
    stock.value = stock.value.slice(0, -1)
  }
}

function reset() {
  stock.value = [...props.initialStock]
  baseLength.value = props.initialStock.length
}

function clear() {
  stock.value = []
}

function toggleFeatured(id: number) {
  stock.value = stock.value.map(item =>
    item.id === id ? { ...item, featured: !item.featured } : item,
  )
}
</script>

<template>
  <view class="card">
    <text class="card-title">
      条件 / 列表渲染
    </text>
    <text class="hint">
      v-if / v-else-if / v-else + v-show + v-text + v-for
    </text>

    <view v-if="!stock.length" class="status">
      <text>
        库存为空
      </text>
    </view>
    <view v-else-if="lowStock" class="status warning">
      <text>
        库存紧张（小于初始数量）
      </text>
    </view>
    <view v-else class="status success">
      <text>
        库存充足
      </text>
    </view>

    <view class="list">
      <view
        v-for="(product, index) in stock"
        :key="product.id"
        class="list-item"
        :class="{ featured: product.featured }"
      >
        <text class="name">
          {{ index + 1 }}. {{ product.name }}
        </text>
        <text class="desc">
          {{ product.description }}
        </text>
        <text v-show="product.featured" class="tag">
          精选
        </text>
        <button size="mini" @tap="toggleFeatured(product.id)">
          {{ product.featured ? '取消精选' : '标记精选' }}
        </button>
      </view>
    </view>

    <view class="actions">
      <button size="mini" :disabled="!stock.length" @click="removeOne">
        移除一个
      </button>
      <button size="mini" @click="reset">
        重置数据
      </button>
      <button size="mini" @click="clear">
        清空
      </button>
    </view>
  </view>
</template>

<style scoped>
.card {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 24rpx;
  box-shadow: 0 12rpx 32rpx rgba(0, 0, 0, 0.06);
}

.card-title {
  font-size: 30rpx;
  font-weight: 700;
  color: #1a202c;
}

.hint {
  display: block;
  color: #718096;
  font-size: 24rpx;
  margin-bottom: 16rpx;
}

.status {
  padding: 18rpx;
  border-radius: 12rpx;
  background: #f7fafc;
  color: #2d3748;
  margin-bottom: 16rpx;
}

.status.warning {
  background: #fefcbf;
  color: #744210;
}

.status.success {
  background: #c6f6d5;
  color: #22543d;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  margin-bottom: 16rpx;
}

.list-item {
  background: #f7fafc;
  border-radius: 12rpx;
  padding: 18rpx;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.list-item.featured {
  border: 2rpx solid #3182ce;
}

.name {
  font-size: 26rpx;
  color: #1a202c;
}

.desc {
  font-size: 24rpx;
  color: #4a5568;
}

.tag {
  align-self: flex-start;
  background: #ebf8ff;
  color: #2b6cb0;
  padding: 6rpx 12rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
}

.actions {
  display: flex;
  gap: 12rpx;
}
</style>
