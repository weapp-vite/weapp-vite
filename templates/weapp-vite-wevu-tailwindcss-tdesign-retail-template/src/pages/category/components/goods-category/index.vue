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
  <view class="goods-category custom-class [display:flex] [&_.custom-sidebar]:[background-color:#f5f5f5]">
    <c-sidebar custom-class="custom-sidebar [height:100%] [width:180rpx] [height:100vh]" :activeKey="activeKey" @change="onParentChange">
      <c-sidebar-item v-for="(item, index) in category" :key="index" :title="item.name" :disabled="item.disabled" />
    </c-sidebar>
    <view class="goods-category__right [height:100%] [flex:auto] [width:0] [position:relative] [overflow:scroll] [-webkit-overflow-scrolling:touch] [background-color:white] [display:flex]">
      <c-tabbar v-if="isSlotRight" :activeKey="subActiveKey" showMore @change="onChildChange">
        <slot />
      </c-tabbar>
      <view v-if="!isSlotRight" class="goods-category-normal [margin:28rpx_34rpx_0rpx_32rpx]">
        <view
          v-if="activeCategory.children && activeCategory.children.length > 0"
          class="goods-category-normal-item"
        >
          <block
            v-for="(item, index) in activeCategory.children"
            :key="index"
          >
            <view v-if="level === 3 && item.children && item.children.length > 0">
              <view class="flex goods-category-normal-item-title [display:flex] [font-size:28rpx] [font-weight:500]">
                {{ item.name }}
              </view>
              <view class="goods-category-normal-item-container [background-color:#fff] [border-radius:8rpx] [padding-top:28rpx] [margin-top:-24rpx] [margin-bottom:30rpx] [display:flex] [flex-wrap:wrap]">
                <view
                  v-for="(subItem, subIndex) in item.children"
                  :key="subIndex"
                  class="goods-category-normal-item-container-item [height:196rpx] [display:flex] [flex-direction:column] [align-items:center] [margin-top:24rpx] [width:33.3%] [&_.image]:[width:144rpx] [&_.image]:[height:144rpx]"
                  :data-item="subItem"
                  @tap="changCategory"
                >
                  <t-image :src="subItem.thumbnail" t-class="image" />
                  <view class="flex goods-category-normal-item-container-item-title [display:flex] [justify-content:center] [font-size:24rpx] [color:#666666] [margin-top:20rpx]">
                    {{ subItem.name }}
                  </view>
                </view>
              </view>
            </view>
          </block>
          <view v-if="level === 2" class="goods-category-normal-item-second-container [background-color:#fff] [border-radius:8rpx] [margin-top:8rpx] [margin-bottom:30rpx] [display:grid] [grid-template-columns:33.33%_33.33%_33.33%]">
            <block v-for="(item, index) in activeCategory.children" :key="index">
              <view
                class="goods-category-normal-item-second-container-item [height:200rpx] [text-align:center] [margin-top:20rpx] [&_.image]:[width:144rpx] [&_.image]:[height:144rpx]"
                :data-item="item"
                @tap="changCategory"
              >
                <t-image :src="item.thumbnail" t-class="image" />
                <view class="flex goods-category-normal-item-container-item-title [display:flex] [justify-content:center] [font-size:24rpx] [color:#666666] [margin-top:20rpx]">
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
