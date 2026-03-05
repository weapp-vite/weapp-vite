<script setup lang="ts">
import { onLaunch } from 'wevu'

defineAppJson({
  pages: ['pages/home/index'],
  subPackages: [
    {
      root: 'subpackages/alpha',
      pages: ['index'],
    },
    {
      root: 'subpackages/beta',
      pages: ['index'],
    },
    {
      root: 'subpackages/gamma',
      pages: ['index'],
    },
  ],
})

onLaunch(() => {})
</script>
