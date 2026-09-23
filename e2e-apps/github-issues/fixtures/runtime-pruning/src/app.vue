<script setup lang="ts">
defineAppJson({
  pages: ['pages/index/index'],
  subPackages: [{ root: 'detail', pages: ['index'] }],
  window: { navigationBarTitleText: 'Runtime pruning' },
})
</script>
