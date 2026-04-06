<script setup lang="ts">
import { ref, watch } from 'wevu'

interface TabItem {
  name?: string
  disabled?: boolean
}

defineOptions({
  externalClasses: ['custom-class'],
})

const props = withDefaults(defineProps<{
  activeKey?: number
  tabList?: TabItem[]
  showMore?: boolean
}>(), {
  activeKey: 0,
  tabList: () => [],
  showMore: false,
})

const emit = defineEmits<{
  change: [payload: { index: number }]
}>()

const currentActive = ref(-1)

function setActive(activeKey: number) {
  if (!props.tabList[activeKey] || props.tabList[activeKey]?.disabled) {
    return Promise.reject(new Error('数据异常或不可操作'))
  }
  currentActive.value = activeKey
  return Promise.resolve()
}

function onClick(event: any) {
  const activeKey = event?.type === 'select'
    ? Number(event?.detail ?? 0)
    : Number(event?.currentTarget?.dataset?.index ?? 0)
  void setActive(activeKey).then(() => {
    emit('change', {
      index: currentActive.value,
    })
  }).catch((error) => {
    console.error(error)
  })
}

watch(
  () => props.activeKey,
  (newVal) => {
    if (props.tabList.length && newVal !== undefined && newVal !== null) {
      void setActive(newVal).catch((error) => {
        console.error(error)
      })
    }
  },
  {
    immediate: true,
  },
)

defineExpose({
  currentActive,
  onClick,
})

defineComponentJson({
  component: true,
  usingComponents: {
    'c-tabbar-more': './c-tabbar-more/index',
  },
})
</script>

<template>
  <view class="c-tabbar custom-class [width:100%] [height:100%] [position:relative] [--tabbar-height:100rpx] [--tabbar-fontsize:28rpx] [--tabbar-background-color:white]">
    <scroll-view
      v-if="tabList.length > 0"
      class="c-tabbar__scroll [position:relative]"
      scroll-x="true"
      :scroll-into-view="`id-${currentActive}`"
    >
      <view :class="`c-tabbar__inner ${showMore && tabList.length > 4 ? 'c-tabbar__inner_more' : ''} [display:flex] [flex-flow:row_nowrap]`">
        <view
          v-for="(item, index) in tabList"
          :id="`id-${index}`"
          :key="index"
          :class="`c-tabbar-item ${currentActive === index ? 'active' : ''} ${item.disabled ? 'disabled' : ''} [flex:none] [height:100rpx] [color:#282828] [font-size:28rpx] [padding:0_20rpx] [&_.disabled]:[color:#ccc]`"
          :data-index="index"
          @tap="onClick"
        >
          <view class="c-tabbar-item__text [width:100%] [text-align:center] [height:100rpx] [line-height:100rpx]">
            {{ item.name }}
          </view>
        </view>
      </view>
    </scroll-view>
    <c-tabbar-more v-if="showMore && tabList.length > 4" :tabList="tabList" @select="onClick" />
    <slot />
  </view>
</template>
