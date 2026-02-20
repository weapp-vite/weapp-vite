<script lang="ts" setup>
defineProps<{
  str: string
  bool: boolean
}>()

defineComponentJson({ styleIsolation: 'apply-shared' })
</script>

<template>
  <text
    class="issue300-strict-probe"
    :data-strict-bool="String(bool)"
    :data-strict-bool-raw="bool"
    :data-strict-str="str"
  >
    {{ str }} {{ String(bool) }}
  </text>
</template>
