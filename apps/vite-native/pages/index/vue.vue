<script>
Page({
  data: {
    title: 'page1',
  },
})
</script>

<script setup>
Page()

// {
//   "usingComponents": {
//     "list": "../components/list"
//   }
// }
</script>

<template>
  <view wx:if="{{true}}">
    1
  </view>
</template>

<style lang="scss" scoped></style>

<config>
{
    "x":{
      "navigationBarTitleText": "page1"
    }
  }
</config>
