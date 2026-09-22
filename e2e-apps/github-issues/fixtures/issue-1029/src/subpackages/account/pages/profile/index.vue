<script setup lang="ts" src="@page-scripts/profile.ts"></script>

<template>
  <view id="issue-1029-profile">
    <view id="route-title">{{ title }}</view>
    <button id="go-back" @tap="navigate('back')">Back</button>
  </view>
</template>
