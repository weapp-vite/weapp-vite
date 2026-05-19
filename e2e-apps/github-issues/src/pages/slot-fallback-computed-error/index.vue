<script setup lang="ts">
definePageJson({
  navigationBarTitleText: 'slot-fallback-computed-error',
})
</script>

<template>
  <view
    data-slot-fallback-computed-error="root"
    :data-missing-computed="missingMigratedComputed()"
  />
</template>
