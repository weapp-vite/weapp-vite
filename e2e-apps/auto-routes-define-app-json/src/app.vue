<script setup lang="ts">
// @ts-expect-error e2e 用于触发 auto-routes 虚拟模块加载
import routes from 'virtual:weapp-vite-auto-routes'

defineOptions({
  globalData: {
    __autoRoutesPages: routes.pages,
  },
})

defineAppJson({
  pages: [
    'pages/home/index',
    'pages/logs/index',
  ],
  window: {
    navigationBarTitleText: 'auto-routes-define-app-json',
  },
})
</script>
