/* eslint-disable e18e/ban-dependencies -- e2e 测试需要 execa 驱动 CLI，并使用 shared fs 简化产物与 fixture 读写。 */
import { proxyCreateProgram } from '@volar/typescript'
import { createVueLanguagePlugin, getDefaultCompilerOptions } from '@vue/language-core'
import { fs } from '@weapp-core/shared/node'
import { execa } from 'execa'
import path from 'pathe'
import ts from 'typescript'
import { startDevProcess } from '../utils/dev-process'
import { cleanupResidualDevProcesses } from '../utils/dev-process-cleanup'
import { createDevProcessEnv } from '../utils/dev-process-env'
import { replaceFileByRename } from '../utils/hmr-helpers'
import { resolvePlatformMatrix } from '../utils/platform-matrix'

const CLI_PATH = path.resolve(
  import.meta.dirname,
  '../../packages/weapp-vite/src/cli.ts',
)
const APP_ROOT = path.resolve(
  import.meta.dirname,
  '../../e2e-apps/auto-import-vue-sfc',
)
const DIST_ROOT = path.join(APP_ROOT, 'dist')
const TYPED_COMPONENTS_DTS = path.join(DIST_ROOT, 'typed-components.d.ts')
const VUE_COMPONENTS_DTS = path.join(DIST_ROOT, 'components.d.ts')
const PAGE_SOURCE_PATH = path.join(APP_ROOT, 'src/pages/index/index.vue')
const HOT_COMPONENT_DIR = path.join(APP_ROOT, 'src/components/HotCard')
const HOT_COMPONENT_SOURCE_PATH = path.join(HOT_COMPONENT_DIR, 'index.vue')
const HOT_COMPONENT_TIMEOUT_MS = process.platform === 'darwin'
  ? 240_000
  : process.platform === 'win32'
    ? 120_000
    : 60_000
const SUPPORTED_PLATFORMS = [
  'weapp',
  // 'alipay',
  // 'tt',
] as const
const PLATFORM_TEMPLATE_EXT: Record<RuntimePlatform, string> = {
  weapp: 'wxml',
  alipay: 'axml',
  tt: 'ttml',
}

type RuntimePlatform = (typeof SUPPORTED_PLATFORMS)[number]

const SELECTED_PLATFORM = process.env.E2E_PLATFORM
const SHOULD_SKIP_UNSUPPORTED_PLATFORM = Boolean(
  SELECTED_PLATFORM
  && !SUPPORTED_PLATFORMS.includes(SELECTED_PLATFORM as RuntimePlatform),
)

function resolvePlatforms() {
  if (SHOULD_SKIP_UNSUPPORTED_PLATFORM) {
    return []
  }
  return resolvePlatformMatrix(SUPPORTED_PLATFORMS, {
    localDefault: 'weapp',
  })
}

const PLATFORM_LIST = resolvePlatforms()
const describeAutoImportSuite = SHOULD_SKIP_UNSUPPORTED_PLATFORM
  ? describe.skip
  : describe

beforeEach(async () => {
  await cleanupResidualDevProcesses()
})

afterEach(async () => {
  await cleanupResidualDevProcesses()
})

function resolveVueComponentKey(name: string) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase()
}

function resolveNativeComponentKey(platform: RuntimePlatform, name: string) {
  if (platform !== 'alipay') {
    return name
  }
  return resolveVueComponentKey(name)
}

async function runBuild(root: string, platform: RuntimePlatform) {
  await execa(
    'node',
    [
      '--import',
      'tsx',
      CLI_PATH,
      'build',
      root,
      '--platform',
      platform,
      '--skipNpm',
    ],
    {
      stdio: 'inherit',
    },
  )
}

async function waitForFileContains(
  filePath: string,
  markers: string[],
  timeoutMs = 90_000,
) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await fs.pathExists(filePath)) {
      const content = await fs.readFile(filePath, 'utf8')
      if (markers.every(marker => content.includes(marker))) {
        return content
      }
    }
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error(
    `Timed out waiting for ${filePath} to contain expected markers.`,
  )
}

