<script setup lang="ts">
import { computed, ref } from 'vue'
import DetailPanel from './dynamic/DetailPanel.vue'
import ListPanel from './dynamic/ListPanel.vue'

type PanelName = 'list' | 'detail'
interface PanelItem {
  id: number
  name: string
  desc: string
}

const props = withDefaults(
  defineProps<{
    items?: PanelItem[]
    keepAlive?: boolean
    enableTransition?: boolean
  }>(),
  {
    items: () => [
      { id: 1, name: '列表视图', desc: '使用动态组件展示列表，支持 keep-alive' },
      { id: 2, name: '详情视图', desc: '透传 props 到动态组件，并支持事件' },
      { id: 3, name: '动画区域', desc: '使用 transition 包裹的元素' },
    ],
    keepAlive: true,
    enableTransition: true,
  },
)

const panels = {
  list: ListPanel,
  detail: DetailPanel,
}

const items = ref<PanelItem[]>([...props.items])

const current = ref<PanelName>('list')
const selected = ref(items.value[0])
const transitionVisible = ref(props.enableTransition)

const currentComponent = computed(() => panels[current.value])
const panelProps = computed(() =>
  current.value === 'list' ? { items: items.value } : { item: selected.value },
)

function handleSelect(item: PanelItem) {
  selected.value = item
  current.value = 'detail'
}

function backToList() {
  current.value = 'list'
}

function togglePanel() {
  current.value = current.value === 'list' ? 'detail' : 'list'
}

function toggleTransition() {
  transitionVisible.value = !transitionVisible.value
}
</script>

<template>
  <view class="card">
    <text class="card-title">
      动态组件 / KeepAlive / Transition
    </text>
    <text class="hint">
      component :is + keep-alive + transition
    </text>

    <keep-alive v-if="props.keepAlive">
      <component
        :is="currentComponent"
        v-bind="panelProps"
        @select="handleSelect"
        @back="backToList"
      />
    </keep-alive>
    <component
      :is="currentComponent"
      v-else
      v-bind="panelProps"
      @select="handleSelect"
      @back="backToList"
    />

    <view class="actions">
      <button size="mini" @click="togglePanel">
        切换视图
      </button>
      <button size="mini" @tap="toggleTransition">
        切换过渡
      </button>
    </view>

    <transition name="fade">
      <view v-if="transitionVisible" class="tip">
        <text>
          带过渡的展示元素
        </text>
      </view>
    </transition>
  </view>
</template>

<style scoped>
.card {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 24rpx;
  box-shadow: 0 12rpx 32rpx rgba(0, 0, 0, 0.06);
  display: flex;
  flex-direction: column;
  gap: 12rpx;
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
}

.actions {
  display: flex;
  gap: 12rpx;
}

.tip {
  margin-top: 4rpx;
  padding: 12rpx;
  background: #ebf4ff;
  color: #2b6cb0;
  border-radius: 10rpx;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
