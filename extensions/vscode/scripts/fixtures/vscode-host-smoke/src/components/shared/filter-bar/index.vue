<template>
  <view class="filter-bar">
    <view wx:for="{{['all', 'todo', 'done']}}" wx:key="*this">{{ item }}</view>
  </view>
</template>
