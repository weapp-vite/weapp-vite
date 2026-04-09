<script setup lang="ts">
definePageJson({
  navigationBarTitleText: 'issue-338',
})

const title = 'discussion-338 html tag mapping'
const cover = '/assets/issue-338-cover.png'
const links = ['issue-289', 'issue-300']
</script>

<template>
  <div
    v-if="true"
    class="issue338-page"
  >
    <span class="issue338-title">{{ title }}</span>
    <img
      class="issue338-cover"
      :src="cover"
      mode="aspectFit"
    >
    <section class="issue338-links">
      <a
        v-for="link in links"
        :key="link"
        :url="`/pages/${link}/index`"
        class="issue338-link"
      >
        {{ link }}
      </a>
    </section>
  </div>
</template>

<style scoped>
.issue338-page {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  padding: 32rpx;
}

.issue338-title {
  font-size: 28rpx;
}

.issue338-cover {
  width: 160rpx;
  height: 160rpx;
}

.issue338-links {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.issue338-link {
  color: #0f766e;
}
</style>
