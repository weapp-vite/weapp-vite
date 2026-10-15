import type { ProfileCase } from './types'

const retail = 'templates/weapp-vite-wevu-tailwindcss-tdesign-retail-template'
const registration = 'e2e-apps/github-issues/fixtures/issue-1172'

export const compilerCases: readonly ProfileCase[] = [
  { id: 'script-setup', cohort: 'wevu', project: 'apps/wevu-comprehensive-demo', config: 'vite.config.ts', file: 'src/pages/vue-script-setup/index.vue', isPage: true, expectCompilerBatch: true },
  { id: 'script-import-control', cohort: 'wevu', project: 'apps/wevu-runtime-demo', config: 'vite.config.ts', file: 'src/pages/vue-script-import/index.vue', isPage: true, expectCompilerBatch: false },
  { id: 'kpi-board', cohort: 'tailwind-tdesign', project: 'apps/multi-platform-wevu-tdesign-demo', config: 'vite.config.ts', file: 'src/components/KpiBoard/index.vue', isPage: false, expectCompilerBatch: true },
  { id: 'goods-card', cohort: 'tailwind-tdesign', project: retail, config: 'weapp-vite.config.ts', file: 'src/components/goods-card/index.vue', isPage: false, expectCompilerBatch: true },
  { id: 'goods-list', cohort: 'tailwind-tdesign', project: retail, config: 'weapp-vite.config.ts', file: 'src/components/goods-list/index.vue', isPage: false, expectCompilerBatch: true },
  { id: 'provider', cohort: 'component-registration', project: registration, config: 'vite.config.ts', file: 'src/components/provider/index.vue', isPage: false, expectCompilerBatch: true },
  { id: 'exported-provider', cohort: 'component-registration', project: registration, config: 'vite.config.ts', file: 'src/components/exportedProvider/index.vue', isPage: false, expectCompilerBatch: true },
  { id: 'forwarded-outlet', cohort: 'component-registration', project: registration, config: 'vite.config.ts', file: 'src/components/forwardedOutlet/index.vue', isPage: false, expectCompilerBatch: true },
]
