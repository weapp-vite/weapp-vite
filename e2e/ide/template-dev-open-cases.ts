import path from 'node:path'

const WORKSPACE_ROOT = path.resolve(import.meta.dirname, '../..')

export interface TemplateDevOpenCase {
  assertWrapperProject?: boolean
  expectedData?: Record<string, unknown>
  expectedText: string
  name: string
  platform?: string
  projectRoot?: string
  route: string
  root: string
}

export const TEMPLATE_DEV_OPEN_CASES: TemplateDevOpenCase[] = [
  {
    name: 'weapp-vite-plugin-template',
    root: path.resolve(WORKSPACE_ROOT, 'templates/weapp-vite-plugin-template'),
    route: '/pages/index/index',
    expectedText: '插件能力混合演示',
    assertWrapperProject: true,
    expectedData: {
      pluginAnswer: 42,
    },
  },
  {
    name: 'weapp-vite-template',
    root: path.resolve(WORKSPACE_ROOT, 'templates/weapp-vite-template'),
    route: '/pages/index/index',
    expectedText: 'Hello weapp-vite',
  },
  {
    name: 'weapp-vite-multi-platform-template',
    root: path.resolve(WORKSPACE_ROOT, 'templates/weapp-vite-multi-platform-template'),
    projectRoot: 'dist/weapp',
    platform: 'weapp',
    route: '/pages/index/index',
    expectedText: '原生多平台 + Web',
    expectedData: {
      platform: 'weapp',
      status: 'ready',
    },
  },
  {
    name: 'weapp-vite-multi-platform-sfc-template',
    root: path.resolve(WORKSPACE_ROOT, 'templates/weapp-vite-multi-platform-sfc-template'),
    projectRoot: 'dist/weapp',
    platform: 'weapp',
    route: '/pages/index/index',
    expectedText: 'Vue SFC 多平台 + Web',
    expectedData: {
      count: 0,
      doubled: 0,
      platform: 'weapp',
      status: 'ready',
    },
  },
  {
    name: 'weapp-vite-lib-template',
    root: path.resolve(WORKSPACE_ROOT, 'templates/weapp-vite-lib-template'),
    route: '/pages/index/index',
    expectedText: 'Hello weapp-vite lib',
  },
  {
    name: 'weapp-vite-tailwindcss-template',
    root: path.resolve(WORKSPACE_ROOT, 'templates/weapp-vite-tailwindcss-template'),
    route: '/pages/index/index',
    expectedText: 'Hello weapp-vite',
  },
  {
    name: 'weapp-vite-tailwindcss-tdesign-template',
    root: path.resolve(WORKSPACE_ROOT, 'templates/weapp-vite-tailwindcss-tdesign-template'),
    route: '/pages/index/index',
    expectedText: 'Hello weapp-vite + TDesign',
  },
  {
    name: 'weapp-vite-tailwindcss-vant-template',
    root: path.resolve(WORKSPACE_ROOT, 'templates/weapp-vite-tailwindcss-vant-template'),
    route: '/pages/index/index',
    expectedText: 'Hello weapp-vite + Vant',
  },
  {
    name: 'weapp-vite-wevu-template',
    root: path.resolve(WORKSPACE_ROOT, 'templates/weapp-vite-wevu-template'),
    route: '/pages/index/index',
    expectedText: 'Weapp-vite + Wevu',
    expectedData: {
      count: 0,
      doubled: 0,
    },
  },
  {
    name: 'weapp-vite-wevu-tailwindcss-tdesign-template',
    root: path.resolve(WORKSPACE_ROOT, 'templates/weapp-vite-wevu-tailwindcss-tdesign-template'),
    route: '/pages/index/index',
    expectedText: 'TDesign 最小模板',
    expectedData: {
      count: 0,
    },
  },
  {
    name: 'weapp-vite-wevu-tailwindcss-tdesign-retail-template',
    root: path.resolve(WORKSPACE_ROOT, 'templates/weapp-vite-wevu-tailwindcss-tdesign-retail-template'),
    route: '/pages/home/home',
    expectedText: '精选推荐',
  },
]

export function createTemplateDevOpenArgs(templateCase: TemplateDevOpenCase) {
  const commandArgs = ['exec', 'wv', 'dev']
  if (templateCase.platform) {
    commandArgs.push('-p', templateCase.platform)
  }
  if (!templateCase.assertWrapperProject) {
    commandArgs.push('--ide-open-strategy', 'automator')
  }
  commandArgs.push('-o', '--non-interactive', '--login-retry', 'never')
  return commandArgs
}

export function resolveTemplateDevOpenProjectRoot(templateCase: TemplateDevOpenCase) {
  return path.resolve(templateCase.root, templateCase.projectRoot ?? '.')
}
