<script setup lang="ts">
import { pages, subPackages } from 'weapp-vite/auto-routes'

defineAppJson({ pages, subPackages, entryPagePath: 'pages/home/index' })
</script>
