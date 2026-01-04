<script setup lang="ts">
import { ref } from 'wevu'

type AnyRecord = Record<string, any>

defineOptions({
  name: 'UiTDesignPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'TDesign 全组件',
}))

const actionSheetVisible = ref(false)
const dialogVisible = ref(false)
const drawerVisible = ref(false)
const popupVisible = ref(false)
const overlayVisible = ref(false)
const imageViewerVisible = ref(false)
const popoverVisible = ref(false)

const tabsValue = ref('tab-1')
const tabBarValue = ref('home')
const sideBarValue = ref(0)
const collapseValue = ref<number[]>([0])
const stepsCurrent = ref(1)

const checkboxValue = ref<string[]>(['a'])
const radioValue = ref('1')
const switchValue = ref(true)
const sliderValue = ref(30)
const stepperValue = ref(2)
const rateValue = ref(3)

const treeSelectValue = ref<null | number>(0)
const pickerVisible = ref(false)
const pickerValue = ref<any[]>(['A', '1'])

const actionSheetItems = ref([
  { label: '选项 A', value: 'a' },
  { label: '选项 B', value: 'b' },
])

const dropdownValue = ref('a')
const dropdownOptions = ref([
  { title: 'A', value: 'a' },
  { title: 'B', value: 'b' },
])

const treeSelectOptions = ref<AnyRecord[]>([
  {
    label: '分组 1',
    value: 0,
    children: [
      { label: '选项 1', value: 0 },
      { label: '选项 2', value: 1 },
    ],
  },
  {
    label: '分组 2',
    value: 1,
    children: [
      { label: '选项 3', value: 2 },
      { label: '选项 4', value: 3 },
    ],
  },
])

const cascaderOptions = ref<AnyRecord[]>([
  {
    label: '浙江',
    value: 'zj',
    children: [
      { label: '杭州', value: 'hz' },
      { label: '宁波', value: 'nb' },
    ],
  },
  {
    label: '江苏',
    value: 'js',
    children: [
      { label: '南京', value: 'nj' },
      { label: '苏州', value: 'sz' },
    ],
  },
])

const attachmentsItems = ref<AnyRecord[]>([
  { name: 'demo.png', url: 'https://dummyimage.com/120x120/667eea/ffffff.png&text=TDesign', size: 2048 },
  { name: 'demo.pdf', url: 'https://example.com/demo.pdf', size: 1024 * 1024 },
])

const chatContent = ref({ type: 'text', data: 'Hello from chat-content' })
const chatThinking = ref({ type: 'text', data: 'thinking...' })
const chatMessageContent = ref<AnyRecord[]>([
  { type: 'text', data: 'Hello from chat-message' },
  { type: 'thinking', data: chatThinking.value },
  { type: 'attachment', data: attachmentsItems.value },
])
const chatListData = ref<AnyRecord[]>([
  {
    chatId: 'c1',
    role: 'assistant',
    name: 'Assistant',
    datetime: '12:00',
    content: [{ type: 'markdown', data: '**TDesign Chat**' }],
  },
  {
    chatId: 'c2',
    role: 'user',
    name: 'User',
    datetime: '12:01',
    content: [{ type: 'text', data: 'Hi' }],
  },
])

const imageViewerImages = ref([
  'https://dummyimage.com/300x200/4facfe/ffffff.png&text=1',
  'https://dummyimage.com/300x200/764ba2/ffffff.png&text=2',
])

const skeletonRowCol = ref([{ width: '60%' }, { width: '40%' }])
const pickerOptionsA = ref(['A', 'B', 'C'])
const pickerOptionsB = ref(['1', '2', '3'])

const guideSteps = ref([
  {
    title: 'Guide',
    content: 't-guide',
  },
])

function toggleBoolean(target: { value: boolean }) {
  target.value = !target.value
}

function onPickerConfirm(event: any) {
  const { value } = event.detail || {}
  if (Array.isArray(value)) {
    pickerValue.value = value
  }
  pickerVisible.value = false
}

