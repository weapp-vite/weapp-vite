<script setup lang="ts">
import { ref } from 'wevu'

type AnyRecord = Record<string, any>

defineOptions({
  name: 'UiVantPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'Vant 全组件',
}))

const actionSheetShow = ref(false)
const calendarShow = ref(false)
const popupShow = ref(false)
const overlayShow = ref(false)
const shareSheetShow = ref(false)
const cascaderShow = ref(false)
const treeSelectMainActiveId = ref(0)
const treeSelectActiveId = ref(0)
const dialogShow = ref(false)
const dropdownValue1 = ref(0)
const dropdownValue2 = ref('a')
const pickerShow = ref(false)
const pickerValue = ref<string[]>(['A', '1'])
const datetimeValue = ref(Date.now())
const tabsActive = ref(0)
const tabbarActive = ref(0)
const sidebarActive = ref(0)
const collapseActive = ref(['a'])
const stepsActive = ref(1)
const switchChecked = ref(true)
const sliderValue = ref(30)
const stepperValue = ref(2)
const rateValue = ref(3)
const radioValue = ref('1')
const checkboxValue = ref<string[]>(['a'])

const actionSheetActions = ref([{ name: '选项 A' }, { name: '选项 B' }])
const shareOptions = ref([
  { name: '微信', icon: 'wechat' },
  { name: '复制链接', icon: 'link' },
])
const dropdownOptions1 = ref([
  { text: '全部', value: 0 },
  { text: '好评', value: 1 },
  { text: '差评', value: 2 },
])
const dropdownOptions2 = ref([
  { text: 'A', value: 'a' },
  { text: 'B', value: 'b' },
])

const pickerColumns = ref([
  { values: ['A', 'B', 'C'], defaultIndex: 0 },
  { values: ['1', '2', '3'], defaultIndex: 0 },
])

const steps = ref([
  { text: 'Step 1', desc: 'desc' },
  { text: 'Step 2', desc: 'desc' },
  { text: 'Step 3', desc: 'desc' },
])

const cascaderOptions = ref<AnyRecord[]>([
  {
    text: '浙江',
    value: 'zj',
    children: [
      { text: '杭州', value: 'hz' },
      { text: '宁波', value: 'nb' },
    ],
  },
  {
    text: '江苏',
    value: 'js',
    children: [
      { text: '南京', value: 'nj' },
      { text: '苏州', value: 'sz' },
    ],
  },
])

const treeSelectItems = ref<AnyRecord[]>([
  {
    text: '分组 1',
    children: [
      { text: '选项 1', id: 0 },
      { text: '选项 2', id: 1 },
    ],
  },
  {
    text: '分组 2',
    children: [
      { text: '选项 3', id: 2 },
      { text: '选项 4', id: 3 },
    ],
  },
])

const uploaderFileList = ref<AnyRecord[]>([
  {
    url: 'https://dummyimage.com/120x120/667eea/ffffff.png&text=WeVu',
    name: 'demo.png',
    isImage: true,
  },
])

const areaList = ref({
  province_list: { 110000: '北京' },
  city_list: { 110100: '北京市' },
  county_list: { 110101: '东城区', 110102: '西城区' },
})

function toggle(refValue: { value: boolean }) {
  refValue.value = !refValue.value
}

function onPickerConfirm(event: any) {
  const { value } = event.detail || {}
  if (Array.isArray(value)) {
    pickerValue.value = value.map(String)
  }
  pickerShow.value = false
}

function onPickerCancel() {
  pickerShow.value = false
}

function onDropdownChange1(event: any) {
  dropdownValue1.value = event.detail
}

function onDropdownChange2(event: any) {
  dropdownValue2.value = event.detail
}

function onTabsChange(event: any) {
  tabsActive.value = event.detail?.index ?? 0
}

function onTabbarChange(event: any) {
  tabbarActive.value = event.detail
}

function onSidebarChange(event: any) {
  sidebarActive.value = event.detail
}

function onCollapseChange(event: any) {
  collapseActive.value = event.detail
}

function onStepsChange(event: any) {
  stepsActive.value = event.detail
}

function onTreeSelectNavClick(event: any) {
  treeSelectMainActiveId.value = event.detail.index
}

function onTreeSelectItemClick(event: any) {
  treeSelectActiveId.value = event.detail.id
}

function openToast() {
  // 仅用于展示 van-toast 组件已被引入；无需额外 JS API
  wx.showToast({ title: 'wx.showToast', icon: 'none' })
}
</script>

