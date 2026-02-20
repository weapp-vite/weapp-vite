<script lang="ts" setup>
defineProps<{
  str: string
  bool: boolean
}>()

defineComponentJson({ styleIsolation: 'apply-shared' })
</script>

<template>
  <text class="issue300-strict-probe">
    {{ str }} {{ String(bool) }}
  </text>
</template>