function onPickerCancel() {
  pickerVisible.value = false
}

function onTabBarChange(event: any) {
  tabBarValue.value = event.detail?.value ?? event.detail
}

function onTabsChange(event: any) {
  tabsValue.value = event.detail?.value ?? event.detail
}

function onSideBarChange(event: any) {
  sideBarValue.value = event.detail
}

function onCollapseChange(event: any) {
  collapseValue.value = event.detail
}

function onStepsChange(event: any) {
  stepsCurrent.value = event.detail
}
</script>

<template>
  <view class="container">
    <view class="page-title">
      TDesign 全组件展示
    </view>

    <view class="section">
      <view class="section-title">
        基础 / 展示
      </view>
      <view class="demo-row">
        <t-button theme="primary" size="small">
          t-button
        </t-button>
        <t-icon name="app" />
        <t-badge count="8">
          <view class="badge-box">
            badge
          </view>
        </t-badge>
        <t-tag theme="primary">
          t-tag
        </t-tag>
      </view>

      <view class="demo-row">
        <t-avatar image="https://dummyimage.com/64x64/667eea/ffffff.png&text=A" />
        <t-avatar-group>
          <t-avatar image="https://dummyimage.com/64x64/4facfe/ffffff.png&text=1" />
          <t-avatar image="https://dummyimage.com/64x64/764ba2/ffffff.png&text=2" />
        </t-avatar-group>
        <t-image
          src="https://dummyimage.com/120x80/111827/ffffff.png&text=TDesign"
          style="width: 120px; height: 80px"
        />
        <t-loading />
        <t-progress percentage="40" />
      </view>

      <t-divider content="t-divider" />
      <t-empty description="t-empty" />
      <t-skeleton :row-col="skeletonRowCol" />
      <t-result title="t-result" description="description" />
      <t-footer text="t-footer" />
      <t-watermark content="TDesign" />
    </view>

    <view class="section">
      <view class="section-title">
        布局 / 列表 / 结构
      </view>
      <t-row gutter="8">
        <t-col span="4">
          <view class="box">
            t-col
          </view>
        </t-col>
        <t-col span="4">
          <view class="box">
            t-col
          </view>
        </t-col>
        <t-col span="4">
          <view class="box">
            t-col
          </view>
        </t-col>
      </t-row>

      <t-grid column="3">
        <t-grid-item text="Grid 1" />
        <t-grid-item text="Grid 2" />
        <t-grid-item text="Grid 3" />
      </t-grid>

      <t-cell-group>
        <t-cell title="t-cell" note="note" />
        <t-cell title="t-cell" note="note" />
      </t-cell-group>

      <t-sticky>
        <view class="sticky-bar">
          t-sticky
        </view>
      </t-sticky>
      <t-back-top />

      <t-scroll-view style="height: 120px" scroll-y>
        <view class="scroll-item">
          t-scroll-view item 1
        </view>
        <view class="scroll-item">
          t-scroll-view item 2
        </view>
        <view class="scroll-item">
          t-scroll-view item 3
        </view>
      </t-scroll-view>

      <t-swiper style="height: 120px">
        <t-swiper-nav />
        <view class="swiper-item">
          t-swiper item 1
        </view>
        <view class="swiper-item">
          t-swiper item 2
        </view>
      </t-swiper>
    </view>

    <view class="section">
      <view class="section-title">
        输入 / 选择
      </view>
      <t-input label="t-input" placeholder="placeholder" />
      <t-textarea placeholder="t-textarea" />

      <view class="demo-row">
        <t-checkbox-group :value="checkboxValue">
          <t-checkbox value="a">
            A
          </t-checkbox>
          <t-checkbox value="b">
            B
          </t-checkbox>
        </t-checkbox-group>

        <t-radio-group :value="radioValue">
          <t-radio value="1">
            1
          </t-radio>
          <t-radio value="2">
            2
          </t-radio>
        </t-radio-group>
      </view>

      <view class="demo-row">
        <t-switch :value="switchValue" />
        <t-slider :value="sliderValue" />
        <t-stepper :value="stepperValue" />
        <t-rate :value="rateValue" />
      </view>

      <t-search placeholder="t-search" />
      <t-count-down :time="30000" />

      <view class="demo-row">
        <t-button size="small" variant="outline" @click="pickerVisible = true">
          t-picker
        </t-button>
        <t-picker
          title="picker"
          :visible="pickerVisible"
          :value="pickerValue"
          @confirm="onPickerConfirm"
          @cancel="onPickerCancel"
        >
          <t-picker-item :options="pickerOptionsA" />
          <t-picker-item :options="pickerOptionsB" />
        </t-picker>
      </view>

      <t-date-time-picker />
      <t-calendar />
      <t-color-picker />
      <t-tree-select :options="treeSelectOptions" :value="treeSelectValue" />
      <t-cascader :options="cascaderOptions" />
    </view>

    <view class="section">
      <view class="section-title">
        导航 / 标签页
      </view>
      <t-navbar title="t-navbar" />

      <t-tabs :value="tabsValue" @change="onTabsChange">
        <t-tab-panel value="tab-1" label="Tab 1">
          tab-1
        </t-tab-panel>
        <t-tab-panel value="tab-2" label="Tab 2">
          tab-2
        </t-tab-panel>
      </t-tabs>

      <t-side-bar :value="sideBarValue" @change="onSideBarChange">
        <t-side-bar-item label="侧边 1" />
        <t-side-bar-item label="侧边 2" />
      </t-side-bar>

      <t-indexes>
        <t-indexes-anchor index="A" />
        <view class="index-item">
          A-1
        </view>
        <t-indexes-anchor index="B" />
        <view class="index-item">
          B-1
        </view>
      </t-indexes>

      <t-collapse :value="collapseValue" @change="onCollapseChange">
        <t-collapse-panel header="Panel 1" value="0">
          content
        </t-collapse-panel>
        <t-collapse-panel header="Panel 2" value="1">
          content
        </t-collapse-panel>
      </t-collapse>

      <t-steps :current="stepsCurrent" @change="onStepsChange">
        <t-step-item title="Step 1" />
        <t-step-item title="Step 2" />
        <t-step-item title="Step 3" />
      </t-steps>
    </view>

    <view class="section">
      <view class="section-title">
        弹层 / 反馈 / 其他
      </view>
      <t-notice-bar content="t-notice-bar" />
      <t-link content="t-link" />

      <view class="demo-row">
        <t-check-tag checked>
          t-check-tag
        </t-check-tag>
        <t-qrcode value="https://vite.icebreaker.top" />
      </view>

      <view class="demo-row">
        <t-button size="small" @click="toggleBoolean(actionSheetVisible)">
          t-action-sheet
        </t-button>
        <t-button size="small" @click="toggleBoolean(dialogVisible)">
          t-dialog
        </t-button>
        <t-button size="small" @click="toggleBoolean(drawerVisible)">
          t-drawer
        </t-button>
        <t-button size="small" @click="toggleBoolean(popupVisible)">
          t-popup
        </t-button>
        <t-button size="small" @click="toggleBoolean(overlayVisible)">
          t-overlay
        </t-button>
        <t-button size="small" @click="toggleBoolean(imageViewerVisible)">
          t-image-viewer
        </t-button>
        <t-button size="small" @click="toggleBoolean(popoverVisible)">
          t-popover
        </t-button>
      </view>

      <t-action-sheet :visible="actionSheetVisible" :items="actionSheetItems" @close="actionSheetVisible = false" />
      <t-dialog :visible="dialogVisible" header="t-dialog" content="content" @close="dialogVisible = false" />
      <t-drawer :visible="drawerVisible" placement="right" @close="drawerVisible = false">
        <view class="drawer-content">
          drawer content
        </view>
      </t-drawer>

      <t-popup :visible="popupVisible" placement="bottom" @close="popupVisible = false">
        <view class="popup-content">
          popup content
        </view>
      </t-popup>
      <t-overlay :visible="overlayVisible" @click="overlayVisible = false" />
      <t-transition>
        <view class="transition-box">
          t-transition
        </view>
      </t-transition>

      <t-image-viewer :visible="imageViewerVisible" :images="imageViewerImages" @close="imageViewerVisible = false" />
      <t-guide :steps="guideSteps" />

      <t-pull-down-refresh />

      <t-dropdown-menu>
        <t-dropdown-item :options="dropdownOptions" :value="dropdownValue" />
      </t-dropdown-menu>

      <t-popover :visible="popoverVisible" content="t-popover" @close="popoverVisible = false">
        <view class="popover-anchor">
          anchor
        </view>
      </t-popover>

      <t-swipe-cell>
        <template #left>
          <view class="swipe-slot">
            left
          </view>
        </template>
        <view class="swipe-content">
          t-swipe-cell
        </view>
        <template #right>
          <view class="swipe-slot">
            right
          </view>
        </template>
      </t-swipe-cell>

      <t-fab />
      <t-upload />
      <t-attachments :items="attachmentsItems" />

      <t-toast id="t-toast" />
      <t-message id="t-message" />
      <t-message-item />
    </view>

    <view class="section">
      <view class="section-title">
        Chat 系列组件
      </view>
      <t-chat-actionbar content="t-chat-actionbar" />
      <t-chat-loading text="loading..." />
      <t-chat-markdown content="**t-chat-markdown**" />
      <t-chat-content :content="chatContent" role="assistant" />
      <t-chat-thinking :content="chatThinking" role="assistant" status="pending" />
      <t-chat-message :content="chatMessageContent" role="assistant" name="Assistant" datetime="now" />
      <t-chat-sender />
      <t-chat-list :data="chatListData" />
    </view>

    <view class="section">
      <view class="section-title">
        TabBar
      </view>
      <t-tab-bar :value="tabBarValue" @change="onTabBarChange">
        <t-tab-bar-item value="home" label="首页" icon="home" />
        <t-tab-bar-item value="search" label="搜索" icon="search" />
        <t-tab-bar-item value="me" label="我的" icon="user" />
      </t-tab-bar>
    </view>
  </view>
