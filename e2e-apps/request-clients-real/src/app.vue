<script setup lang="ts">
import routes from 'weapp-vite/auto-routes'

defineAppJson({
  pages: routes.pages,
  subPackages: routes.subPackages,
  window: {
    navigationBarTitleText: 'request-clients-real',
    navigationBarBackgroundColor: '#0f172a',
    navigationBarTextStyle: 'white',
    backgroundColor: '#e2e8f0',
  },
  style: 'v2',
})
</script>

<style>
.app-root {
  color: inherit;
}
</style>
