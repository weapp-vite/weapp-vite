<script setup lang="ts">
import ContextContainer from '../../components/contextContainer/index.vue'
import Leaf from '../../components/leaf/index.vue'
import Provider from '../../components/provider/index.vue'
</script>

<template>
  <view>
    <Provider label="primary" :seed="0">
      <Leaf probe="primary" />
      <ContextContainer />
    </Provider>
  </view>
</template>
