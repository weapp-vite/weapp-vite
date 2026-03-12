<script setup lang="ts">
import { onLaunch } from 'wevu'

defineAppJson({
  pages: ['pages/index/index'],
  subPackages: [
    {
      root: 'subpackages/normal-wevu',
      pages: ['pages/entry/index', 'pages/detail/index'],
    },
    {
      root: 'subpackages/independent-wevu',
      pages: ['pages/entry/index', 'pages/detail/index'],
      independent: true,
    },
  ],
  window: {
    navigationBarTitleText: 'wevu subpackage placement',
  },
  style: 'v2',
  componentFramework: 'glass-easel',
  sitemapLocation: 'sitemap.json',
})

onLaunch(() => {})
</script>
