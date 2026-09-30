<script setup lang="ts">
import { definePageMeta as meta, ref } from 'wevu'
import { definePage as route } from 'wevu/router'

route({ name: 'dynamic', meta: { access: 'public' } })
const dynamicValue = Date.now()
meta({ layout: false, extra: dynamicValue })
const count = ref(0)
</script>

<template>
  <button id="increment" @tap="count++">{{ count }}</button>
</template>
