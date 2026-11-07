<script setup lang="ts">
import Consumer from '../../components/consumer/index.vue'
import Provider from '../../components/provider/index.vue'

definePageMeta({ layout: false })
</script>

<template>
  <view id="issue1299-without-layout">
    <Provider label="standalone" :seed="20">
      <Consumer probe="standalone" />
    </Provider>
  </view>
</template>
