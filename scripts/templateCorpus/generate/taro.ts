import type { ControlledProject, FrameworkRelease, FrameworkTarget } from './types'
import { taroHarmonyConfig, taroHarmonyHostFiles, taroHarmonyPrepareHost, taroHarmonyVerifyHost } from './taroHarmony'
import { taroLegacyBabel, taroLegacyDependencies, taroQuickappCompile, taroQuickappWebpack } from './taroLegacy'

export function createTaroProject(release: FrameworkRelease, target: FrameworkTarget): ControlledProject {
  const version = release.version
  const legacy = version.startsWith('2.')
  const buildTarget = target.target === 'harmony-jsui' ? 'harmony' : target.target
  const platformPlugin = `@tarojs/plugin-platform-${target.target === 'harmony-jsui' ? 'harmony-ets' : target.target}`
  const dependencies: Record<string, string> = {
    '@tarojs/cli': version,
    '@tarojs/taro': version,
    '@tarojs/components': version,
  }
  if (legacy) {
    Object.assign(dependencies, taroLegacyDependencies(version, target.target))
  }
  else {
    Object.assign(dependencies, {
      '@babel/core': '7.24.4',
      '@babel/preset-react': '7.24.1',
      'babel-preset-taro': version,
      '@tarojs/shared': version,
      '@tarojs/helper': version,
      '@tarojs/react': version,
      '@tarojs/runtime': version,
      '@tarojs/plugin-framework-react': version,
      '@tarojs/plugin-platform-weapp': version,
      [platformPlugin]: version,
      '@tarojs/webpack5-runner': version,
      'react': '18.3.1',
      'react-dom': '18.3.1',
      'react-refresh': '0.14.0',
      'webpack': '5.102.1',
    })
  }
  return {
    dependencies,
    environment: legacy ? { NODE_OPTIONS: '--openssl-legacy-provider' } : {},
    command: ['node', 'compile.cjs', '{mode}', buildTarget, '{output}'],
    files: {
      ...(target.target === 'harmony-jsui' ? taroHarmonyHostFiles : {}),
      ...(legacy ? {} : { 'babel.config.js': `module.exports = { presets: [['taro', { framework: 'react', ts: true }]] }\n` }),
      'config/index.js': `module.exports = ${legacy ? '() => (' : ''}{
  projectName: 'template-corpus',
  date: '2026-11-04',
  designWidth: 750,
  deviceRatio: { 750: 1 },
  sourceRoot: 'src',
  outputRoot: process.env.CORPUS_OUTPUT,
  framework: 'react',
  ${target.target === 'harmony-jsui' ? taroHarmonyConfig : ''}
  ${legacy ? taroLegacyBabel : 'compiler: \'webpack5\','}
  plugins: ${JSON.stringify(legacy ? ['@tarojs/plugin-terser'] : ['@tarojs/plugin-framework-react', target.target === 'harmony-jsui' ? [platformPlugin, { disableArkTS: true }] : platformPlugin])},
  mini: { ${legacy && target.target === 'quickapp' ? `${taroQuickappWebpack}\n    ` : ''}postcss: { pxtransform: { enable: false }, cssModules: { enable: false } } },
}${legacy ? ')' : ''}
`,
      'compile.cjs': legacy && target.target === 'quickapp'
        ? taroQuickappCompile
        : `process.env.NODE_ENV = process.argv[2]
process.env.TARO_ENV = process.argv[3]
process.env.CORPUS_OUTPUT = process.argv[4]
const { spawnSync } = require('child_process')
const path = require('path')
${target.target === 'harmony-jsui' ? taroHarmonyPrepareHost : ''}
const entry = path.join(path.dirname(require.resolve('@tarojs/cli/package.json')), 'bin/taro')
const result = spawnSync(process.execPath, [entry, 'build', '--type', process.argv[3]], {
  stdio: 'inherit', env: process.env,
})
if (result.error) throw result.error
${target.target === 'harmony-jsui' ? taroHarmonyVerifyHost : ''}
process.exitCode = result.status === null ? 1 : result.status
`,
    },
  }
}
