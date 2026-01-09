<script setup lang="ts">
import Toast from 'tdesign-miniprogram/toast/index'

import { computed, getCurrentInstance, onPullDownRefresh, ref, watch } from 'wevu'

import EmptyState from '@/components/EmptyState/index.vue'
import FilterBar from '@/components/FilterBar/index.vue'
import SectionTitle from '@/components/SectionTitle/index.vue'

definePageJson({
  navigationBarTitleText: '清单',
  backgroundColor: '#f6f7fb',
  enablePullDownRefresh: true,
})

const mpContext = getCurrentInstance()

const query = ref('')
const activeStatus = ref('all')
const loading = ref(true)

const items = ref([
  {
    id: 1,
    title: '门店会员激活方案',
    owner: '王凯',
    status: 'processing',
    deadline: '今日 18:00',
    priority: 'P0',
  },
  {
    id: 2,
    title: '社群内容排期',
    owner: '林鹤',
    status: 'pending',
    deadline: '明日 12:00',
    priority: 'P1',
  },
  {
    id: 3,
    title: '新客任务提醒',
    owner: '陈一',
    status: 'done',
    deadline: '已完成',
    priority: 'P2',
  },
  {
    id: 4,
    title: '客服脚本优化',
    owner: '韩逸',
    status: 'processing',
    deadline: '周五 20:00',
    priority: 'P1',
  },
])

interface StatusFilter { value: string, label: string, count?: number }

const statusFilters = ref<StatusFilter[]>([])

function rebuildStatusFilters() {
  const source = Array.isArray(items.value) ? items.value : []
  const summary = source.reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = (acc[item.status] ?? 0) + 1
    return acc
  }, {})
  statusFilters.value = [
    { value: 'all', label: '全部', count: source.length },
    { value: 'processing', label: '进行中', count: summary.processing ?? 0 },
    { value: 'pending', label: '待启动', count: summary.pending ?? 0 },
    { value: 'done', label: '已完成', count: summary.done ?? 0 },
  ]
}

rebuildStatusFilters()
watch(items, rebuildStatusFilters, { deep: true })

const filteredItems = computed(() =>
  items.value.filter((item) => {
    const matchStatus = activeStatus.value === 'all' || item.status === activeStatus.value
    const matchQuery = !query.value || item.title.includes(query.value) || item.owner.includes(query.value)
    return matchStatus && matchQuery
  }),
)

const hasEmpty = computed(() => !loading.value && filteredItems.value.length === 0)

function showToast(message: string) {
  if (!mpContext) {
    return
  }
  Toast({
    selector: '#t-toast',
    context: mpContext as any,
    message,
    theme: 'success',
    duration: 1000,
  })
}

function reload() {
  loading.value = true
  setTimeout(() => {
    loading.value = false
    showToast('列表已刷新')
  }, 600)
}

function onAction(item: (typeof items.value)[number]) {
  showToast(`打开「${item.title}」详情`)
}

onPullDownRefresh(() => {
  reload()
  wx.stopPullDownRefresh()
})

reload()
</script>

<template>
  <view class="min-h-screen bg-[#f6f7fb] px-[28rpx] pb-[88rpx] pt-[24rpx] text-[#1c1c3c]">
    <view class="rounded-[28rpx] bg-gradient-to-br from-[#fdf2f8] via-[#fff7fb] to-[#ffffff] p-[20rpx]">
      <SectionTitle title="任务清单" subtitle="筛选、搜索与分页反馈" />
      <view class="mt-[12rpx]">
        <FilterBar v-model:query="query" v-model:active="activeStatus" :filters="statusFilters" />
      </view>
    </view>

    <view v-if="loading" class="mt-[20rpx] flex flex-col items-center gap-[12rpx] rounded-[24rpx] bg-white p-[24rpx]">
      <t-loading theme="circular" size="40" />
      <text class="text-[22rpx] text-[#6f6b8a]">
        正在同步数据...
      </text>
    </view>

    <view v-else class="mt-[20rpx] space-y-[14rpx]">
      <view v-for="item in filteredItems" :key="item.id" class="rounded-[20rpx] bg-white p-[18rpx] shadow-[0_12rpx_28rpx_rgba(17,24,39,0.08)]">
        <view class="flex items-start justify-between">
          <view>
            <text class="text-[26rpx] font-semibold text-[#1f1a3f]">
              {{ item.title }}
            </text>
            <text class="mt-[6rpx] block text-[22rpx] text-[#6f6b8a]">
              负责人：{{ item.owner }} · 截止 {{ item.deadline }}
            </text>
          </view>
          <t-tag
            size="small"
            :theme="item.status === 'done' ? 'success' : item.status === 'processing' ? 'primary' : 'warning'"
            variant="light"
          >
            {{ item.status === 'done' ? '已完成' : item.status === 'processing' ? '进行中' : '待启动' }}
          </t-tag>
        </view>
        <view class="mt-[12rpx] flex items-center justify-between">
          <view class="flex items-center gap-[8rpx]">
            <t-tag size="small" theme="primary" variant="outline">
              {{ item.priority }}
            </t-tag>
            <text class="text-[20rpx] text-[#7a7aa0]">
              进度跟进
            </text>
          </view>
          <t-button size="small" theme="primary" variant="outline" @tap="onAction(item)">
            查看
          </t-button>
        </view>
      </view>
    </view>

    <view v-if="hasEmpty" class="mt-[20rpx]">
      <EmptyState title="暂无匹配任务" description="调整筛选条件或刷新数据" action-text="重新加载" @action="reload" />
    </view>

    <t-toast id="t-toast" />
  </view>
</template>
