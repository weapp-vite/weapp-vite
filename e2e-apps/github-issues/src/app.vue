<script setup lang="ts">
import routes from 'weapp-vite/auto-routes'
import { onLaunch } from 'wevu'
import { ensureGithubIssuesRouter } from './shared/appRouter'

const tabBarList = [
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
  ...(tabBarList.length >= 2
    ? {
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
