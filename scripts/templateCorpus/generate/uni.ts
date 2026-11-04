import type { ControlledProject, FrameworkRelease, FrameworkTarget } from './types'
import { uniLegacyConfiguration, uniLegacyDependencies } from './uniLegacy'
import { createFiniteUniLauncher } from './uniLifecycle'

export function createUniProject(release: FrameworkRelease, target: FrameworkTarget): ControlledProject {
  const modern = release.framework === 'uni-vue3'
  const version = release.version
  const platformPackage = target.target.startsWith('quickapp-webview') ? 'uni-quickapp-webview' : `uni-${target.target}`
  const dependencies: Record<string, string> = {
    '@dcloudio/uni-app': version,
    '@dcloudio/uni-cli-shared': version,
    [`@dcloudio/${platformPackage}`]: version,
  }
  const files: Record<string, string> = {}
  if (modern) {
    Object.assign(dependencies, {
      '@dcloudio/vite-plugin-uni': version,
      '@dcloudio/uni-components': version,
      '@vue/compiler-sfc': '3.4.21',
      'vue': '3.4.21',
      'vite': '5.2.8',
      'sass': '1.77.8',
    })
    files['vite.config.mjs'] = `import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'
export default defineConfig({ plugins: [(uni.default || uni)()] })
`
    files['compile.cjs'] = createFiniteUniLauncher()
  }
  else {
    Object.assign(dependencies, uniLegacyDependencies(version))
    Object.assign(files, uniLegacyConfiguration())
    files['compile.cjs'] = `process.env.NODE_ENV = process.argv[2]
process.env.UNI_PLATFORM = process.argv[3]
process.env.UNI_INPUT_DIR = require('path').resolve('src')
process.env.UNI_OUTPUT_DIR = require('path').resolve(process.argv[4])
process.env.UNI_CLI_CONTEXT = process.cwd()
const Service = require('@vue/cli-service')
new Service(process.cwd()).run('uni-build', { platform: process.argv[3], watch: false }).catch(error => {
  console.error(error); process.exitCode = 1
})
`
  }
  return {
    dependencies,
    files,
    command: ['node', 'compile.cjs', '{mode}', target.target, '{output}'],
    environment: modern ? {} : { NODE_OPTIONS: '--openssl-legacy-provider' },
  }
}
