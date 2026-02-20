<script lang="ts" setup>
defineProps<{
  str: string
  bool: boolean
  caseId?: string
}>()

defineComponentJson({ styleIsolation: 'apply-shared' })
</script>

<template>
  <text
    class="issue300-strict-probe"
    :data-case-id="caseId || 'default'"
    :data-strict-bool="String(bool)"
    :data-strict-bool-raw="bool"
    :data-strict-str="str"
  >
    {{ str }} {{ String(bool) }}
  </text>
</template>