async function waitForFileRead(filePath: string, timeoutMs = 30_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      return await fs.readFile(filePath, 'utf8')
    }
    catch {
      await new Promise(resolve => setTimeout(resolve, 250))
    }
  }
  return await fs.readFile(filePath, 'utf8')
}

async function waitForUsingComponent(
  pageJsonPath: string,
  name: string,
  value: string,
  timeoutMs = 90_000,
) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await fs.pathExists(pageJsonPath)) {
      const pageJson = await fs.readJson(pageJsonPath)
      if (pageJson?.usingComponents?.[name] === value) {
        return pageJson
      }
    }
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error(
    `Timed out waiting for usingComponents.${name} in ${pageJsonPath}`,
  )
}

async function waitForMissingUsingComponent(
  pageJsonPath: string,
  name: string,
  timeoutMs = 90_000,
) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await fs.pathExists(pageJsonPath)) {
      const pageJson = await fs.readJson(pageJsonPath)
      if (!pageJson?.usingComponents || !(name in pageJson.usingComponents)) {
        return pageJson
      }
    }
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error(
    `Timed out waiting for usingComponents.${name} to be removed in ${pageJsonPath}`,
  )
}

function detectEol(source: string) {
  return source.includes('\r\n') ? '\r\n' : '\n'
}

function insertVueTemplateHeartbeat(source: string, marker: string, eol: string) {
  const templateCloseIndex = source.lastIndexOf('</template>')
  if (templateCloseIndex < 0) {
    return `${source}${eol}<!-- ${marker} -->${eol}`
  }

  return `${source.slice(0, templateCloseIndex)}${eol}<view style="display: none;">${marker}</view>${eol}${source.slice(templateCloseIndex)}`
}

async function rewriteVueSourceForWatch(
  sourcePath: string,
  targetSource: string,
) {
  const eol = detectEol(targetSource)
  const marker = `auto-import-e2e-retry-${Date.now()}`
  await replaceFileByRename(
    sourcePath,
    insertVueTemplateHeartbeat(targetSource, marker, eol),
  )
  await new Promise(resolve => setTimeout(resolve, 120))
  await replaceFileByRename(sourcePath, targetSource)
}

async function waitForTaskWithSourceHeartbeat<T>(
  task: () => Promise<T>,
  touchFilePath: string,
  touchContent: string,
  timeoutMs = 60_000,
  heartbeatMs = 2_000,
) {
  const deadline = Date.now() + timeoutMs
  let nextTouchAt = Date.now() + heartbeatMs

  while (Date.now() < deadline) {
    try {
      return await task()
    }
    catch {
      if (Date.now() >= nextTouchAt) {
        await rewriteVueSourceForWatch(touchFilePath, touchContent)
        nextTouchAt = Date.now() + heartbeatMs
      }
      await new Promise(resolve => setTimeout(resolve, 250))
    }
  }

  return await task()
}

async function waitForTaskWithSourceHeartbeats<T>(
  task: () => Promise<T>,
  heartbeatInputs: Array<{
    touchContent: string
    touchFilePath: string
  }>,
  timeoutMs = 60_000,
  heartbeatMs = 2_000,
) {
  const deadline = Date.now() + timeoutMs
  let nextTouchAt = Date.now() + heartbeatMs

  while (Date.now() < deadline) {
    try {
      return await task()
    }
    catch {
      if (Date.now() >= nextTouchAt) {
        for (const heartbeatInput of heartbeatInputs) {
          await rewriteVueSourceForWatch(
            heartbeatInput.touchFilePath,
            heartbeatInput.touchContent,
          )
        }
        nextTouchAt = Date.now() + heartbeatMs
      }
      await new Promise(resolve => setTimeout(resolve, 250))
    }
  }

  return await task()
}

function createHotCardSfc() {
  return `<template>
  <view class="hot-card-e2e">
    hot-card-e2e
  </view>
</template>
`
}

function toCrlf(source: string) {
  return source.replace(/\r?\n/g, '\r\n')
}

function removeStandaloneTagLine(source: string, tagName: string) {
  const tagPattern = new RegExp(`^[ \\t]*<${tagName}\\s*\\/>\\r?\\n?`, 'm')
  return source.replace(tagPattern, '')
}

