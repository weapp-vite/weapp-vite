<script setup lang="ts">
import { computed } from 'wevu'
import { getRetailNeighbors, resolveRetailRoute, RETAIL_ROUTES, RETAIL_TAB_ROUTES } from '@/constants/routes'
import { useMokupScene } from '@/hooks/useMokupScene'
import { resolveRetailLayoutKind } from './layouts'

const props = defineProps<{
  route: string
}>()

const routeMeta = computed(() => resolveRetailRoute(props.route))
const layoutKind = computed(() => resolveRetailLayoutKind(props.route))
const neighbors = computed(() => getRetailNeighbors(props.route))

const { scene, loading, refresh } = useMokupScene(props.route)

const sceneSummary = computed(() => scene.value?.summary || '页面以 mock 数据渲染，用于校验路由与排版结构。')
const sceneKpis = computed(() => scene.value?.kpis || [])

const homeTabs = ['推荐', '新品', '热卖', '活动']
const orderTabs = ['全部', '待支付', '待发货', '待收货', '已完成']
const commentTabs = ['全部', '带图', '好评', '中评', '差评']
const orderStates = ['待支付', '待发货', '待收货', '售后中']
const formFields = ['联系人', '手机号', '地区', '详细地址']

const sectionRoutes = computed(() => {
  const group = routeMeta.value?.group
  if (!group) {
    return RETAIL_ROUTES.slice(0, 6)
  }
  return RETAIL_ROUTES.filter(item => item.group === group).slice(0, 6)
})

const quickRoutes = computed(() => {
  const records: Array<{ title: string, path: string }> = []
  const seen = new Set<string>()
  for (const action of scene.value?.actions || []) {
    if (seen.has(action.route)) {
      continue
    }
    seen.add(action.route)
    records.push({ title: action.label, path: action.route })
  }
  for (const route of sectionRoutes.value) {
    if (seen.has(route.path)) {
      continue
    }
    seen.add(route.path)
    records.push({ title: route.title, path: route.path })
  }
  return records.slice(0, 4)
})

const demoGoods = computed(() => {
  const base = sceneKpis.value.length > 0 ? sceneKpis.value : [{ label: '推荐商品', value: '01' }]
  return base.map((item, index) => ({
    title: `${routeMeta.value?.title || '商品'} ${index + 1}`,
    desc: item.label,
    price: `${(index + 1) * 39 + 60}`,
  }))
})

const detailRows = computed(() => {
  return sceneKpis.value.map((item, index) => ({
    label: item.label,
    value: item.value,
    key: `${item.label}-${index}`,
  }))
})

const timelineRows = computed(() => {
  return sceneKpis.value.map((item, index) => ({
    title: index === 0 ? '最新状态' : `节点 ${index + 1}`,
    desc: `${item.label}：${item.value}`,
    key: `${item.label}-${index}`,
  }))
})

function openRoute(path: string) {
  if (!path || path === props.route) {
    return
  }
  const url = `/${path}`
  if (RETAIL_TAB_ROUTES.has(path)) {
    wx.switchTab({ url })
    return
  }
  wx.navigateTo({ url })
}
</script>

