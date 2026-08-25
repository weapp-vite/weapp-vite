<script setup lang="ts">
import routes from 'weapp-vite/auto-routes'
import { onLaunch } from 'wevu'
import { ensureGithubIssuesRouter } from './shared/appRouter'

const defaultTabBarList = [
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

const issue793BuildScopeEnabled = (
  routes.pages.length + routes.subPackages.length > 0
  && routes.pages.every(page => (
    page === 'pages/issue-793/index'
    || page === 'pages/issue-793-settings/index'
  ))
  && routes.subPackages.every(subPackage => (
    subPackage.root === 'subs'
    && subPackage.pages.every(page => page === 'issue-793/index')
  ))
)
const appSubPackages = routes.subPackages.map((subPackage) => {
  if (
    routes.pages.includes('pages/issue-850/index')
    && subPackage.root === 'subpackages/issue-850'
  ) {
    return { ...subPackage, independent: true }
  }
  if (
    routes.pages.length === 2
    && routes.pages.includes('pages/issue-845-native/index')
    && routes.pages.includes('pages/issue-845-vue/index')
    && subPackage.root === 'subpackages/issue-845-independent'
  ) {
    return { ...subPackage, independent: true }
  }
  return subPackage
})
const tabBarList = issue793BuildScopeEnabled
  ? [
      {
        pagePath: 'pages/issue-793/index',
        text: 'issue-793',
      },
      {
        pagePath: 'pages/issue-793-settings/index',
        text: 'issue-793-settings',
      },
      {
        pagePath: 'subs/issue-793/index',
        text: 'issue-793-subpackage',
      },
    ]
  : defaultTabBarList

defineAppJson({
  pages: routes.pages,
  subPackages: appSubPackages,
  subpackages: appSubPackages,
  ...(issue793BuildScopeEnabled
    ? {
        entryPagePath: 'pages/issue-793/index',
        preloadRule: {
          'pages/issue-793/index': {
            packages: ['subs', 'missing'],
          },
          'subs/issue-793/index': {
            packages: ['__APP__'],
          },
        },
      }
    : {}),
  ...(tabBarList.length >= 2
    ? {
        tabBar: {
          backgroundColor: '#ffffff',
          color: '#000000',
          custom: true,
          list: tabBarList,
          selectedColor: '#000000',
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
