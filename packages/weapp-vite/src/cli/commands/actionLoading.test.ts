import { expect, it } from 'vitest'
import { runModuleLoadingProcess } from '../../../test/utils/moduleLoadingProcess'

const commands = [
  { name: 'build', register: 'registerBuildCommand' },
  { name: 'upload', register: 'registerUploadCommand' },
  { name: 'preview', module: 'upload', register: 'registerPreviewCommand' },
  { name: 'ide', register: 'registerIdeCommand' },
  { name: 'mcp', register: 'registerMcpCommand' },
  { name: 'analyze', register: 'registerAnalyzeCommand' },
] as const

interface LoadingResult {
  initial: string[]
  afterHelp: string[]
  afterInvalid: string[]
  help: string
  error: string
  synchronousRegistration: boolean
}

it.each(commands)('keeps $name registration, help and invalid arguments independent of the real action graph', async (command) => {
  const moduleName = 'module' in command ? command.module : command.name
  const moduleUrl = new URL(`./${moduleName}/index.ts`, import.meta.url).href
  const result = await runModuleLoadingProcess<LoadingResult>(`
    const { cac } = await import('cac')
    const implementationModules = () => loadedModules().filter(url =>
      /\\/src\\/cli\\/commands\\/(?:build|upload|ide|mcp|analyze)\\/action\\.ts$/.test(url)
      || url.includes('/src/createContext.ts')
      || url.includes('/src/runtime/compilerSession.ts')
      || url.includes('/src/cli/analyze/dashboard.ts')
      || url.includes('/src/mcp.ts')
      || url.includes('/node_modules/@babel/core/')
      || url.includes('/node_modules/weapp-ide-cli/')
      || url.includes('/packages/weapp-ide-cli/dist/'))
    const command = await import(${JSON.stringify(moduleUrl)})
    const cli = cac('weapp-vite')
    const synchronousRegistration = command[${JSON.stringify(command.register)}](cli) === undefined
    cli.help()
    const initial = implementationModules()
    const helpLines = []
    const originalInfo = console.info
    console.info = (...values) => { helpLines.push(values.join(' ')) }
    try { cli.parse(['node', 'weapp-vite', ${JSON.stringify(command.name)}, '--help']) }
    finally { console.info = originalInfo }
    const afterHelp = implementationModules()
    let error
    cli.parse(['node', 'weapp-vite', ${JSON.stringify(command.name)}, '--unknown-action-flag'], { run: false })
    try { await cli.runMatchedCommand() }
    catch (failure) { error = failure.message }
    process.stdout.write(JSON.stringify({
      initial, afterHelp, afterInvalid: implementationModules(), help: helpLines.join('\\n'),
      error, synchronousRegistration,
    }))
  `)

  expect(result.synchronousRegistration).toBe(true)
  expect(result.help).toContain('Usage:')
  expect(result.help).toContain(command.name)
  expect(result.error).toContain('Unknown option')
  expect(result.initial).toEqual([])
  expect(result.afterHelp).toEqual([])
  expect(result.afterInvalid).toEqual([])
}, 20_000)

it.each(commands)('surfaces an unavailable $name action at dispatch without loading other command graphs', async (command) => {
  const moduleName = 'module' in command ? command.module : command.name
  const moduleUrl = new URL(`./${moduleName}/index.ts`, import.meta.url).href
  const actionUrl = new URL(`./${moduleName}/action.ts`, import.meta.url).href
  const result = await runModuleLoadingProcess<{ rejectedWithOriginal: boolean, attempts: number, loaded: string[] }>(`
    const { cac } = await import('cac')
    const unavailable = new Error('Action module unavailable')
    let attempts = 0
    registerHooks({
      load(url, context, nextLoad) {
        if (url === ${JSON.stringify(actionUrl)}) {
          attempts += 1
          throw unavailable
        }
        return nextLoad(url, context)
      },
    })
    const command = await import(${JSON.stringify(moduleUrl)})
    const cli = cac('weapp-vite')
    command[${JSON.stringify(command.register)}](cli)
    cli.parse(['node', 'weapp-vite', ${JSON.stringify(command.name)}], { run: false })
    let rejectedWithOriginal = false
    try { await cli.runMatchedCommand() }
    catch (error) { rejectedWithOriginal = error === unavailable }
    process.stdout.write(JSON.stringify({
      rejectedWithOriginal, attempts,
      loaded: loadedModules().filter(url => /\\/src\\/cli\\/commands\\/[^/]+\\/action\\.ts$/.test(url)),
    }))
  `)
  expect(result.rejectedWithOriginal).toBe(true)
  expect(result.attempts).toBe(1)
  expect(result.loaded).toEqual([])
}, 20_000)

it('preserves synchronous completion helpers and Web result construction without loading actions', async () => {
  const buildUrl = new URL('./build/index.ts', import.meta.url).href
  const analyzeUrl = new URL('./analyze/index.ts', import.meta.url).href
  const result = await runModuleLoadingProcess<{ shouldExit: boolean, report: { runtime: string, generatedAt: string }, actions: string[] }>(`
    process.env.VITEST = 'true'
    const build = await import(${JSON.stringify(buildUrl)})
    const { createWebAnalyzeResult } = await import(${JSON.stringify(analyzeUrl)})
    const shouldExit = build.shouldScheduleCompletedProductionBuildExit({}, undefined)
    build.scheduleCompletedProductionBuildExit({}, undefined)
    const report = createWebAnalyzeResult({ mode: 'test', relativeCwd: value => value }, {
      platform: 'web', now: new Date('2026-01-01T00:00:00Z'),
    })
    process.stdout.write(JSON.stringify({
      shouldExit, report, actions: loadedModules().filter(url => url.endsWith('/action.ts')),
    }))
  `)
  expect(result.shouldExit).toBe(false)
  expect(result.report).toMatchObject({ runtime: 'web', generatedAt: '2026-01-01T00:00:00.000Z' })
  expect(result.actions).toEqual([])
}, 20_000)
