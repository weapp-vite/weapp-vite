<script setup lang="ts">
import ComputedProvider from '../../components/computedProvider/index.vue'
import ContextContainer from '../../components/contextContainer/index.vue'
import GetterLeaf from '../../components/getterLeaf/index.vue'
import Leaf from '../../components/leaf/index.vue'
import Provider from '../../components/provider/index.vue'
import SharedGetterLeaf from '../../components/sharedGetterLeaf/index.vue'
</script>

<template>
  <view>
    <Provider label="primary" :seed="0">
      <Leaf probe="primary" />
      <ContextContainer />
      <GetterLeaf />
      <SharedGetterLeaf />
    </Provider>
    <ComputedProvider>
      <Leaf probe="computed-projected" />
    </ComputedProvider>
  </view>
</template>
