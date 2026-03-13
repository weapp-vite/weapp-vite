<script setup lang="ts">
import routes from 'weapp-vite/auto-routes'
import { onLaunch } from 'wevu'
import { ensureGithubIssuesRouter } from './shared/appRouter'

defineAppJson({
  pages: routes.pages,
  subPackages: routes.subPackages,
})

ensureGithubIssuesRouter()

onLaunch(() => {})
</script>
