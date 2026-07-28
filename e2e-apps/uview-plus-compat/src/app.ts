import { mixin, mount$u } from 'uview-plus'
import { createApp, setWevuDefaults } from 'wevu'

mount$u()
setWevuDefaults({ component: { mixins: [mixin] } })

function formatRuntimeError(value: unknown) {
  if (value instanceof Error) {
    return [value.name, value.message, value.stack].filter(Boolean).join('\n')
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    const nested = record.reason ?? record.error ?? record.errMsg
    if (nested !== undefined && nested !== value) {
      return formatRuntimeError(nested)
    }
    try {
      return JSON.stringify(value)
    }
    catch {
      return String(value)
    }
  }
  return String(value)
}

const app = createApp({
  onError(error: unknown) {
    // eslint-disable-next-line no-console
    console.error(`[uview-plus runtime error] ${formatRuntimeError(error)}`)
  },
  onUnhandledRejection(result: unknown) {
    // eslint-disable-next-line no-console
    console.error(`[uview-plus unhandled rejection] ${formatRuntimeError(result)}`)
  },
})
app.config.globalProperties.$u = (uni as typeof uni & { $u: unknown }).$u
