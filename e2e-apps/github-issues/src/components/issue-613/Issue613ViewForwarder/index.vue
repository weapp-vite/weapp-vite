<script setup lang="ts">
defineOptions({
  name: 'Issue613ViewForwarder',
})
</script>

<template>
  <Issue613Card slot-wrapper="cover-view" slot-wrapper-footer="view">
    <template #header>
      <slot />
    </template>
    <template #footer>
      <slot name="footer" />
    </template>
  </Issue613Card>
</template>
