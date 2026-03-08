<script setup lang="ts">
import { onLaunch } from 'wevu'

defineAppJson({
  pages: [
    'pages/index/index',
    'pages/use-attrs/index',
    'pages/use-slots/index',
    'pages/use-model/index',
    'pages/use-provide-inject/index',
    'pages/use-store/index',
    'pages/subpath-entries/index',
    'pages/native-uses-vue/index',
    'pages/router-stability/index',
    'pages/router-stability/sub/index',
    'pages/router-stability/target/index',
    'pages/router-stability/sub/target/index',
    'components/router-origin-probe/target/index',
  ],
  window: {
    navigationBarTitleText: 'wevu-features',
  },
})

onLaunch(() => {})
</script>

<style>
.wevu-features-app-root {
  color: inherit;
}
</style>