function insertStandaloneTagAfter(
  source: string,
  anchorTagName: string,
  tagName: string,
) {
  const eol = detectEol(source)
  const anchorPattern = new RegExp(
    `^([ \\t]*)<${anchorTagName}\\s*\\/>\\r?$`,
    'm',
  )
  return source.replace(
    anchorPattern,
    (_line, indent: string) =>
      `${indent}<${anchorTagName} />${eol}${indent}<${tagName} />`,
  )
}

const HMR_EMIT_RE = /hmr emit dirty=(\d+) resolved=(\d+) emitAll=(true|false) pending=(\d+)/
const TARGETED_HMR_EMIT_RE = /hmr emit dirty=(\d+) resolved=(\d+) emitAll=false pending=(\d+)/

async function waitForOutputSince(
  dev: { getOutput: () => string },
  startOffset: number,
  matcher: RegExp,
  timeoutMs = 30_000,
) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const nextOutput = dev.getOutput().slice(startOffset)
    if (matcher.test(nextOutput)) {
      return nextOutput
    }
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error(`Timed out waiting for dev output since offset to match: ${matcher}`)
}

function expectHmrEmit(output: string) {
  const matches = [...output.matchAll(new RegExp(HMR_EMIT_RE, 'g'))]
  const match = matches.at(-1)
  expect(match).toBeDefined()
  const [, dirtyCount, resolvedCount, emitAll, pendingCount] = match!
  expect(Number(dirtyCount)).toBeGreaterThan(0)
  expect(Number(resolvedCount)).toBeGreaterThan(0)
  expect(Number(pendingCount)).toBeGreaterThan(0)
  if (emitAll === 'false') {
    expect(Number(pendingCount)).toBeLessThan(Number(resolvedCount))
    return
  }
  expect(Number(pendingCount)).toBeGreaterThanOrEqual(Number(resolvedCount))
}

function expectTargetedHmrEmit(output: string) {
  const matches = [...output.matchAll(new RegExp(TARGETED_HMR_EMIT_RE, 'g'))]
  const match = matches.at(-1)
  expect(match).toBeDefined()
  const [, dirtyCount, resolvedCount, pendingCount] = match!
  expect(Number(dirtyCount)).toBeGreaterThan(0)
  expect(Number(pendingCount)).toBeGreaterThan(0)
  expect(Number(pendingCount)).toBeLessThan(Number(resolvedCount))
}

