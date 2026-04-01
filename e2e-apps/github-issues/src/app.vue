<script setup lang="ts">
import routes from 'weapp-vite/auto-routes'
import { onLaunch } from 'wevu'
import { ensureGithubIssuesRouter } from './shared/appRouter'

defineAppJson({
  pages: routes.pages,
  subPackages: routes.subPackages,
  tabBar: {
    custom: true,
    list: [
      {
        pagePath: 'pages/issue-380/index',
        text: 'issue-380',
      },
      {
        pagePath: 'pages/issue-289/index',
        text: 'issue-289',
      },
    ],
  },
})

ensureGithubIssuesRouter()

onLaunch(() => {})
</script>
