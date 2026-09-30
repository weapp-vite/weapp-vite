<script setup lang="ts">
import { definePageMeta as meta, ref } from 'wevu'
import { definePage as route } from 'wevu/router'

route({ name: 'home', meta: { access: 'public' } })
meta({ layout: false })
definePageJson({ enablePullDownRefresh: false })
const count = ref(0)
</script>

<template>
  <button id="increment" @tap="count++">{{ count }}</button>
</template>
