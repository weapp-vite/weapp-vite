<!-- eslint-disable perfectionist/sort-imports -->
<script setup lang="ts">
import { appPages } from './app.config'
import { onError, onErrorCaptured, onHide, onShow } from 'wevu'

import { pushLifecycleLog } from './stores/lifecycleLogs'

defineAppJson({
  pages: appPages,
  window: {
    navigationBarTitleText: 'WeVu 综合示例',
    navigationBarBackgroundColor: '#667eea',
    navigationBarTextStyle: 'white',
    backgroundColor: '#f5f7fa',
  },
  tabBar: {
    color: '#64748b',
    selectedColor: '#111827',
    backgroundColor: '#ffffff',
    list: [
      { pagePath: 'pages/index/index', text: '首页' },
      { pagePath: 'pages/ui-tdesign/index', text: 'TDesign' },
      { pagePath: 'pages/ui-vant/index', text: 'Vant' },
    ],
  },
  subpackages: [
    {
      root: 'subpackages/normal-a',
      name: 'normal-a',
      pages: [
        'pages/home/index',
        'pages/detail/index',
      ],
    },
    {
      root: 'subpackages/normal-b',
      name: 'normal-b',
      pages: [
        'pages/home/index',
        'pages/detail/index',
      ],
    },
    {
      root: 'subpackages/independent-a',
      name: 'independent-a',
      independent: true,
      pages: [
        'pages/home/index',
        'pages/detail/index',
      ],
    },
    {
      root: 'subpackages/independent-b',
      name: 'independent-b',
      independent: true,
      pages: [
        'pages/home/index',
        'pages/detail/index',
      ],
    },
  ],
  preloadRule: {
    'pages/index/index': {
      packages: [
        'subpackages/normal-a',
        'subpackages/normal-b',
      ],
      network: 'all',
      timeout: 2000,
    },
  },
  style: 'v2',
  componentFramework: 'glass-easel',
  sitemapLocation: 'sitemap.json',
})
</script>

<script lang="ts">
export default {
  setup() {
    console.log('[App] WeVu 综合示例应用启动')
    pushLifecycleLog('setup', 'app', '应用 setup 已执行')
    onShow(() => {
      pushLifecycleLog('onShow', 'app', '应用进入前台')
    })
    onHide(() => {
      pushLifecycleLog('onHide', 'app', '应用进入后台')
    })
    onError((err) => {
      pushLifecycleLog('onError', 'app', `${err instanceof Error ? err.message : String(err ?? '')}`)
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
}
</script>

<style>
/* stylelint-disable order/properties-order */

/* @wv-keep-import 'miniprogram_npm/tdesign-miniprogram/common/style/theme/_index.wxss'; */

/* @wv-keep-import '@vant/weapp/common/index.wxss'; */
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
