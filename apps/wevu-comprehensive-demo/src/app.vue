<script lang="ts">
import { createApp, onAppError, onAppHide, onAppShow, onErrorCaptured } from 'wevu'

import { pushLifecycleLog } from './stores/lifecycleLogs'

createApp({
  setup() {
    console.log('[App] WeVu 综合示例应用启动')
    pushLifecycleLog('setup', 'app', '应用 setup 已执行')
    onAppShow(() => {
      pushLifecycleLog('onAppShow', 'app', '应用进入前台')
    })
    onAppHide(() => {
      pushLifecycleLog('onAppHide', 'app', '应用进入后台')
    })
    onAppError((err) => {
      pushLifecycleLog('onAppError', 'app', `${err instanceof Error ? err.message : String(err ?? '')}`)
    })
    onErrorCaptured((err) => {
      pushLifecycleLog('onErrorCaptured', 'alias', `${err instanceof Error ? err.message : String(err ?? '')}`)
    })
  },
  data() {
    return {
      globalMessage: 'WeVu Comprehensive Demo',
    }
  },
  onLaunch() {
    console.log('[App] onLaunch - 应用启动')
    pushLifecycleLog('onLaunch', 'app', '原生生命周期 onLaunch')
  },
  onShow() {
    console.log('[App] onShow - 应用显示')
    pushLifecycleLog('onShow', 'app', '原生生命周期 onShow')
  },
  onHide() {
    console.log('[App] onHide - 应用隐藏')
    pushLifecycleLog('onHide', 'app', '原生生命周期 onHide')
  },
})
</script>

<style>
/* stylelint-disable order/properties-order */
page {
  background-color: #f5f7fa;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  color: #2c3e50;
}

.container {
  padding: 32rpx;
}

.page-title {
  font-size: 44rpx;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 32rpx;
}

.section {
  background: #fff;
  border-radius: 16rpx;
  padding: 32rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 2rpx 12rpx rgb(0 0 0 / 8%);
}

.section-title {
  font-size: 32rpx;
  font-weight: 500;
  color: #333;
  margin-bottom: 24rpx;
}

.btn {
  padding: 24rpx 32rpx;
  border-radius: 12rpx;
  font-size: 28rpx;
  transition: all 0.3s;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
}

.btn-success {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: #fff;
}

.btn-info {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  color: #fff;
}

.btn-warning {
  background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
  color: #fff;
}
/* stylelint-enable order/properties-order */
</style>

<json>
{
  "$schema": "https://vite.icebreaker.top/app.json",
  "pages": [
    "pages/index/index",
    "pages/basic/index",
    "pages/computed/index",
    "pages/watch/index",
    "pages/lifecycle/index",
    "pages/wevu-hooks/index",
    "pages/auto-features/index",
    "pages/setup/index",
    "pages/created-setup/index",
    "pages/setup-script/index",
    "pages/form/index",
    "pages/list/index",
    "pages/component/index",
    "pages/slot/index",
    "pages/component-interop/index",
    "pages/store/index",
    "pages/store-shared/index",
    "pages/vue-template/index",
    "pages/vue-bindings/index",
    "pages/vue-events/index",
    "pages/vue-v-model/index",
    "pages/vue-slots-advanced/index",
    "pages/vue-dynamic/index",
    "pages/vue-script-setup/index",
    "pages/json-macros/index",
    "pages/vue-auto-components/index",
    "pages/vue-render/index",
    "pages/vue-style/index",
    "pages/advanced/index"
  ],
  "window": {
    "navigationBarTitleText": "WeVu 综合示例",
    "navigationBarBackgroundColor": "#667eea",
    "navigationBarTextStyle": "white",
    "backgroundColor": "#f5f7fa"
  },
  "style": "v2",
  "componentFramework": "glass-easel",
  "sitemapLocation": "sitemap.json"
}
</json>
