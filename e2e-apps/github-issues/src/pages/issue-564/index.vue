<script setup lang="ts">
definePageJson({
  navigationBarTitleText: 'issue-564',
  usingComponents: {
    'issue-564-native-tabbar': '/components/issue-564/native-tabbar/index',
    'issue-564-native-tabbar-item': '/components/issue-564/native-tabbar-item/index',
  },
})

const tabItems = [
  {
    label: 'issue-564-home',
    icon: 'home',
    to: {
      name: 'home',
    },
  },
  {
    label: 'issue-564-user',
    icon: 'user',
    to: {
      name: 'user',
    },
  },
]

function _runE2E() {
  return {
    ok: true,
    labels: tabItems.map(item => item.label),
  }
}
</script>

<template>
  <view class="issue564-page">
    <view class="issue564-title">
      issue-564 native nested scoped slot
    </view>

    <issue-564-native-tabbar>
      <issue-564-native-tabbar-item
        v-for="{ label, icon, to } in tabItems"
        :key="label"
        :icon="icon"
        :label="label"
        :name="to.name"
      >
        {{ label }}
      </issue-564-native-tabbar-item>
    </issue-564-native-tabbar>
  </view>
</template>

<style scoped>
.issue564-page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 28rpx;
  background: #fff;
}

.issue564-title {
  margin-bottom: 18rpx;
  font-size: 30rpx;
  font-weight: 700;
  color: #111827;
}
</style>
