<script setup lang="ts">
defineAppJson({
  pages: [
    'pages/index/index',
    'pages/isolation/index',
    'pages/nesting/index',
    'pages/lifecycle/index',
    'pages/native-export/index',
    'pages/exported-owner/index',
    'pages/unprojected/index',
    'pages/keyed/index',
    'pages/plain/index',
  ],
  window: { navigationStyle: 'custom' },
})
</script>
