<script lang="ts">
import { createApp } from 'wevu'

createApp({
  data() {
    return {
      globalMessage: 'WeVu Comprehensive Demo',
    }
  },
  setup() {
    console.log('[App] WeVu 综合示例应用启动')
  },
  onLaunch() {
    console.log('[App] onLaunch - 应用启动')
  },
  onShow() {
    console.log('[App] onShow - 应用显示')
  },
  onHide() {
    console.log('[App] onHide - 应用隐藏')
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
  background: #ffffff;
  border-radius: 16rpx;
  padding: 32rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 2rpx 12rpx rgb(0 0 0 / 8%);
}

.section-title {
  font-size: 32rpx;
  font-weight: 500;
  color: #333333;
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
  color: #ffffff;
}

.btn-success {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: #ffffff;
}

.btn-info {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  color: #ffffff;
}

.btn-warning {
  background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
  color: #ffffff;
}
/* stylelint-enable order/properties-order */
</style>

<config lang="json">
{
  "$schema": "https://vite.icebreaker.top/app.json",
  "pages": [
    "pages/index/index",
    "pages/basic/index",
    "pages/computed/index",
    "pages/watch/index",
    "pages/lifecycle/index",
    "pages/setup/index",
    "pages/setup-script/index",
    "pages/form/index",
    "pages/list/index",
    "pages/component/index",
    "pages/store/index",
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
</config>
