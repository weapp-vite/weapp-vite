<script setup lang="ts">
definePageJson({
  navigationBarTitleText: 'issue-398',
  backgroundColor: '#ffffff',
})

definePageMeta({
  layout: 'issue-398-shell',
})

const issue398Title = 'issue-398 hmr shared chunk'
const issue398TapLabel = 'remove-me'
const issue398Body = 'editing this page should not break layout component chunks'
const issue398PageMarker = 'issue-398-page-initial'
const issue398NavbarLabel = 'issue-398 navbar'
const issue398FooterLabel = 'issue-398 footer'

function noopTap() {}

function _runE2E() {
  return {
    ok: true,
    pageMarker: issue398PageMarker,
    title: issue398Title,
    navbarLabel: issue398NavbarLabel,
    footerLabel: issue398FooterLabel,
  }
}
</script>

<template>
  <view class="issue-398-page">
    <text class="issue-398-page__title">
      {{ issue398Title }}
    </text>
    <text class="issue-398-page__body">
      {{ issue398Body }}
    </text>
    <text class="issue-398-page__marker">
      {{ issue398PageMarker }}
    </text>
    <button class="issue-398-page__action" @tap="noopTap">
      {{ issue398TapLabel }}
    </button>
  </view>
</template>

<style>
.issue-398-page {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.issue-398-page__title {
  font-size: 34rpx;
  font-weight: 600;
}

.issue-398-page__body {
  font-size: 26rpx;
  color: #475569;
}

.issue-398-page__marker {
  font-size: 24rpx;
  color: #0f172a;
}
</style>
