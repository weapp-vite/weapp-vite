<script setup lang="ts">
import { onLaunch } from 'wevu'

defineAppJson({
  pages: [
    'pages/index/index',
    'pages/use-attrs/index',
    'pages/use-slots/index',
    'pages/use-model/index',
    'pages/use-provide-inject/index',
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
