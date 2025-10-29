<script lang="ts">
export default {
  type: 'page',
  data() {
    return {
      message: 'Hello Wevu',
      array: ['A', 'B', 'C'],
      view: 'WEBVIEW',
      staffA: { firstName: 'San', lastName: 'Zhang' },
      staffB: { firstName: 'Si', lastName: 'Li' },
      staffC: { firstName: 'Wu', lastName: 'Wang' },
    }
  },
  computed: {
    upperMessage() {
      return this.message.toUpperCase()
    },
  },
  methods: {
    setView(view: string) {
      this.view = view
    },
  },
  watch: {
    view(newValue: string, oldValue: string) {
      console.log('view changed from', oldValue, 'to', newValue)
    },
  },
}
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

<config lang="json">
  {
    "usingComponents": {
      "list": "../components/list"
    }
  }
</config>

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
