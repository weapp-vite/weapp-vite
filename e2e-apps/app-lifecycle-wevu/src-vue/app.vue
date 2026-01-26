<script setup lang="ts">
import {
  getCurrentInstance,
  onError,
  onHide,
  onLaunch,
  onPageNotFound,
  onShow,
  onThemeChange,
  onUnhandledRejection,
} from 'wevu'
import { APP_HOOKS, finalizeAppLifecycle, recordAppLifecycle } from './shared/lifecycle'

const SOURCE = 'app.wevu.vue'
const app = getCurrentInstance()

if (app) {
  ;(app as any).finalizeLifecycleLogs = () => finalizeAppLifecycle(app, APP_HOOKS, { source: SOURCE })
}

onLaunch((options) => {
  if (app) {
    recordAppLifecycle(app, 'onLaunch', [options], { source: SOURCE })
  }
})

onShow((options) => {
  if (app) {
    recordAppLifecycle(app, 'onShow', [options], { source: SOURCE })
  }
})

onHide(() => {
  if (app) {
    recordAppLifecycle(app, 'onHide', [], { source: SOURCE })
  }
})

onError((error) => {
  if (app) {
    recordAppLifecycle(app, 'onError', [error], { source: SOURCE })
  }
})

onPageNotFound((options) => {
  if (app) {
    recordAppLifecycle(app, 'onPageNotFound', [options], { source: SOURCE })
  }
})

onUnhandledRejection((reason) => {
  if (app) {
    recordAppLifecycle(app, 'onUnhandledRejection', [reason], { source: SOURCE })
  }
})

onThemeChange((options) => {
  if (app) {
    recordAppLifecycle(app, 'onThemeChange', [options], { source: SOURCE })
  }
})
</script>