</template>

<style>
/* stylelint-disable order/properties-order */
.demo-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  flex-wrap: wrap;
}

.badge-box {
  width: 64rpx;
  height: 64rpx;
  border-radius: 16rpx;
  background: #eef2ff;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #3b5bcc;
  font-size: 22rpx;
}

.box {
  padding: 16rpx;
  background: #eef2ff;
  border-radius: 12rpx;
  text-align: center;
  font-size: 24rpx;
  color: #3b5bcc;
}

.sticky-bar {
  padding: 16rpx;
  background: #111827;
  color: #fff;
  border-radius: 12rpx;
  font-size: 24rpx;
}

.scroll-item {
  padding: 16rpx;
  color: #666;
  font-size: 24rpx;
}

.swiper-item {
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f1f5f9;
  color: #0f172a;
}

.index-item {
  padding: 12rpx 16rpx;
  color: #666;
  font-size: 24rpx;
}

.drawer-content {
  padding: 32rpx;
}

.popup-content {
  padding: 32rpx;
  background: #fff;
  border-radius: 24rpx 24rpx 0 0;
}

.transition-box {
  padding: 16rpx;
  background: #fff7ed;
  color: #9a3412;
  border-radius: 12rpx;
  font-size: 24rpx;
}

.popover-anchor {
  padding: 12rpx 16rpx;
  border-radius: 12rpx;
  background: #111827;
  color: #fff;
  font-size: 24rpx;
}

.swipe-content {
  padding: 24rpx;
  background: #fff;
  color: #111827;
}

.swipe-slot {
  height: 100%;
  display: flex;
  align-items: center;
  padding: 0 24rpx;
  background: #fee2e2;
  color: #991b1b;
}
/* stylelint-enable order/properties-order */
</style>