<template>
  <view class="min-h-screen bg-[#f5f5f5] px-[20rpx] pb-[120rpx] pt-[20rpx]">
    <view class="rounded-[20rpx] bg-white p-[20rpx] shadow-[0_10rpx_24rpx_rgba(15,23,42,0.06)]">
      <view class="flex items-start justify-between gap-[12rpx]">
        <view>
          <text class="block text-[34rpx] font-semibold text-[#111827]">
            {{ routeMeta?.title || '零售页面' }}
          </text>
          <text class="mt-[6rpx] block text-[22rpx] text-[#6b7280]">
            {{ routeMeta?.group || '页面分组' }} · 与 retail 原始路由保持一致
          </text>
        </view>
        <t-button size="small" theme="primary" variant="outline" @tap="refresh">
          刷新
        </t-button>
      </view>

      <view class="mt-[10rpx] flex flex-wrap gap-[8rpx]">
        <t-tag theme="primary" variant="light">
          {{ props.route }}
        </t-tag>
        <t-tag v-if="loading" theme="warning" variant="light">
          场景加载中
        </t-tag>
        <t-tag v-else theme="success" variant="light">
          页面结构就绪
        </t-tag>
      </view>

      <text class="mt-[14rpx] block rounded-[14rpx] bg-[#f8fafc] p-[14rpx] text-[22rpx] text-[#334155]">
        {{ sceneSummary }}
      </text>
    </view>

    <view class="mt-[16rpx] rounded-[20rpx] bg-white p-[18rpx]">
      <view class="mb-[10rpx] flex items-center justify-between">
        <text class="text-[26rpx] font-semibold text-[#0f172a]">
          同模块页面
        </text>
        <text class="text-[20rpx] text-[#94a3b8]">
          点击跳转
        </text>
      </view>
      <view class="grid grid-cols-2 gap-[10rpx]">
        <t-button
          v-for="item in quickRoutes"
          :key="item.path"
          size="small"
          variant="outline"
          :theme="item.path === props.route ? 'warning' : 'default'"
          block
          @tap="openRoute(item.path)"
        >
          {{ item.title }}
        </t-button>
      </view>
    </view>

    <view v-if="layoutKind === 'home'" class="mt-[16rpx] space-y-[14rpx]">
      <view class="rounded-[20rpx] bg-white p-[18rpx]">
        <view class="rounded-full bg-[#f3f4f6] px-[20rpx] py-[14rpx] text-[22rpx] text-[#9ca3af]">
          搜索商品（如：iPhone 13 火热发售中）
        </view>
        <view class="mt-[12rpx] h-[240rpx] rounded-[16rpx] bg-gradient-to-r from-[#ffd9c7] to-[#ffe9d6] p-[16rpx]">
          <text class="text-[24rpx] font-medium text-[#9a3412]">
            首页轮播活动区
          </text>
        </view>
      </view>
      <view class="rounded-[20rpx] bg-white p-[18rpx]">
        <view class="flex gap-[10rpx]">
          <view
            v-for="tab in homeTabs"
            :key="tab"
            class="rounded-full bg-[#f3f4f6] px-[16rpx] py-[8rpx] text-[20rpx] text-[#334155]"
          >
            {{ tab }}
          </view>
        </view>
        <view class="mt-[14rpx] grid grid-cols-2 gap-[12rpx]">
          <view v-for="item in demoGoods" :key="item.title" class="rounded-[14rpx] bg-[#f8fafc] p-[12rpx]">
            <text class="block text-[22rpx] font-medium text-[#0f172a]">
              {{ item.title }}
            </text>
            <text class="mt-[6rpx] block text-[20rpx] text-[#64748b]">
              {{ item.desc }}
            </text>
            <text class="mt-[8rpx] block text-[24rpx] font-semibold text-[#ef4444]">
              ¥ {{ item.price }}
            </text>
          </view>
        </view>
      </view>
    </view>

    <view v-else-if="layoutKind === 'category'" class="mt-[16rpx] rounded-[20rpx] bg-white p-[16rpx]">
      <view class="flex gap-[12rpx]">
        <view class="w-[180rpx] shrink-0 rounded-[14rpx] bg-[#f8fafc] p-[8rpx]">
          <view v-for="item in quickRoutes" :key="item.path" class="mb-[8rpx] rounded-[10rpx] bg-white p-[10rpx] text-[20rpx] text-[#334155]">
            {{ item.title }}
          </view>
        </view>
        <view class="flex-1 grid grid-cols-2 gap-[10rpx]">
          <view v-for="item in demoGoods" :key="item.title" class="rounded-[12rpx] bg-[#f8fafc] p-[10rpx]">
            <view class="h-[110rpx] rounded-[10rpx] bg-[#e2e8f0]" />
            <text class="mt-[8rpx] block text-[20rpx] text-[#0f172a]">
              {{ item.title }}
            </text>
          </view>
        </view>
      </view>
    </view>

    <view v-else-if="layoutKind === 'cart'" class="mt-[16rpx] space-y-[12rpx]">
      <view class="rounded-[20rpx] bg-white p-[16rpx]">
        <view v-for="item in demoGoods" :key="item.title" class="mb-[10rpx] rounded-[12rpx] bg-[#f8fafc] p-[12rpx]">
          <text class="block text-[22rpx] font-medium text-[#0f172a]">
            {{ item.title }}
          </text>
          <view class="mt-[8rpx] flex items-center justify-between text-[20rpx] text-[#64748b]">
            <text>{{ item.desc }}</text>
            <text>x1</text>
          </view>
        </view>
      </view>
      <view class="rounded-[20rpx] bg-white p-[16rpx]">
        <view class="flex items-center justify-between">
          <text class="text-[22rpx] text-[#334155]">
            合计
          </text>
          <text class="text-[30rpx] font-semibold text-[#ef4444]">
            ¥ 299.00
          </text>
        </view>
        <t-button class="mt-[12rpx]" theme="primary" block>
          去结算
        </t-button>
      </view>
    </view>

    <view v-else-if="layoutKind === 'user-center'" class="mt-[16rpx] space-y-[12rpx]">
      <view class="rounded-[20rpx] bg-white p-[18rpx]">
        <text class="block text-[28rpx] font-semibold text-[#0f172a]">
          会员中心
        </text>
        <text class="mt-[6rpx] block text-[20rpx] text-[#64748b]">
          昵称、等级、积分与账号设置
        </text>
      </view>
      <view class="rounded-[20rpx] bg-white p-[16rpx]">
        <view class="grid grid-cols-4 gap-[8rpx]">
          <view v-for="state in orderStates" :key="state" class="rounded-[12rpx] bg-[#f8fafc] p-[10rpx] text-center text-[20rpx] text-[#334155]">
            {{ state }}
          </view>
        </view>
      </view>
      <view class="rounded-[20rpx] bg-white p-[10rpx]">
        <view v-for="item in quickRoutes" :key="item.path" class="flex items-center justify-between border-b border-[#f1f5f9] px-[8rpx] py-[14rpx]">
          <text class="text-[22rpx] text-[#0f172a]">
            {{ item.title }}
          </text>
          <text class="text-[20rpx] text-[#94a3b8]">
            进入
          </text>
        </view>
      </view>
    </view>

    <view v-else-if="layoutKind === 'goods-list' || layoutKind === 'coupon-goods' || layoutKind === 'promotion-detail'" class="mt-[16rpx] space-y-[12rpx]">
      <view class="rounded-[20rpx] bg-white p-[14rpx]">
        <view class="flex flex-wrap gap-[8rpx]">
          <view class="rounded-full bg-[#f3f4f6] px-[14rpx] py-[6rpx] text-[20rpx] text-[#334155]">
            综合
          </view>
          <view class="rounded-full bg-[#f3f4f6] px-[14rpx] py-[6rpx] text-[20rpx] text-[#334155]">
            销量
          </view>
          <view class="rounded-full bg-[#f3f4f6] px-[14rpx] py-[6rpx] text-[20rpx] text-[#334155]">
            价格
          </view>
          <view class="rounded-full bg-[#f3f4f6] px-[14rpx] py-[6rpx] text-[20rpx] text-[#334155]">
            筛选
          </view>
        </view>
      </view>
      <view class="rounded-[20rpx] bg-white p-[14rpx]">
        <view v-for="item in demoGoods" :key="item.title" class="mb-[10rpx] rounded-[12rpx] bg-[#f8fafc] p-[12rpx]">
          <text class="block text-[22rpx] font-medium text-[#111827]">
            {{ item.title }}
          </text>
          <text class="mt-[6rpx] block text-[20rpx] text-[#64748b]">
            {{ item.desc }}
          </text>
          <text class="mt-[8rpx] block text-[26rpx] text-[#ef4444]">
            ¥ {{ item.price }}
          </text>
        </view>
      </view>
    </view>

    <view v-else-if="layoutKind === 'goods-search'" class="mt-[16rpx] space-y-[12rpx]">
      <view class="rounded-[20rpx] bg-white p-[16rpx]">
        <view class="rounded-full bg-[#f3f4f6] px-[18rpx] py-[14rpx] text-[22rpx] text-[#9ca3af]">
          搜索框
        </view>
      </view>
      <view class="rounded-[20rpx] bg-white p-[16rpx]">
        <text class="text-[24rpx] font-semibold text-[#0f172a]">
          历史搜索
        </text>
        <view class="mt-[10rpx] flex flex-wrap gap-[8rpx]">
          <t-tag v-for="item in quickRoutes" :key="item.path" variant="light">
            {{ item.title }}
          </t-tag>
        </view>
      </view>
      <view class="rounded-[20rpx] bg-white p-[16rpx]">
        <text class="text-[24rpx] font-semibold text-[#0f172a]">
          热门搜索
        </text>
        <view class="mt-[10rpx] flex flex-wrap gap-[8rpx]">
          <t-tag v-for="item in detailRows" :key="item.key" variant="light" theme="primary">
            {{ item.label }}
          </t-tag>
        </view>
      </view>
    </view>

    <view v-else-if="layoutKind === 'goods-detail'" class="mt-[16rpx] space-y-[12rpx]">
      <view class="rounded-[20rpx] bg-white p-[14rpx]">
        <view class="h-[300rpx] rounded-[14rpx] bg-[#e2e8f0]" />
        <text class="mt-[12rpx] block text-[30rpx] font-semibold text-[#ef4444]">
          ¥ 399.00 起
        </text>
        <text class="mt-[6rpx] block text-[24rpx] text-[#0f172a]">
          商品详情页结构：轮播图 / 活动标签 / 规格选择 / 评价入口
        </text>
      </view>
      <view class="rounded-[20rpx] bg-white p-[14rpx]">
        <text class="text-[24rpx] font-semibold text-[#0f172a]">
          规格与评价摘要
        </text>
        <view v-for="item in detailRows" :key="item.key" class="mt-[8rpx] flex items-center justify-between rounded-[10rpx] bg-[#f8fafc] px-[12rpx] py-[10rpx]">
          <text class="text-[20rpx] text-[#475569]">
            {{ item.label }}
          </text>
          <text class="text-[20rpx] text-[#0f172a]">
            {{ item.value }}
          </text>
        </view>
      </view>
      <view class="rounded-[20rpx] bg-white p-[14rpx]">
        <t-button theme="primary" block>
          加入购物车
        </t-button>
      </view>
    </view>

    <view v-else-if="layoutKind === 'goods-comments'" class="mt-[16rpx] space-y-[12rpx]">
      <view class="rounded-[20rpx] bg-white p-[14rpx]">
        <view class="flex flex-wrap gap-[8rpx]">
          <view v-for="tab in commentTabs" :key="tab" class="rounded-full bg-[#f3f4f6] px-[14rpx] py-[6rpx] text-[20rpx] text-[#334155]">
            {{ tab }}
          </view>
        </view>
      </view>
      <view class="rounded-[20rpx] bg-white p-[14rpx]">
        <view v-for="item in detailRows" :key="item.key" class="mb-[10rpx] rounded-[12rpx] bg-[#f8fafc] p-[12rpx]">
          <text class="block text-[22rpx] font-medium text-[#0f172a]">
            用户评价 {{ item.label }}
          </text>
          <text class="mt-[6rpx] block text-[20rpx] text-[#64748b]">
            {{ item.value }}
          </text>
        </view>
      </view>
    </view>

    <view v-else-if="layoutKind === 'goods-comment-create'" class="mt-[16rpx] space-y-[12rpx]">
      <view class="rounded-[20rpx] bg-white p-[14rpx]">
        <text class="block text-[24rpx] font-semibold text-[#0f172a]">
          评价商品
        </text>
        <text class="mt-[8rpx] block text-[22rpx] text-[#475569]">
          商品评分：★★★★★
        </text>
        <view class="mt-[12rpx] rounded-[12rpx] bg-[#f8fafc] p-[12rpx] text-[20rpx] text-[#94a3b8]">
          请输入评价内容...
        </view>
        <view class="mt-[10rpx] rounded-[12rpx] border border-dashed border-[#cbd5e1] p-[16rpx] text-center text-[20rpx] text-[#64748b]">
          上传图片 / 视频
        </view>
      </view>
      <t-button class="mt-[6rpx]" theme="primary" block>
        提交评价
      </t-button>
    </view>

    <view v-else-if="layoutKind === 'order-confirm'" class="mt-[16rpx] space-y-[12rpx]">
      <view class="rounded-[20rpx] bg-white p-[14rpx]">
        <text class="text-[24rpx] font-semibold text-[#0f172a]">
          收货地址
        </text>
        <text class="mt-[6rpx] block text-[20rpx] text-[#475569]">
          默认地址 · XX省XX市XX区 · 138****0000
        </text>
      </view>
      <view class="rounded-[20rpx] bg-white p-[14rpx]">
        <text class="text-[24rpx] font-semibold text-[#0f172a]">
          商品清单
        </text>
        <view v-for="item in demoGoods" :key="item.title" class="mt-[8rpx] flex items-center justify-between rounded-[10rpx] bg-[#f8fafc] px-[12rpx] py-[10rpx]">
          <text class="text-[20rpx] text-[#334155]">
            {{ item.title }}
          </text>
          <text class="text-[20rpx] text-[#ef4444]">
            ¥ {{ item.price }}
          </text>
        </view>
      </view>
      <view class="rounded-[20rpx] bg-white p-[14rpx]">
        <view class="flex items-center justify-between text-[22rpx] text-[#334155]">
          <text>商品总额</text><text>¥ 299.00</text>
        </view>
        <view class="mt-[8rpx] flex items-center justify-between text-[22rpx] text-[#334155]">
          <text>运费</text><text>¥ 0.00</text>
        </view>
        <view class="mt-[8rpx] flex items-center justify-between text-[24rpx] font-semibold text-[#ef4444]">
          <text>应付</text><text>¥ 299.00</text>
        </view>
      </view>
      <t-button theme="primary" block>
        提交订单
      </t-button>
    </view>

    <view v-else-if="layoutKind === 'order-list'" class="mt-[16rpx] space-y-[12rpx]">
      <view class="rounded-[20rpx] bg-white p-[14rpx]">
        <view class="flex gap-[8rpx]">
          <view v-for="tab in orderTabs" :key="tab" class="rounded-full bg-[#f3f4f6] px-[12rpx] py-[6rpx] text-[20rpx] text-[#334155]">
            {{ tab }}
          </view>
        </view>
      </view>
      <view class="rounded-[20rpx] bg-white p-[14rpx]">
        <view v-for="item in demoGoods" :key="item.title" class="mb-[10rpx] rounded-[12rpx] bg-[#f8fafc] p-[12rpx]">
          <text class="block text-[22rpx] font-medium text-[#0f172a]">
            {{ item.title }}
          </text>
          <text class="mt-[6rpx] block text-[20rpx] text-[#64748b]">
            订单状态：待处理
          </text>
          <view class="mt-[10rpx] flex justify-end">
            <t-button size="small" variant="outline">
              查看详情
            </t-button>
          </view>
        </view>
      </view>
    </view>

    <view v-else-if="layoutKind === 'order-detail'" class="mt-[16rpx] space-y-[12rpx]">
      <view class="rounded-[20rpx] bg-white p-[14rpx]">
        <text class="text-[24rpx] font-semibold text-[#0f172a]">
          订单进度
        </text>
        <view v-for="item in timelineRows" :key="item.key" class="mt-[8rpx] rounded-[10rpx] bg-[#f8fafc] px-[12rpx] py-[10rpx]">
          <text class="block text-[20rpx] font-medium text-[#334155]">
            {{ item.title }}
          </text>
          <text class="mt-[4rpx] block text-[20rpx] text-[#64748b]">
            {{ item.desc }}
          </text>
        </view>
      </view>
      <view class="rounded-[20rpx] bg-white p-[14rpx]">
        <view class="grid grid-cols-2 gap-[10rpx]">
          <t-button variant="outline" size="small" block>
            联系商家
          </t-button>
          <t-button theme="primary" size="small" block>
            再次购买
          </t-button>
        </view>
      </view>
    </view>

    <view v-else-if="layoutKind === 'order-form'" class="mt-[16rpx] space-y-[12rpx]">
      <view class="rounded-[20rpx] bg-white p-[14rpx]">
        <text class="text-[24rpx] font-semibold text-[#0f172a]">
          订单表单信息
        </text>
        <view v-for="field in formFields" :key="field" class="mt-[8rpx] rounded-[10rpx] bg-[#f8fafc] px-[12rpx] py-[12rpx] text-[20rpx] text-[#64748b]">
          {{ field }}
        </view>
      </view>
      <t-button theme="primary" block>
        保存并继续
      </t-button>
    </view>

    <view v-else-if="layoutKind === 'order-pay-result'" class="mt-[16rpx] space-y-[12rpx]">
      <view class="rounded-[20rpx] bg-white p-[20rpx] text-center">
        <text class="block text-[30rpx] font-semibold text-[#16a34a]">
          支付成功
        </text>
        <text class="mt-[8rpx] block text-[22rpx] text-[#64748b]">
          微信支付：¥ 299.00
        </text>
      </view>
      <view class="grid grid-cols-2 gap-[10rpx]">
        <t-button variant="outline" block @tap="openRoute('pages/order/order-list/index')">
          查看订单
        </t-button>
        <t-button theme="primary" block @tap="openRoute('pages/home/home')">
          返回首页
        </t-button>
      </view>
    </view>

    <view v-else-if="layoutKind === 'coupon-list'" class="mt-[16rpx] space-y-[12rpx]">
      <view class="rounded-[20rpx] bg-white p-[14rpx]">
        <view class="flex gap-[8rpx]">
          <view class="rounded-full bg-[#f3f4f6] px-[12rpx] py-[6rpx] text-[20rpx] text-[#334155]">
            可使用
          </view>
          <view class="rounded-full bg-[#f3f4f6] px-[12rpx] py-[6rpx] text-[20rpx] text-[#334155]">
            已使用
          </view>
          <view class="rounded-full bg-[#f3f4f6] px-[12rpx] py-[6rpx] text-[20rpx] text-[#334155]">
            已过期
          </view>
        </view>
      </view>
      <view class="rounded-[20rpx] bg-white p-[14rpx]">
        <view v-for="item in detailRows" :key="item.key" class="mb-[10rpx] rounded-[12rpx] bg-[#fff7ed] p-[12rpx]">
          <text class="block text-[22rpx] font-semibold text-[#9a3412]">
            {{ item.label }}
          </text>
          <text class="mt-[4rpx] block text-[20rpx] text-[#c2410c]">
            优惠券价值 {{ item.value }}
          </text>
        </view>
      </view>
    </view>

    <view v-else-if="layoutKind === 'coupon-detail'" class="mt-[16rpx] space-y-[12rpx]">
      <view class="rounded-[20rpx] bg-white p-[14rpx]">
        <text class="block text-[26rpx] font-semibold text-[#9a3412]">
          优惠券详情卡片
        </text>
        <text class="mt-[6rpx] block text-[20rpx] text-[#c2410c]">
          满减规则、有效期、适用范围
        </text>
      </view>
      <view class="rounded-[20rpx] bg-white p-[14rpx]">
        <view v-for="item in detailRows" :key="item.key" class="mb-[8rpx] flex items-center justify-between rounded-[10rpx] bg-[#f8fafc] px-[12rpx] py-[10rpx]">
          <text class="text-[20rpx] text-[#334155]">
            {{ item.label }}
          </text>
          <text class="text-[20rpx] text-[#0f172a]">
            {{ item.value }}
          </text>
        </view>
      </view>
      <t-button theme="primary" block @tap="openRoute('pages/coupon/coupon-activity-goods/index')">
        查看可用商品
      </t-button>
    </view>

    <view v-else-if="layoutKind === 'user-profile'" class="mt-[16rpx] space-y-[12rpx]">
      <view class="rounded-[20rpx] bg-white p-[14rpx]">
        <view v-for="item in ['头像', '昵称', '性别', '手机号']" :key="item" class="mb-[8rpx] flex items-center justify-between rounded-[10rpx] bg-[#f8fafc] px-[12rpx] py-[12rpx]">
          <text class="text-[22rpx] text-[#334155]">
            {{ item }}
          </text>
          <text class="text-[20rpx] text-[#94a3b8]">
            编辑
          </text>
        </view>
      </view>
      <t-button variant="outline" block>
        切换账号登录
      </t-button>
    </view>

    <view v-else-if="layoutKind === 'user-address-list'" class="mt-[16rpx] space-y-[12rpx]">
      <view class="rounded-[20rpx] bg-white p-[14rpx]">
        <view v-for="item in demoGoods" :key="item.title" class="mb-[10rpx] rounded-[12rpx] bg-[#f8fafc] p-[12rpx]">
          <text class="block text-[22rpx] font-medium text-[#0f172a]">
            收货人 · {{ item.title }}
          </text>
          <text class="mt-[6rpx] block text-[20rpx] text-[#64748b]">
            XX省XX市XX区 · 138****0000
          </text>
        </view>
      </view>
      <view class="grid grid-cols-2 gap-[10rpx]">
        <t-button variant="outline" block @tap="openRoute('pages/user/address/edit/index')">
          微信地址导入
        </t-button>
        <t-button theme="primary" block @tap="openRoute('pages/user/address/edit/index')">
          新建地址
        </t-button>
      </view>
    </view>

    <view v-else-if="layoutKind === 'user-form'" class="mt-[16rpx] space-y-[12rpx]">
      <view class="rounded-[20rpx] bg-white p-[14rpx]">
        <view v-for="field in formFields" :key="field" class="mb-[8rpx] rounded-[10rpx] bg-[#f8fafc] px-[12rpx] py-[12rpx] text-[20rpx] text-[#64748b]">
          {{ field }}
        </view>
      </view>
      <t-button theme="primary" block>
        保存
      </t-button>
    </view>

    <view v-else class="mt-[16rpx] rounded-[20rpx] bg-white p-[14rpx]">
      <view v-for="item in detailRows" :key="item.key" class="mb-[8rpx] rounded-[10rpx] bg-[#f8fafc] px-[12rpx] py-[10rpx]">
        <text class="block text-[20rpx] font-medium text-[#334155]">
          {{ item.label }}
        </text>
        <text class="mt-[4rpx] block text-[20rpx] text-[#64748b]">
          {{ item.value }}
        </text>
      </view>
    </view>

    <view class="mt-[16rpx] grid grid-cols-2 gap-[10rpx]">
      <t-button variant="outline" block @tap="openRoute(neighbors.previous.path)">
        上一页 · {{ neighbors.previous.title }}
      </t-button>
      <t-button theme="primary" block @tap="openRoute(neighbors.next.path)">
        下一页 · {{ neighbors.next.title }}
      </t-button>
    </view>
  </view>
</template>
