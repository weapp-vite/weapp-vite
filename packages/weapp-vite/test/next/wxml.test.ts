import { processWxml } from '@/wxml'

describe('wxml', () => {
  it('processWxml remove wxs', () => {
    const { deps, code } = processWxml(`<!-- index.wxml -->
<template name="staffName">
  <view>FirstName: {{firstName}}, LastName: {{lastName}}</view>
</template>
<navigation-bar></navigation-bar>
<image src="../../assets/logo.png" class="w-40 h-40"></image>
<image src="{{logoUrl}}" class="w-40 h-40"></image>
<ice-avatar></ice-avatar>
<scroll-view scroll-y type="list">
  <view class="p-2 border m-2 rounded">{{ motto }}</view>
  <view class="bg-[#c50d69] text-[10px] text-[#123456] w-[323px] {{true?'h-[30px]':'h-[45px]'}}">
    bg-[#7d7ac2] text-[10px] text-[#123456] w-[323px]
  </view>
  <view class="p-2 border">{{message}}</view>
  <view wx:for="{{array}}">{{item}}</view>
  <template is="staffName" data="{{...staffA}}"></template>
  <template is="staffName" data="{{...staffB}}"></template>
  <template is="staffName" data="{{...staffC}}"></template>
  <template bindtap="switchTemplate" is="{{flag? 'odd': 'staffName'}}" data="{{...staffC}}"></template>
  <t-divider></t-divider>
  <view class="user-motto text-pink-200 bg-slate-100">{{m1.message}}</view>
  <wxs module="wxs" src="./test.wxs"></wxs>
  <view id="tapTest" data-hi="Weixin" bindtap="{{wxs.tapName}}">Click me!</view>
</scroll-view>
<template name="odd">
  <view>odd</view>
</template>
<template name="even">
  <view>even</view>
</template>
<view class="button-example">
  <t-button bind:tap="switchTemplate" theme="primary" size="large">填充按钮</t-button>
  <t-button bind:click="switchTemplate" theme="light" size="large">填充按钮</t-button>
  <t-button size="large">填充按钮</t-button>
</view>
<block wx:for="{{[1, 2, 3, 4, 5]}}">
  <template is="{{item % 2 == 0 ? 'even' : 'odd'}}" />
</block>
<wxs src="./index.wxs" module="tools" />
<wxs module="m1">
var msg = "hello world";

module.exports.message = msg;
</wxs>`)
    expect(deps).matchSnapshot('deps')
    expect(code).matchSnapshot('code')
  })

  it('processWxml remove wxs case 0', () => {
    const { deps, code } = processWxml(`<wxs src="./index.wxs" module="tools" />`)
    expect(deps).matchSnapshot('deps')
    expect(code).matchSnapshot('code')
  })

  it('processWxml remove wxs case 1', () => {
    const { deps, code } = processWxml(`<wxs src="./index.wxs.ts" module="tools" />`)
    expect(deps).matchSnapshot('deps')
    expect(code).matchSnapshot('code')
  })

  it('processWxml remove wxs case 2', () => {
    const { deps, code } = processWxml(`<wxs src="./index.wxs.js" module="tools" />`)
    expect(deps).matchSnapshot('deps')
    expect(code).matchSnapshot('code')
  })

  it('processWxml remove wxs case 3', () => {
    const { deps, code } = processWxml(`<wxs module="foo">
var some_msg = "hello world";
module.exports = {
  msg : some_msg,
}
</wxs>
<view> {{foo.msg}} </view>`)
    expect(deps).matchSnapshot('deps')
    expect(code).matchSnapshot('code')
  })

  it('processWxml remove wxs case 4', () => {
    const { deps, code } = processWxml(`<wxs module="foo" lang="js">
var some_msg = "hello world";
module.exports = {
  msg : some_msg,
}
</wxs>
<view> {{foo.msg}} </view>`)
    expect(deps).matchSnapshot('deps')
    expect(code).matchSnapshot('code')
  })

  it('processWxml remove wxs case 5', () => {
    const { deps, code } = processWxml(`<wxs module="foo" lang="ts">
var some_msg = "hello world";
module.exports = {
  msg : some_msg,
}
</wxs>
<view> {{foo.msg}} </view>`)
    expect(deps).matchSnapshot('deps')
    expect(code).matchSnapshot('code')
  })
})
