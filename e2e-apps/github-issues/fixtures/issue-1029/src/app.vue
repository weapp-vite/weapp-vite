<script setup lang="ts">
import { pages, subPackages } from 'weapp-vite/auto-routes'
import './router'

defineAppJson({
  pages,
  subPackages,
  entryPagePath: 'pages/home/index',
})
</script>
