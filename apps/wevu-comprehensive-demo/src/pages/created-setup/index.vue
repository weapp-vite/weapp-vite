<script lang="ts">
export default {
  data() {
    return {
      exportKeys: '',
      exportSummary: '',
      pingResult: '',
      aValue: '',
      setDataCallCount: '',
    }
  },
  methods: {
    readComponentExport() {
      const exported = (this as any).selectComponent?.('#createdDemo')
      if (!exported) {
        this.exportSummary = 'selectComponent 返回空（请确认组件已渲染且启用了 wx://component-export）'
        return
      }

      this.exportKeys = Object.keys(exported).sort().join(', ')
      this.pingResult = typeof exported.ping === 'function' ? exported.ping() : '(ping not found)'
      this.aValue = String((exported as any).a ?? '')
      this.setDataCallCount = typeof exported.getSetDataCallCount === 'function'
        ? String(exported.getSetDataCallCount())
        : '(getSetDataCallCount not found)'

      this.exportSummary = [
        `fromExport=${String((exported as any).fromExport ?? false)}`,
        `exposedFlag=${String((exported as any).exposedFlag ?? false)}`,
      ].join(', ')
    },
  },
}
</script>

<template>
  <view class="container">
    <view class="page-title">
      setup@created
    </view>

    <view class="section">
      <view class="section-title">
        说明
      </view>
      <text class="tip-text">
        这个页面演示 wevu 默认行为：setup 在 lifetimes.created 执行；created 阶段产生的 setData 会被缓冲，直到 attached/onLoad 才 flush。
      </text>
    </view>

    <view class="section">
      <view class="section-title">
        组件 demo
      </view>
      <wevu-created-setup-demo id="createdDemo" />
    </view>

    <view class="section">
      <view class="section-title">
        component-export（expose + export 合并）
      </view>
      <button class="btn btn-info" @click="readComponentExport">
        selectComponent('#createdDemo')
      </button>
      <view class="kv">
        <text class="k">
          keys
        </text>
        <text class="v">
          {{ exportKeys || '-' }}
        </text>
      </view>
      <view class="kv">
        <text class="k">
          summary
        </text>
        <text class="v">
          {{ exportSummary || '-' }}
        </text>
      </view>
      <view class="kv">
        <text class="k">
          ping()
        </text>
        <text class="v">
          {{ pingResult || '-' }}
        </text>
      </view>
      <view class="kv">
        <text class="k">
          a（export 优先级）
        </text>
        <text class="v">
          {{ aValue || '-' }}
        </text>
      </view>
      <view class="kv">
        <text class="k">
          setDataCallCount
        </text>
        <text class="v">
          {{ setDataCallCount || '-' }}
        </text>
      </view>
    </view>
  </view>
</template>

<style>
/* stylelint-disable order/properties-order */
.tip-text {
  display: block;
  font-size: 26rpx;
  color: #4b5563;
  line-height: 1.7;
}

.kv {
  display: flex;
  gap: 12rpx;
  padding: 12rpx 0;
  border-top: 1rpx solid #eef2f7;
}

.k {
  width: 220rpx;
  color: #6b7280;
  font-size: 24rpx;
}

.v {
  flex: 1;
  color: #111827;
  font-size: 24rpx;
  word-break: break-all;
}
/* stylelint-enable order/properties-order */
</style>

<json>
{
  "$schema": "https://vite.icebreaker.top/page.json",
  "navigationBarTitleText": "setup@created",
  "navigationBarBackgroundColor": "#4facfe",
  "navigationBarTextStyle": "white",
  "usingComponents": {
    "wevu-created-setup-demo": "/components/wevu-created-setup-demo/index"
  }
}
</json>
