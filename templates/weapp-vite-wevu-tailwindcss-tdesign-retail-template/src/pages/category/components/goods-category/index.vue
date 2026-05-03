<script setup lang="ts">
import { computed, ref, watch } from 'wevu'

interface CategoryItem {
  name?: string
  disabled?: boolean
  thumbnail?: string
  children?: CategoryItem[]
  [key: string]: any
}

const props = withDefaults(defineProps<{
  category?: CategoryItem[]
  initActive?: number[]
  isSlotRight?: boolean
  level?: number
}>(), {
  category: () => [],
  initActive: () => [],
  isSlotRight: false,
  level: 3,
})

const emit = defineEmits<{
  change: [payload: [number, number]]
  changeCategory: [payload: { item: CategoryItem }]
}>()

const activeKey = ref(0)
const subActiveKey = ref(0)

watch(
  () => props.initActive,
  (newVal, oldVal) => {
    if (newVal[0] !== oldVal?.[0]) {
      void setActiveKey(newVal[0] || 0, 0)
    }
  },
  {
    immediate: true,
    deep: true,
  },
)

function setActiveKey(key: number, subKey: number) {
  activeKey.value = key
  subActiveKey.value = subKey
  return Promise.resolve()
}

function onParentChange(event: any) {
  void setActiveKey(Number(event?.detail?.index ?? 0), 0).then(() => {
    emit('change', [activeKey.value, subActiveKey.value])
  })
}

function onChildChange(event: any) {
  void setActiveKey(activeKey.value, Number(event?.detail?.index ?? 0)).then(() => {
    emit('change', [activeKey.value, subActiveKey.value])
  })
}

function changCategory(event: any) {
  emit('changeCategory', {
    item: event?.currentTarget?.dataset?.item,
  })
}

const activeCategory = computed(() => props.category[activeKey.value] || { children: [] })

defineExpose({
  activeKey,
  subActiveKey,
  onParentChange,
  onChildChange,
  changCategory,
})

defineComponentJson({
  component: true,
  usingComponents: {
    'c-tabbar': './components/c-tabbar/index',
    'c-sidebar': './components/c-sidebar/index',
    'c-sidebar-item': './components/c-sidebar/c-sidebar-item/index',
    't-image': '/components/webp-image/index',
  },
})
</script>

<template>
  <view class="goods-category custom-class flex [&_.custom-sidebar]:bg-[#f5f5f5]">
    <c-sidebar custom-class="custom-sidebar [height:100%] [width:180rpx] [height:100vh]" :activeKey="activeKey" @change="onParentChange">
      <c-sidebar-item v-for="(item, index) in category" :key="index" :title="item.name" :disabled="item.disabled" />
    </c-sidebar>
    <view class="goods-category__right h-full flex-auto w-0 relative overflow-scroll [-webkit-overflow-scrolling:touch] bg-white flex">
      <c-tabbar v-if="isSlotRight" :activeKey="subActiveKey" showMore @change="onChildChange">
        <slot />
      </c-tabbar>
      <view v-if="!isSlotRight" class="goods-category-normal m-[28rpx_34rpx_0rpx_32rpx]">
        <view
          v-if="activeCategory.children && activeCategory.children.length > 0"
          class="goods-category-normal-item"
        >
          <block
            v-for="(item, index) in activeCategory.children"
            :key="index"
          >
            <view v-if="level === 3 && item.children && item.children.length > 0">
              <view class="flex goods-category-normal-item-title text-[28rpx] font-medium">
                {{ item.name }}
              </view>
              <view class="goods-category-normal-item-container bg-white rounded-[8rpx] pt-[28rpx] mt-[-24rpx] mb-[30rpx] flex flex-wrap">
                <view
                  v-for="(subItem, subIndex) in item.children"
                  :key="subIndex"
                  class="goods-category-normal-item-container-item h-[196rpx] flex flex-col items-center mt-[24rpx] w-[33.3%] [&_.image]:size-[144rpx]"
                  :data-item="subItem"
                  @tap="changCategory"
                >
                  <t-image :src="subItem.thumbnail" t-class="image" />
                  <view class="flex goods-category-normal-item-container-item-title justify-center text-[24rpx] text-[#666666] mt-[20rpx]">
                    {{ subItem.name }}
                  </view>
                </view>
              </view>
            </view>
          </block>
          <view v-if="level === 2" class="goods-category-normal-item-second-container bg-white rounded-[8rpx] mt-[8rpx] mb-[30rpx] grid grid-cols-[33.33%_33.33%_33.33%]">
            <block v-for="(item, index) in activeCategory.children" :key="index">
              <view
                class="goods-category-normal-item-second-container-item h-[200rpx] text-center mt-[20rpx] [&_.image]:size-[144rpx]"
                :data-item="item"
                @tap="changCategory"
              >
                <t-image :src="item.thumbnail" t-class="image" />
                <view class="flex goods-category-normal-item-container-item-title justify-center text-[24rpx] text-[#666666] mt-[20rpx]">
                  {{ item.name }}
                </view>
              </view>
            </block>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style>
.goods-category {
  display: flex;
  width: 100%;
  height: 100%;
  background: #fff;
}

.custom-sidebar {
  width: 180rpx;
  height: 100%;
  background: #f5f5f5;
}

.goods-category__right {
  position: relative;
  display: flex;
  flex: 1;
  width: 0;
  height: 100%;
  overflow: scroll;
  background: #fff;
  -webkit-overflow-scrolling: touch;
}

.goods-category-normal {
  box-sizing: border-box;
  width: 100%;
  margin: 28rpx 34rpx 0 32rpx;
}

.goods-category-normal-item-title {
  display: flex;
  font-size: 28rpx;
  font-weight: 500;
  line-height: 40rpx;
  color: #222427;
}

.goods-category-normal-item-container {
  display: flex;
  flex-wrap: wrap;
  padding-top: 8rpx;
  margin-top: 20rpx;
  margin-bottom: 30rpx;
  background: #fff;
  border-radius: 8rpx;
}

.goods-category-normal-item-container-item {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 33.33%;
  height: 196rpx;
  margin-top: 24rpx;
}

.goods-category-normal-item-container-item-title {
  display: flex;
  justify-content: center;
  margin-top: 20rpx;
  font-size: 24rpx;
  line-height: 34rpx;
  color: #666;
  text-align: center;
}

.image {
  width: 144rpx;
  height: 144rpx;
}
</style>