<template>
  <van-config-provider>
    <view class="container">
      <view class="page-title">
        Vant Weapp 全组件展示
      </view>

      <view class="section">
        <view class="section-title">
          基础 / 展示
        </view>
        <view class="demo-row">
          <van-button type="primary" size="small">
            van-button
          </van-button>
          <van-icon name="star-o" />
          <van-tag type="primary">
            van-tag
          </van-tag>
          <van-info info="3" />
        </view>
        <view class="demo-row">
          <van-loading size="24px" />
          <van-progress percentage="40" />
          <van-circle value="25" text="25%" />
        </view>
        <view class="demo-row">
          <van-divider content-position="center">
            van-divider
          </van-divider>
        </view>
        <view class="demo-row">
          <van-image
            width="64"
            height="64"
            fit="cover"
            src="https://dummyimage.com/128x128/764ba2/ffffff.png&text=Vant"
          />
          <van-empty description="van-empty" />
          <van-skeleton title row="3" />
        </view>
      </view>

      <view class="section">
        <view class="section-title">
          表单 / 输入
        </view>
        <van-field label="Field" placeholder="van-field" />
        <view class="demo-row">
          <van-checkbox-group :value="checkboxValue">
            <van-checkbox name="a">
              A
            </van-checkbox>
            <van-checkbox name="b">
              B
            </van-checkbox>
          </van-checkbox-group>
        </view>
        <view class="demo-row">
          <van-radio-group :value="radioValue">
            <van-radio name="1">
              选项 1
            </van-radio>
            <van-radio name="2">
              选项 2
            </van-radio>
          </van-radio-group>
        </view>
        <view class="demo-row">
          <van-rate :value="rateValue" />
          <van-slider :value="sliderValue" />
          <van-stepper :value="stepperValue" />
          <van-switch :checked="switchChecked" />
        </view>
        <view class="demo-row">
          <van-search value="" placeholder="van-search" />
        </view>
        <view class="demo-row">
          <van-uploader :file-list="uploaderFileList" />
        </view>
      </view>

      <view class="section">
        <view class="section-title">
          布局 / 列表
        </view>
        <van-row gutter="8">
          <van-col span="8">
            <view class="box">
              van-col
            </view>
          </van-col>
          <van-col span="8">
            <view class="box">
              van-col
            </view>
          </van-col>
          <van-col span="8">
            <view class="box">
              van-col
            </view>
          </van-col>
        </van-row>
        <van-grid column-num="3">
          <van-grid-item icon="photo-o" text="Grid 1" />
          <van-grid-item icon="photo-o" text="Grid 2" />
          <van-grid-item icon="photo-o" text="Grid 3" />
        </van-grid>
        <van-cell-group>
          <van-cell title="van-cell" value="value" />
          <van-cell title="van-cell" value="value" />
        </van-cell-group>
        <van-card title="van-card" desc="desc" num="2" price="99.00" thumb="https://dummyimage.com/120x120/4facfe/ffffff.png" />
        <van-panel title="van-panel">
          <view class="panel-content">
            panel content
          </view>
        </van-panel>
      </view>

      <view class="section">
        <view class="section-title">
          导航 / 结构
        </view>
        <van-nav-bar title="van-nav-bar" left-text="返回" />
        <van-tabs :active="tabsActive" @change="onTabsChange">
          <van-tab title="Tab 1">
            Tab 1 content
          </van-tab>
          <van-tab title="Tab 2">
            Tab 2 content
          </van-tab>
        </van-tabs>
        <van-sidebar :active-key="sidebarActive" @change="onSidebarChange">
          <van-sidebar-item title="侧边栏 1" />
          <van-sidebar-item title="侧边栏 2" />
        </van-sidebar>
        <view class="demo-row">
          <van-sticky>
            <view class="sticky-bar">
              van-sticky
            </view>
          </van-sticky>
        </view>
        <van-steps :steps="steps" :active="stepsActive" @click-step="onStepsChange" />
        <van-index-bar>
          <van-index-anchor index="A" />
          <view class="index-item">
            A-1
          </view>
          <van-index-anchor index="B" />
          <view class="index-item">
            B-1
          </view>
        </van-index-bar>
      </view>

      <view class="section">
        <view class="section-title">
          弹层 / 选择器 / 交互
        </view>
        <view class="demo-row">
          <van-button size="small" @click="toggle(actionSheetShow)">
            ActionSheet
          </van-button>
          <van-button size="small" @click="toggle(shareSheetShow)">
            ShareSheet
          </van-button>
          <van-button size="small" @click="toggle(calendarShow)">
            Calendar
          </van-button>
          <van-button size="small" @click="toggle(popupShow)">
            Popup
          </van-button>
          <van-button size="small" @click="toggle(overlayShow)">
            Overlay
          </van-button>
          <van-button size="small" @click="toggle(dialogShow)">
            Dialog
          </van-button>
          <van-button size="small" @click="pickerShow = true">
            Picker
          </van-button>
          <van-button size="small" @click="toggle(cascaderShow)">
            Cascader
          </van-button>
          <van-button size="small" @click="openToast">
            Toast
          </van-button>
        </view>

        <van-notice-bar text="van-notice-bar" />
        <van-count-down :time="30 * 1000" />

        <van-dropdown-menu>
          <van-dropdown-item
            :value="dropdownValue1"
            :options="dropdownOptions1"
            @change="onDropdownChange1"
          />
          <van-dropdown-item
            :value="dropdownValue2"
            :options="dropdownOptions2"
            @change="onDropdownChange2"
          />
        </van-dropdown-menu>

        <view class="demo-row">
          <van-datetime-picker type="datetime" :value="datetimeValue" />
        </view>

        <view class="demo-row">
          <van-area :area-list="areaList" />
        </view>

        <view class="demo-row">
          <van-tree-select
            :items="treeSelectItems"
            :main-active-index="treeSelectMainActiveId"
            :active-id="treeSelectActiveId"
            @click-nav="onTreeSelectNavClick"
            @click-item="onTreeSelectItemClick"
          />
        </view>

        <view class="demo-row">
          <van-transition show name="fade">
            <view class="transition-box">
              van-transition
            </view>
          </van-transition>
        </view>

        <van-popup :show="popupShow" position="bottom" @close="popupShow = false">
          <view class="popup-content">
            van-popup
          </view>
        </van-popup>
        <van-overlay :show="overlayShow" @click="overlayShow = false" />
        <van-action-sheet :show="actionSheetShow" :actions="actionSheetActions" @close="actionSheetShow = false" />
        <van-share-sheet :show="shareSheetShow" title="分享" :options="shareOptions" @close="shareSheetShow = false" />
        <van-calendar :show="calendarShow" @close="calendarShow = false" />
        <van-dialog :show="dialogShow" title="van-dialog" message="message" @close="dialogShow = false" />

        <van-picker
          :show="pickerShow"
          :columns="pickerColumns"
          @confirm="onPickerConfirm"
          @cancel="onPickerCancel"
        />
        <van-picker-column />

        <van-cascader :show="cascaderShow" :options="cascaderOptions" @close="cascaderShow = false" />
      </view>

      <view class="section">
        <view class="section-title">
          业务组件
        </view>
        <van-submit-bar price="3050" button-text="提交订单" tip="van-submit-bar" />
        <van-goods-action>
          <van-goods-action-icon icon="chat-o" text="客服" />
          <van-goods-action-icon icon="cart-o" text="购物车" />
          <van-goods-action-button type="warning" text="加入购物车" />
          <van-goods-action-button type="danger" text="立即购买" />
        </van-goods-action>
        <van-swipe-cell>
          <view slot="left" class="swipe-slot">
            Left
          </view>
          <view class="swipe-content">
            van-swipe-cell content
          </view>
          <view slot="right" class="swipe-slot">
            Right
          </view>
        </van-swipe-cell>
      </view>

      <view class="section">
        <view class="section-title">
          底部导航
        </view>
        <van-tabbar :active="tabbarActive" @change="onTabbarChange">
          <van-tabbar-item icon="home-o">
            首页
          </van-tabbar-item>
          <van-tabbar-item icon="search">
            搜索
          </van-tabbar-item>
          <van-tabbar-item icon="friends-o">
            我的
          </van-tabbar-item>
        </van-tabbar>
      </view>

      <van-toast id="van-toast" />
      <van-notify id="van-notify" />
    </view>
  </van-config-provider>
</template>

<style>
/* stylelint-disable order/properties-order */
.demo-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  flex-wrap: wrap;
}

.box {
  padding: 16rpx;
  background: #eef2ff;
  border-radius: 12rpx;
  text-align: center;
  font-size: 24rpx;
  color: #3b5bcc;
}

.panel-content {
  padding: 16rpx;
  color: #666;
  font-size: 24rpx;
}

.sticky-bar {
  padding: 16rpx;
  background: #111827;
  color: #fff;
  border-radius: 12rpx;
  font-size: 24rpx;
}

.index-item {
  padding: 12rpx 16rpx;
  color: #666;
  font-size: 24rpx;
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
