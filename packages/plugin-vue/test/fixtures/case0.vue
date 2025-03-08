<script>
Page()
</script>

<template>
  <view> {{ message }} </view>
  <view wx:for="{{array}}"> {{ item }} </view>
  <view wx:if="{{view == 'WEBVIEW'}}"> WEBVIEW </view>
  <view wx:elif="{{view == 'APP'}}"> APP </view>
  <view wx:else="{{view == 'MINA'}}"> MINA </view>
  <template name="staffName">
    <view>
      FirstName: {{ firstName }}, LastName: {{ lastName }}
    </view>
  </template>

  <template is="staffName" data="{{...staffA}}"></template>
  <template is="staffName" data="{{...staffB}}"></template>
  <template is="staffName" data="{{...staffC}}"></template>
</template>

<style>
.a {
  color: red;
}
</style>

<json>
  {
    "usingComponents": {
      "list": "../components/list"
    }
  }
</json>

<!-- <script type="application/json">
  {
    "usingComponents": {
      "list": "../components/list"
    }
  }
</script>

<script type="json">
  {
    "usingComponents": {
      "list": "../components/list"
    }
  }
</script> -->