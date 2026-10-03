<script setup lang="ts">
defineAppJson({
  pages: [
    'pages/index/index',
    'pages/isolation/index',
    'pages/nesting/index',
    'pages/lifecycle/index',
    'pages/native-export/index',
    'pages/exported-owner/index',
  ],
  window: { navigationStyle: 'custom' },
})
</script>
