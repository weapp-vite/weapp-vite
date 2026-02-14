<script setup lang="ts">
import routes from 'weapp-vite/auto-routes'

defineAppJson({
  pages: routes.pages,
  window: {
    navigationBarTitleText: 'auto-routes-define-app-json',
  },
})
</script>
