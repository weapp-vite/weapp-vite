import type { PluginOption, UserConfig } from 'vite'
import type { DashboardTailwindScenario } from './scenarios'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { build } from 'vite'
import {
  createDashboardViteConfig,
  dashboardRoot,
} from '../../packages/dashboard/vite.shared'
import {
  isDashboardTailwindScenario,
} from './scenarios'

interface WorkerResult {
  buildMs: number
  createMs: number
  cssFile: string
  importMs: number
  scenario: DashboardTailwindScenario
}

function readArg(name: string) {
  const index = process.argv.indexOf(name)
  return index === -1 ? undefined : process.argv[index + 1]
}

function requireArg(name: string) {
  const value = readArg(name)
  if (!value) {
    throw new Error(`Missing required argument: ${name}`)
  }
  return value
}

function flattenPlugins(plugins: PluginOption): PluginOption[] {
  if (Array.isArray(plugins)) {
    return plugins.flatMap(flattenPlugins)
  }
  return plugins ? [plugins] : []
}

async function createTailwindPlugins(scenario: DashboardTailwindScenario) {
  const importStartedAt = performance.now()

  if (scenario === 'official') {
    const { default: tailwindcss } = await import('@tailwindcss/vite')
    const importedAt = performance.now()
    const plugins = tailwindcss()
    return {
      createMs: performance.now() - importedAt,
      importMs: importedAt - importStartedAt,
      plugins,
    }
  }

  const { WeappTailwindcss } = await import('weapp-tailwindcss/vite')
  const importedAt = performance.now()
  let plugins: PluginOption

  switch (scenario) {
    case 'weapp-default':
      plugins = WeappTailwindcss()
      break
    case 'weapp-target-web':
      plugins = WeappTailwindcss({
        generator: { target: 'web' },
        logLevel: 'silent',
      })
      break
    case 'weapp-basedir-target-web':
      plugins = WeappTailwindcss({
        generator: { target: 'web' },
        logLevel: 'silent',
        tailwindcssBasedir: dashboardRoot,
      })
      break
    case 'weapp-app-type-target-web':
      plugins = WeappTailwindcss({
        appType: 'native',
        generator: { target: 'web' },
        logLevel: 'silent',
      })
      break
    case 'weapp-full':
    case 'weapp-full-no-source-candidates':
      plugins = WeappTailwindcss({
        appType: 'native',
        cssEntries: [path.resolve(dashboardRoot, 'src/style.css')],
        generator: { target: 'web' },
        logLevel: 'silent',
        tailwindcssBasedir: dashboardRoot,
      })
      break
  }

  const createdAt = performance.now()
  const normalizedPlugins = scenario === 'weapp-full-no-source-candidates'
    ? flattenPlugins(plugins).filter(plugin => plugin && plugin.name !== 'weapp-tailwindcss:adaptor:source-candidates')
    : plugins

  return {
    createMs: createdAt - importedAt,
    importMs: importedAt - importStartedAt,
    plugins: normalizedPlugins,
  }
}

async function findDashboardCss(directory: string): Promise<string> {
  const entries = await readdir(directory, { withFileTypes: true })

  for (const entry of entries) {
    const file = path.resolve(directory, entry.name)
    if (entry.isDirectory()) {
      const nested = await findDashboardCss(file).catch(() => undefined)
      if (nested) {
        return nested
      }
      continue
    }
    if (!entry.name.endsWith('.css')) {
      continue
    }
    const css = await readFile(file, 'utf8')
    if (css.includes('--dashboard-bg')) {
      return file
    }
  }

  throw new Error(`Dashboard CSS asset was not emitted under ${directory}`)
}

async function main() {
  const scenarioValue = requireArg('--scenario')
  if (!isDashboardTailwindScenario(scenarioValue)) {
    throw new Error(`Unknown dashboard Tailwind scenario: ${scenarioValue}`)
  }

  const outDir = path.resolve(requireArg('--out-dir'))
  const resultFile = path.resolve(requireArg('--result-file'))
  const tailwind = await createTailwindPlugins(scenarioValue)
  const config = createDashboardViteConfig(tailwind.plugins) as UserConfig
  const buildStartedAt = performance.now()

  await build({
    ...config,
    build: {
      ...config.build,
      emptyOutDir: true,
      outDir,
    },
    configFile: false,
    logLevel: 'silent',
  })

  const result: WorkerResult = {
    buildMs: performance.now() - buildStartedAt,
    createMs: tailwind.createMs,
    cssFile: await findDashboardCss(outDir),
    importMs: tailwind.importMs,
    scenario: scenarioValue,
  }

  await mkdir(path.dirname(resultFile), { recursive: true })
  await writeFile(resultFile, `${JSON.stringify(result)}\n`, 'utf8')
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
  process.exitCode = 1
})
