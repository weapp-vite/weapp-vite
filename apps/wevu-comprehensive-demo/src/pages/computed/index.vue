<script lang="ts">
export default {
  data() {
    return {
      firstName: '张',
      lastName: '三',
      price: 100,
      quantity: 2,
      products: [
        { name: '商品A', price: 50, selected: true },
        { name: '商品B', price: 80, selected: false },
        { name: '商品C', price: 120, selected: true },
      ],
    }
  },
  computed: {
    // 只读计算属性
    fullName(): string {
      return `${this.firstName}${this.lastName}`
    },
    // 总价计算
    totalPrice(): number {
      return this.price * this.quantity
    },
    // 购物车总价
    cartTotal(): number {
      return this.products
        .filter(p => p.selected)
        .reduce((sum, p) => sum + p.price, 0)
    },
    // 选中商品数量
    selectedCount(): number {
      return this.products.filter(p => p.selected).length
    },
  },
  methods: {
    updateFirstName() {
      this.firstName = '李'
    },
    updateLastName() {
      this.lastName = '四'
    },
    increasePrice() {
      this.price += 10
    },
    increaseQuantity() {
      this.quantity += 1
    },
    toggleProduct(event: any) {
      const rawIndex = event?.currentTarget?.dataset?.index
      const index = typeof rawIndex === 'number' ? rawIndex : Number(rawIndex)
      const product = this.products?.[index]
      if (!product) {
        return
      }
      product.selected = !product.selected
    },
  },
}
</script>

<template>
  <view class="container">
    <view class="page-title">
      计算属性
    </view>

    <view class="section">
      <view class="section-title">
        基础计算属性
      </view>
      <view class="demo-item">
        <text class="label">
          姓: {{ firstName }}
        </text>
        <button class="btn btn-primary" @click="updateFirstName">
          修改
        </button>
      </view>
      <view class="demo-item">
        <text class="label">
          名: {{ lastName }}
        </text>
        <button class="btn btn-primary" @click="updateLastName">
          修改
        </button>
      </view>
      <view class="result">
        <text class="result-label">
          全名 (computed):
        </text>
        <text class="result-value">
          {{ fullName }}
        </text>
      </view>
    </view>

    <view class="section">
      <view class="section-title">
        计算总价
      </view>
      <view class="demo-item">
        <text class="label">
          单价: ¥{{ price }}
        </text>
        <button class="btn btn-success" @click="increasePrice">
          +10
        </button>
      </view>
      <view class="demo-item">
        <text class="label">
          数量: {{ quantity }}
        </text>
        <button class="btn btn-success" @click="increaseQuantity">
          +1
        </button>
      </view>
      <view class="result">
        <text class="result-label">
          总价 (computed):
        </text>
        <text class="result-value">
          ¥{{ totalPrice }}
        </text>
      </view>
    </view>

    <view class="section">
      <view class="section-title">
        购物车计算
      </view>
      <view class="product-list">
        <view
          v-for="(item, index) in products"
          :key="item.name"
          class="product-item"
          :data-index="index"
          @click="toggleProduct"
        >
          <view class="checkbox">
            {{ item.selected ? '✓' : '○' }}
          </view>
          <view class="product-info">
            <text class="product-name">
              {{ item.name }}
            </text>
            <text class="product-price">
              ¥{{ item.price }}
            </text>
          </view>
        </view>
      </view>
      <view class="cart-summary">
        <text class="summary-text">
          已选 {{ selectedCount }} 件
        </text>
        <text class="summary-total">
          合计: ¥{{ cartTotal }}
        </text>
      </view>
    </view>

    <view class="tip">
      <text class="tip-text">
        💡 计算属性会缓存结果，只在依赖变化时重新计算
      </text>
    </view>
  </view>
</template>

<style>
/* stylelint-disable order/properties-order */
.result {
  margin-top: 24rpx;
  padding: 20rpx;
  background: #e8f5e9;
  border-radius: 8rpx;
  display: flex;
  align-items: center;
}

.result-label {
  font-size: 28rpx;
  color: #2e7d32;
  font-weight: 500;
}

.result-value {
  font-size: 32rpx;
  color: #1b5e20;
  font-weight: 700;
}

.product-list {
  margin: 24rpx 0;
}

.product-item {
  display: flex;
  align-items: center;
  padding: 24rpx;
  background: #f5f7fa;
  border-radius: 8rpx;
  margin-bottom: 12rpx;
}

.checkbox {
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  background: #fff;
  border: 2rpx solid #ddd;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  margin-right: 24rpx;
}

.product-info {
  flex: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.product-name {
  font-size: 28rpx;
  color: #333;
}

.product-price {
  font-size: 28rpx;
  color: #f56c6c;
  font-weight: 500;
}

.cart-summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx;
  background: #fff3e0;
  border-radius: 8rpx;
  margin-top: 16rpx;
}

.summary-text {
  font-size: 28rpx;
  color: #e65100;
}

.summary-total {
  font-size: 32rpx;
  color: #bf360c;
  font-weight: 700;
}
/* stylelint-enable order/properties-order */
</style>

<json>
{
  "$schema": "https://vite.weapp.dev/page.json",
  "navigationBarTitleText": "计算属性",
  "navigationBarBackgroundColor": "#764ba2",
  "navigationBarTextStyle": "white",
  "backgroundColor": "#f5f7fa"
}
</json>