describeAutoImportSuite('auto import local components (e2e)', { concurrent: false }, () => {
  it.each(PLATFORM_LIST)(
    'covers local/resolver auto-import for %s build output',
    async (platform) => {
      await fs.remove(DIST_ROOT)
      await fs.remove(TYPED_COMPONENTS_DTS)
      await fs.remove(VUE_COMPONENTS_DTS)

      await runBuild(APP_ROOT, platform)

      const vuePageJsonPath = path.join(DIST_ROOT, 'pages/index/index.json')
      const nativePageJsonPath = path.join(
        DIST_ROOT,
        'pages/native/index.json',
      )

      const sfcComponentJsonPath = path.join(
        DIST_ROOT,
        'components/AutoCard/index.json',
      )
      const sfcComponentTemplatePath = path.join(
        DIST_ROOT,
        `components/AutoCard/index.${PLATFORM_TEMPLATE_EXT[platform]}`,
      )
      const nativeComponentJsonPath = path.join(
        DIST_ROOT,
        'components/NativeCard/index.json',
      )
      const nativeComponentTemplatePath = path.join(
        DIST_ROOT,
        `components/NativeCard/index.${PLATFORM_TEMPLATE_EXT[platform]}`,
      )

      expect(await fs.pathExists(vuePageJsonPath)).toBe(true)
      expect(await fs.pathExists(nativePageJsonPath)).toBe(true)
      expect(await fs.pathExists(sfcComponentJsonPath)).toBe(true)
      expect(await fs.pathExists(sfcComponentTemplatePath)).toBe(true)
      expect(await fs.pathExists(nativeComponentJsonPath)).toBe(true)
      expect(await fs.pathExists(nativeComponentTemplatePath)).toBe(true)

      const autoCardKey = resolveVueComponentKey('AutoCard')
      const nativeCardKey = resolveVueComponentKey('NativeCard')
      const resolverCardKey = resolveVueComponentKey('ResolverCard')

      const vuePageJson = await fs.readJson(vuePageJsonPath)
      expect(vuePageJson.usingComponents).toMatchObject({
        [autoCardKey]: '/components/AutoCard/index',
        [nativeCardKey]: '/components/NativeCard/index',
        [resolverCardKey]: '/components/NativeCard/index',
      })

      const nativePageJson = await fs.readJson(nativePageJsonPath)
      if (platform !== 'alipay') {
        expect(nativePageJson.usingComponents).toMatchObject({
          [resolveNativeComponentKey(platform, 'NativeCard')]: '/components/NativeCard/index',
          [resolveNativeComponentKey(platform, 'ResolverCard')]: '/components/NativeCard/index',
        })
      }
      else {
        expect(nativePageJson.usingComponents ?? {}).toEqual({})
      }

      const sfcComponentJson = await fs.readJson(sfcComponentJsonPath)
      expect(sfcComponentJson).toMatchObject({
        component: true,
      })
      expect(sfcComponentJson.options).toMatchObject({
        virtualHost: true,
        multipleSlots: true,
      })
      expect(sfcComponentJson.styleIsolation).toBe('apply-shared')

      const nativeComponentJson = await fs.readJson(nativeComponentJsonPath)
      expect(nativeComponentJson).toMatchObject({
        component: true,
        styleIsolation: 'apply-shared',
      })
    },
  )

  it('emits dts for editor intellisense', async () => {
    await fs.remove(DIST_ROOT)
    await fs.remove(TYPED_COMPONENTS_DTS)
    await fs.remove(VUE_COMPONENTS_DTS)

    await runBuild(APP_ROOT, PLATFORM_LIST[0])

    await waitForFileRead(TYPED_COMPONENTS_DTS)
    await waitForFileRead(VUE_COMPONENTS_DTS)

    const consumerPath = path.join(APP_ROOT, 'auto-import-consumer.tsx')
    const consumer = [
      'const source = <AutoCard title="ok" score={42} mode={1} hidden onTap={() => {}} />',
      'const native = <NativeCard title="ok" level="high" visible meta={{}} items={[]} />',
      'const resolver = <ResolverCard hidden onTap={() => {}} />',
      '// @ts-expect-error 源 SFC 的 prop 类型必须保留。',
      'const invalidSource = <AutoCard title={123} />',
      '// @ts-expect-error 原生组件仍须校验 metadata prop 类型。',
      'const invalidNative = <NativeCard level={{}} />',
      '// @ts-expect-error 未声明的组件不能被宽泛索引签名接受。',
      'const invalidComponent = <MissingCard />',
      'export {}',
    ].join('\n')
    const options: ts.CompilerOptions = {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      jsx: ts.JsxEmit.ReactJSX,
      moduleDetection: ts.ModuleDetectionKind.Force,
      jsxImportSource: 'wevu/weapp',
      strict: true,
      skipLibCheck: false,
      noEmit: true,
      allowNonTsExtensions: true,
      types: [],
    }
    const host = ts.createCompilerHost(options)
    const readFile = host.readFile.bind(host)
    const fileExists = host.fileExists.bind(host)
    host.readFile = fileName => path.normalize(fileName) === consumerPath ? consumer : readFile(fileName)
    host.fileExists = fileName => path.normalize(fileName) === consumerPath || fileExists(fileName)
    host.getSourceFile = (fileName, languageVersion) => {
      const source = host.readFile(fileName)
      return source === undefined ? undefined : ts.createSourceFile(fileName, source, languageVersion)
    }
    const createProgram = proxyCreateProgram(ts, ts.createProgram, (tsInstance, programOptions) => ({
      languagePlugins: [createVueLanguagePlugin<string>(
        tsInstance,
        programOptions.options,
        { ...getDefaultCompilerOptions(), lib: 'vue', checkUnknownComponents: true },
        id => id,
      )],
    }))
    const rootNames = [consumerPath, TYPED_COMPONENTS_DTS, VUE_COMPONENTS_DTS]
    const program = createProgram({ host, rootNames, options })
    const diagnostics = rootNames.flatMap(fileName => ts.getPreEmitDiagnostics(program, program.getSourceFile(fileName)))
    expect(diagnostics.map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))).toEqual([])
  })

  it.each(PLATFORM_LIST)(
    'updates usingComponents when SFC usage changes in dev (%s)',
    async (platform) => {
      await fs.remove(DIST_ROOT)
      await fs.remove(TYPED_COMPONENTS_DTS)
      await fs.remove(VUE_COMPONENTS_DTS)

      const originalPageSource = await fs.readFile(PAGE_SOURCE_PATH, 'utf8')
      const pageSourceWithoutAutoCard = removeStandaloneTagLine(
        originalPageSource,
        'AutoCard',
      )
      const pageSourceWithAutoCard = /<AutoCard\s*\/>/.test(
        pageSourceWithoutAutoCard,
      )
        ? pageSourceWithoutAutoCard
        : insertStandaloneTagAfter(
            pageSourceWithoutAutoCard,
            'ResolverCard',
            'AutoCard',
          )

      if (
        pageSourceWithoutAutoCard === originalPageSource
        || pageSourceWithAutoCard === pageSourceWithoutAutoCard
      ) {
        throw new Error(
          'Failed to create page source variants for AutoCard toggling.',
        )
      }

      const devProcess = startDevProcess(
        'node',
        [
          '--import',
          'tsx',
          CLI_PATH,
          'dev',
          APP_ROOT,
          '--platform',
          platform,
          '--skipNpm',
        ],
        {
          env: {
            ...createDevProcessEnv(),
            DEBUG: 'weapp-vite:load-entry',
          },
          all: true,
        },
      )

      try {
        const pageJsonPath = path.join(DIST_ROOT, 'pages/index/index.json')
        const autoCardKey = resolveVueComponentKey('AutoCard')
        await devProcess.waitFor(
          waitForFileContains(pageJsonPath, ['"usingComponents"']),
          `${platform} initial usingComponents`,
        )
        await devProcess.waitFor(
          waitForUsingComponent(
            pageJsonPath,
            autoCardKey,
            '/components/AutoCard/index',
          ),
          `${platform} autoCard initial registration`,
        )

        const outputLengthBeforeRemoval = devProcess.getOutput().length
        await fs.writeFile(PAGE_SOURCE_PATH, pageSourceWithoutAutoCard, 'utf8')
        await devProcess.waitFor(
          waitForTaskWithSourceHeartbeat(
            () => waitForMissingUsingComponent(pageJsonPath, autoCardKey, 1_000),
            PAGE_SOURCE_PATH,
            pageSourceWithoutAutoCard,
          ),
          `${platform} autoCard removal`,
        )
        const removalOutput = await devProcess.waitFor(
          waitForOutputSince(devProcess, outputLengthBeforeRemoval, TARGETED_HMR_EMIT_RE),
          `${platform} autoCard removal targeted hmr log`,
        )
        expectTargetedHmrEmit(removalOutput)

        const outputLengthBeforeRestore = devProcess.getOutput().length
        await fs.writeFile(PAGE_SOURCE_PATH, pageSourceWithAutoCard, 'utf8')
        await devProcess.waitFor(
          waitForTaskWithSourceHeartbeat(
            () =>
              waitForUsingComponent(
                pageJsonPath,
                autoCardKey,
                '/components/AutoCard/index',
                1_000,
              ),
            PAGE_SOURCE_PATH,
            pageSourceWithAutoCard,
          ),
          `${platform} autoCard re-registration`,
        )

        const autoCardTemplatePath = path.join(
          DIST_ROOT,
          `components/AutoCard/index.${PLATFORM_TEMPLATE_EXT[platform]}`,
        )
        expect(await fs.pathExists(autoCardTemplatePath)).toBe(true)
        const restoreOutput = await devProcess.waitFor(
          waitForOutputSince(devProcess, outputLengthBeforeRestore, HMR_EMIT_RE),
          `${platform} autoCard restore hmr log`,
        )
        expectHmrEmit(restoreOutput)
      }
      finally {
        await devProcess.stop(3_000)

        await fs.writeFile(PAGE_SOURCE_PATH, originalPageSource, 'utf8')
      }
    },
  )

  it.each(PLATFORM_LIST)(
    'updates usingComponents when page source is CRLF in dev (%s)',
    async (platform) => {
      await fs.remove(DIST_ROOT)
      await fs.remove(TYPED_COMPONENTS_DTS)
      await fs.remove(VUE_COMPONENTS_DTS)

      const originalPageSource = await fs.readFile(PAGE_SOURCE_PATH, 'utf8')
      const pageSourceCrlf = toCrlf(originalPageSource)
      const pageSourceWithoutAutoCard = removeStandaloneTagLine(
        pageSourceCrlf,
        'AutoCard',
      )
      const pageSourceWithAutoCard = /<AutoCard\s*\/>/.test(
        pageSourceWithoutAutoCard,
      )
        ? pageSourceWithoutAutoCard
        : insertStandaloneTagAfter(
            pageSourceWithoutAutoCard,
            'ResolverCard',
            'AutoCard',
          )

      if (
        pageSourceWithoutAutoCard === pageSourceCrlf
        || pageSourceWithAutoCard === pageSourceWithoutAutoCard
      ) {
        throw new Error(
          'Failed to create CRLF page source variants for AutoCard toggling.',
        )
      }

      await fs.writeFile(PAGE_SOURCE_PATH, pageSourceCrlf, 'utf8')

      const devProcess = startDevProcess(
        'node',
        [
          '--import',
          'tsx',
          CLI_PATH,
          'dev',
          APP_ROOT,
          '--platform',
          platform,
          '--skipNpm',
        ],
        {
          env: {
            ...createDevProcessEnv(),
            DEBUG: 'weapp-vite:load-entry',
          },
          all: true,
        },
      )

      try {
        const pageJsonPath = path.join(DIST_ROOT, 'pages/index/index.json')
        const autoCardKey = resolveVueComponentKey('AutoCard')
        await devProcess.waitFor(
          waitForFileContains(pageJsonPath, ['"usingComponents"']),
          `${platform} crlf initial usingComponents`,
        )
        await devProcess.waitFor(
          waitForUsingComponent(
            pageJsonPath,
            autoCardKey,
            '/components/AutoCard/index',
          ),
          `${platform} crlf autoCard initial registration`,
        )

        const outputLengthBeforeRemoval = devProcess.getOutput().length
        await fs.writeFile(PAGE_SOURCE_PATH, pageSourceWithoutAutoCard, 'utf8')
        await devProcess.waitFor(
          waitForTaskWithSourceHeartbeat(
            () => waitForMissingUsingComponent(pageJsonPath, autoCardKey, 1_000),
            PAGE_SOURCE_PATH,
            pageSourceWithoutAutoCard,
          ),
          `${platform} crlf autoCard removal`,
        )
        const removalOutput = await devProcess.waitFor(
          waitForOutputSince(
            devProcess,
            outputLengthBeforeRemoval,
            process.platform === 'win32' ? HMR_EMIT_RE : TARGETED_HMR_EMIT_RE,
          ),
          `${platform} crlf autoCard removal hmr log`,
        )
        if (process.platform === 'win32') {
          expectHmrEmit(removalOutput)
        }
        else {
          expectTargetedHmrEmit(removalOutput)
        }

        const outputLengthBeforeRestore = devProcess.getOutput().length
        await fs.writeFile(PAGE_SOURCE_PATH, pageSourceWithAutoCard, 'utf8')
        await devProcess.waitFor(
          waitForTaskWithSourceHeartbeat(
            () =>
              waitForUsingComponent(
                pageJsonPath,
                autoCardKey,
                '/components/AutoCard/index',
                1_000,
              ),
            PAGE_SOURCE_PATH,
            pageSourceWithAutoCard,
          ),
          `${platform} crlf autoCard re-registration`,
        )
        const restoreOutput = await devProcess.waitFor(
          waitForOutputSince(devProcess, outputLengthBeforeRestore, HMR_EMIT_RE),
          `${platform} crlf autoCard restore hmr log`,
        )
        expectHmrEmit(restoreOutput)
      }
      finally {
        await devProcess.stop(3_000)
        await fs.writeFile(PAGE_SOURCE_PATH, originalPageSource, 'utf8')
      }
    },
  )

  it.each(PLATFORM_LIST)(
    'auto imports newly created SFC in dev (%s)',
    async (platform) => {
      await fs.remove(DIST_ROOT)
      await fs.remove(TYPED_COMPONENTS_DTS)
      await fs.remove(VUE_COMPONENTS_DTS)
      await fs.remove(HOT_COMPONENT_DIR)
      await fs.ensureDir(HOT_COMPONENT_DIR)

      const originalPageSource = await fs.readFile(PAGE_SOURCE_PATH, 'utf8')
      const pageSourceWithHotCard = /<HotCard\s*\/>/.test(originalPageSource)
        ? originalPageSource
        : insertStandaloneTagAfter(
            originalPageSource,
            'ResolverCard',
            'HotCard',
          )

      if (pageSourceWithHotCard === originalPageSource) {
        throw new Error('Failed to inject <HotCard /> into page source.')
      }

      const devProcess = startDevProcess(
        'node',
        [
          '--import',
          'tsx',
          CLI_PATH,
          'dev',
          APP_ROOT,
          '--platform',
          platform,
          '--skipNpm',
        ],
        {
          env: createDevProcessEnv(),
          stdio: 'inherit',
        },
      )

      try {
        const pageJsonPath = path.join(DIST_ROOT, 'pages/index/index.json')
        const hotCardKey = resolveVueComponentKey('HotCard')
        await devProcess.waitFor(
          waitForFileContains(pageJsonPath, ['"usingComponents"']),
          `${platform} initial usingComponents`,
        )
        await devProcess.waitFor(
          waitForMissingUsingComponent(pageJsonPath, hotCardKey),
          `${platform} hotCard absence`,
        )

        const hotCardSource = createHotCardSfc()
        await fs.ensureDir(HOT_COMPONENT_DIR)
        await replaceFileByRename(HOT_COMPONENT_SOURCE_PATH, hotCardSource)
        await replaceFileByRename(PAGE_SOURCE_PATH, pageSourceWithHotCard)

        await devProcess.waitFor(
          waitForTaskWithSourceHeartbeats(
            () =>
              waitForUsingComponent(
                pageJsonPath,
                hotCardKey,
                '/components/HotCard/index',
                1_000,
              ),
            [
              {
                touchFilePath: HOT_COMPONENT_SOURCE_PATH,
                touchContent: hotCardSource,
              },
              {
                touchFilePath: PAGE_SOURCE_PATH,
                touchContent: pageSourceWithHotCard,
              },
            ],
            HOT_COMPONENT_TIMEOUT_MS,
          ),
          `${platform} hotCard registration`,
        )

        const hotCardJsonPath = path.join(
          DIST_ROOT,
          'components/HotCard/index.json',
        )
        const hotCardTemplatePath = path.join(
          DIST_ROOT,
          `components/HotCard/index.${PLATFORM_TEMPLATE_EXT[platform]}`,
        )

        await devProcess.waitFor(
          waitForTaskWithSourceHeartbeats(
            () =>
              waitForFileContains(hotCardTemplatePath, ['hot-card-e2e'], 1_000),
            [
              {
                touchFilePath: HOT_COMPONENT_SOURCE_PATH,
                touchContent: hotCardSource,
              },
              {
                touchFilePath: PAGE_SOURCE_PATH,
                touchContent: pageSourceWithHotCard,
              },
            ],
            HOT_COMPONENT_TIMEOUT_MS,
          ),
          `${platform} hotCard template output`,
        )
        const hotCardTemplate = await devProcess.waitFor(
          waitForFileContains(hotCardTemplatePath, ['hot-card-e2e']),
          `${platform} hotCard template output verification`,
        )
        expect(await fs.pathExists(hotCardJsonPath)).toBe(true)
        expect(hotCardTemplate).toContain('hot-card-e2e')
      }
      finally {
        await devProcess.stop(3_000)

        await fs.writeFile(PAGE_SOURCE_PATH, originalPageSource, 'utf8')
        await fs.remove(HOT_COMPONENT_DIR)
      }
    },
  )
})
