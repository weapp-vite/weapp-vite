<script setup lang="ts">
defineOptions({
  name: 'Issue613LegacyViewForwarder',
})
</script>

<template>
  <Issue613Card slot-wrapper="view" slot-wrapper-footer="view">
    <template #header>
      <slot />
    </template>
    <template #footer>
      <slot name="footer" />
    </template>
  </Issue613Card>
</template>
