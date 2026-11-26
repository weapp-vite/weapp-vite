<script setup lang="ts">
import { computed, ref } from 'wevu'
import { wpi } from 'wevu/api'
import ShopProductCard from '@/components/shop-product-card.vue'
import VEmpty from '@/components/ui/empty.vue'
import VButton from '@/components/ui/v-button.vue'
import VInput from '@/components/ui/v-input.vue'
import { addProduct, categories, queryProducts } from '@/shop'

definePageJson({
  navigationBarTitleText: '商店',
  backgroundColor: '#f5f5eb',
})

const category = ref('全部')
const keyword = ref('')
const visibleProducts = computed(() => queryProducts(category.value, keyword.value))

function chooseCategory(nextCategory: string) {
  category.value = nextCategory
}

function resetFilters() {
  category.value = '全部'
  keyword.value = ''
}

function openProduct(productId: string) {
  void wpi.navigateTo({ url: `/pages/detail/index?id=${productId}` })
}

function quickAdd(productId: string) {
  const product = queryProducts('全部', '').find(item => item.id === productId)
  if (!product || !addProduct(product.id, product.specs[0], 1)) {
    void wpi.showToast({ title: '库存不足', icon: 'none' })
    return
  }
  void wpi.showToast({ title: '已加入购物车', icon: 'success' })
}
</script>

<template>
  <view class="shop-page shop-home">
    <view class="shop-home__intro">
      <text class="shop-heading">
        日常咖啡铺
      </text>
      <text class="shop-subheading">
        咖啡豆、挂耳与手冲器具
      </text>
    </view>

    <VInput
      v-model:value="keyword"
      aria-label="搜索商品"
      clearable
      placeholder="搜索咖啡豆、挂耳或器具"
    />

    <view class="shop-home__categories" aria-label="商品分类">
      <VButton
        v-for="item in categories"
        :key="item"
        :aria-pressed="category === item"
        size="sm"
        :variant="category === item ? 'solid' : 'ghost'"
        @click="chooseCategory(item)"
      >
        {{ item }}
      </VButton>
    </view>

    <view v-if="visibleProducts.length > 0">
      <view class="shop-home__section-head">
        <text class="shop-section-title">
          {{ category === '全部' ? '全部商品' : category }}
        </text>
        <text class="shop-muted">
          {{ visibleProducts.length }} 件
        </text>
      </view>
      <view class="shop-home__grid">
        <ShopProductCard
          v-for="product in visibleProducts"
          :key="product.id"
          :product="product"
          @add="quickAdd"
          @open="openProduct"
        />
      </view>
    </view>

    <VEmpty
      v-else
      class="shop-empty"
      icon="search"
      title="没有找到商品"
      description="换个关键词，或查看全部商品。"
    >
      <VButton variant="outline" @click="resetFilters">
        查看全部
      </VButton>
    </VEmpty>
  </view>
</template>

<style>
.shop-home__intro {
  margin-bottom: 26rpx;
}

.shop-home__categories {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  margin-top: 16rpx;
}

.shop-home__section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.shop-home__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20rpx;
}
</style>
