<script setup lang="ts">
import routes from 'weapp-vite/auto-routes'
import { onLaunch } from 'wevu'
import { ensureGithubIssuesRouter } from './shared/appRouter'

const tabBarList = [
  {
    pagePath: 'pages/issue-705/index',
    text: 'issue-705',
  },
  {
    pagePath: 'pages/issue-705-tab/index',
    text: 'issue-705-tab',
  },
  {
    pagePath: 'pages/issue-380/index',
    text: 'issue-380',
  },
  {
    pagePath: 'pages/issue-289/index',
    text: 'issue-289',
  },
].filter(item => routes.pages.includes(item.pagePath))

defineAppJson({
  pages: routes.pages,
  subPackages: routes.subPackages,
  subpackages: routes.subPackages,
  ...(tabBarList.length >= 2
    ? {
        usingComponents: {
          'custom-tab-bar': '/custom-tab-bar/index',
        },
        tabBar: {
          custom: true,
          list: tabBarList,
        },
      }
    : {}),
})

ensureGithubIssuesRouter()

onLaunch(() => {})
</script>

<template>
  <view
    id="github-issues-app-shell"
    class="issue-563-app-shell"
    data-e2e-shell="github-issues"
  >
    <slot />
  </view>
</template>

<style>
.issue-563-app-shell {
  min-height: 100vh;
}
</style>
