<script setup lang="ts">
import { computed, ref } from 'wevu'

const visible = ref(true)
const phase = ref<'a' | 'b' | 'c'>('a')
const keyword = ref('')

const list = ref([
  { id: 1, name: 'Alpha', enabled: true },
  { id: 2, name: 'Beta', enabled: false },
  { id: 3, name: 'Gamma', enabled: true },
])

const record = ref<Record<string, number>>({
  apples: 3,
  bananas: 5,
  peaches: 2,
})

const now = ref(Date.now())
const rawHtml = ref('<div style="color:#e11d48;font-weight:700;">v-html (仅语法覆盖)</div>')

const filtered = computed(() => {
  const key = keyword.value.trim().toLowerCase()
  if (!key) {
    return list.value
  }
  return list.value.filter(item => item.name.toLowerCase().includes(key))
})

function toggleVisible() {
  visible.value = !visible.value
}

function rotatePhase() {
  phase.value = phase.value === 'a' ? 'b' : phase.value === 'b' ? 'c' : 'a'
}

function refreshTime() {
  now.value = Date.now()
}
</script>

<template>
  <view class="container">
    <view class="page-title">
      Vue 模板指令
    </view>

    <view class="section">
      <view class="section-title">
        条件渲染：v-if / v-else-if / v-else
      </view>
      <view class="demo-item">
        <text class="label">
          phase: {{ phase }}
        </text>
        <button class="btn btn-primary" @tap="rotatePhase">
          切换
        </button>
      </view>
      <view class="card">
        <text v-if="phase === 'a'">
          A 区块
        </text>
        <text v-else-if="phase === 'b'">
          B 区块
        </text>
        <text v-else>
          C 区块
        </text>
      </view>
    </view>

    <view class="section">
      <view class="section-title">
        显示隐藏：v-show
      </view>
      <view class="demo-item">
        <text class="label">
          visible: {{ visible }}
        </text>
        <button class="btn btn-success" @tap="toggleVisible">
          切换
        </button>
      </view>
      <view v-show="visible" class="card">
        <text>v-show 仅控制样式 display</text>
      </view>
    </view>

    <view class="section">
      <view class="section-title">
        列表渲染：v-for / wx:key
      </view>
      <view class="demo-item">
        <text class="label">
          过滤关键字
        </text>
        <input v-model="keyword" class="input" placeholder="输入 Alpha / Beta / Gamma">
      </view>

      <view class="card">
        <view v-for="(item, index) in filtered" :key="item.id" class="row">
          <text>#{{ index }} {{ item.name }}</text>
          <text class="muted">
            {{ item.enabled ? 'enabled' : 'disabled' }}
          </text>
        </view>
      </view>

      <view class="card">
        <view v-for="(value, key, index) in record" :key="key" class="row">
          <text>{{ index }}. {{ key }} = {{ value }}</text>
        </view>
      </view>

      <view class="card">
        <template v-for="item in filtered" :key="item.id">
          <text class="chip">
            {{ item.name }}
          </text>
        </template>
      </view>
    </view>

    <view class="section">
      <view class="section-title">
        文本：v-text / v-html / Mustache
      </view>
      <view class="card">
        <text v-text="'v-text 覆盖文本内容'" />
        <text>Mustache: {{ now }}</text>
      </view>
      <view class="card">
        <text class="muted">
          v-html 小程序不支持，以下仅覆盖语法（编译会给出警告）
        </text>
        <view v-html="rawHtml" />
      </view>
    </view>

    <view class="section">
      <view class="section-title">
        一次性渲染：v-once
      </view>
      <view class="demo-item">
        <text class="label">
          now: {{ now }}
        </text>
        <button class="btn btn-info" @tap="refreshTime">
          刷新
        </button>
      </view>
      <view class="card">
        <text v-once>
          v-once: {{ now }}
        </text>
      </view>
    </view>

    <view class="section">
      <view class="section-title">
        跳过编译：v-pre
      </view>
      <view class="card">
        <text v-pre>
          这里的 {{ mustache }} 会保持原样
        </text>
      </view>
    </view>
  </view>
</template>

<style>
/* stylelint-disable order/properties-order */
.container {
  padding: 24rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  box-sizing: border-box;
}

.page-title {
  font-size: 34rpx;
  font-weight: 700;
}

.section {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 18rpx;
  box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.06);
}

.section-title {
  font-size: 28rpx;
  font-weight: 700;
  margin-bottom: 12rpx;
}

.demo-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
  padding: 14rpx 0;
}

.label {
  font-size: 24rpx;
  color: #475569;
}

.btn {
  padding: 14rpx 18rpx;
  border-radius: 12rpx;
  font-size: 24rpx;
}

.btn-primary {
  background: #111827;
  color: #ffffff;
}

.btn-success {
  background: #2563eb;
  color: #ffffff;
}

.btn-info {
  background: #0ea5e9;
  color: #ffffff;
}

.card {
  padding: 16rpx;
  border-radius: 16rpx;
  background: #f8fafc;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.row {
  display: flex;
  justify-content: space-between;
  font-size: 26rpx;
  color: #0f172a;
}

.muted {
  color: #64748b;
  font-size: 24rpx;
  line-height: 1.6;
}

.chip {
  display: inline-block;
  padding: 6rpx 12rpx;
  border-radius: 999rpx;
  background: #e0f2fe;
  color: #0369a1;
  font-size: 22rpx;
}

.input {
  flex: 1;
  margin-left: 16rpx;
  padding: 14rpx 16rpx;
  background: #ffffff;
  border-radius: 12rpx;
  border: 1rpx solid #e2e8f0;
  font-size: 26rpx;
}
/* stylelint-enable order/properties-order */
</style>

<json>
{
  "navigationBarTitleText": "Vue 模板指令",
  "navigationBarBackgroundColor": "#111827",
  "navigationBarTextStyle": "white"
}
</json>
