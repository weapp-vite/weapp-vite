import process from 'node:process'

function copyEnv(source: string, target: string) {
  if (!process.env[target] && process.env[source]) {
    process.env[target] = process.env[source]
  }
}

process.env.TEMPLATES_HMR_FILTER ??= 'weapp-vite-wevu-template'
copyEnv('WEVU_TEMPLATE_HMR_REPORT_DIR', 'TEMPLATES_HMR_REPORT_DIR')
copyEnv('WEVU_TEMPLATE_HMR_CLI_PATH', 'TEMPLATES_HMR_CLI_PATH')
copyEnv('WEVU_TEMPLATE_HMR_ITERATIONS', 'TEMPLATES_HMR_ITERATIONS')
copyEnv('WEVU_TEMPLATE_HMR_BUDGET_MS', 'TEMPLATES_HMR_BUDGET_MS')
copyEnv('WEVU_TEMPLATE_HMR_TIMEOUT_MS', 'TEMPLATES_HMR_TIMEOUT_MS')
copyEnv('WEVU_TEMPLATE_HMR_KEEP_WORKSPACE', 'TEMPLATES_HMR_KEEP_WORKSPACE')

if (!process.env.TEMPLATES_HMR_WORKSPACE_ROOT && process.env.WEVU_TEMPLATE_HMR_WORKSPACE) {
  process.env.TEMPLATES_HMR_WORKSPACE_ROOT = `${process.env.WEVU_TEMPLATE_HMR_WORKSPACE}-root`
}

const { main } = await import('./benchmark-templates-hmr')
await main()
