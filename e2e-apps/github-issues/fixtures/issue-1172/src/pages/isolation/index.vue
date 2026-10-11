<script setup lang="ts">
import Leaf from '../../components/leaf/index.vue'
import Provider from '../../components/provider/index.vue'
</script>

<template>
  <view>
    <Provider label="left" :seed="0">
      <Leaf probe="left" />
    </Provider>
    <Provider label="right" :seed="10">
      <Leaf probe="right" />
    </Provider>
  </view>
</template>
