<script setup lang="ts">
import { sharedProbe } from '../../sharedProbe'

const label = sharedProbe.label
</script>

<template>
  <text id="shared-getter-owner">{{ label }}</text>
</template>
