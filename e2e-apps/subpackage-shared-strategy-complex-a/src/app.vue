<script setup lang="ts">
import { onLaunch } from 'wevu'

defineAppJson({
  pages: ['pages/index/index'],
  subPackages: [
    {
      root: 'subpackages/item',
      pages: ['index'],
    },
    {
      root: 'subpackages/user',
      pages: ['index'],
    },
    {
      root: 'subpackages/report',
      pages: ['index'],
    },
  ],
})

onLaunch(() => {})
</script>
