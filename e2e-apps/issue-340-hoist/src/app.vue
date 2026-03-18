<script setup lang="ts">
import { onLaunch } from 'wevu'

defineAppJson({
  pages: ['pages/index/index'],
  subPackages: [
    {
      root: 'subpackages/item',
      pages: ['login-required/index'],
    },
    {
      root: 'subpackages/user',
      pages: ['register/form'],
    },
  ],
})

onLaunch(() => {})
</script>
