import type { LoadConfigOptions } from '../config/types'
import { access, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'pathe'
import { afterEach, expect, it } from 'vitest'
import { HmrRuntimeCapabilityError } from '../hmrRuntimeCapabilities'
import { buildStatefulHmrSnapshot, prepareStatefulHmrSnapshot } from './snapshotBuild'

const roots: string[] = []

async function fixture(tsconfig: object, lang: 'ts' | 'tsx' | 'jsx' = 'ts') {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'snapshot-startup-')))
  roots.push(root)
  for (const [file, content] of Object.entries({
    'package.json': '{"name":"snapshot-startup-fixture","type":"module"}',
    'project.config.json': '{"miniprogramRoot":"dist"}',
    'tsconfig.json': JSON.stringify(tsconfig),
    'src/app.ts': 'App({})',
    'src/app.json': '{"pages":["pages/home/index"]}',
    [`src/message.${lang}`]: lang === 'ts'
      ? 'export const message: string = "managed-preflight-alias"'
      : `function render(_tag${lang === 'tsx' ? ': string' : ''}, props${lang === 'tsx' ? ': { title: string }' : ''}) { return props.title }; export const message = <view title="managed-preflight-alias" />`,
    'src/pages/home/index.ts': 'import { message } from "@/message"; Page({ data: { message } })',
    'src/pages/home/index.json': '{}',
    'src/pages/home/index.wxml': '<view>{{message}}</view>',
  })) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true })
    await writeFile(path.join(root, file), content)
  }
  const options: LoadConfigOptions = {
    cwd: root,
    isDev: true,
    mode: 'development',
    hostConfig: { config: { root, configFile: false, weapp: { srcRoot: 'src', autoRoutes: false, vue: { enable: false } } } },
  }
  if (lang !== 'ts') {
    options.hostConfig!.config.oxc = { jsx: { runtime: 'classic', pragma: 'render' } }
  }
  return { root, options }
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

it.each([
  { name: 'references', tsconfig: { references: [{ path: './.weapp-vite/tsconfig.app.json' }], files: [] } },
  { name: 'extends', tsconfig: { extends: './.weapp-vite/tsconfig.app.json' } },
].flatMap(config => (['ts', 'tsx', 'jsx'] as const).map(lang => ({ ...config, lang }))))('compiles a clean managed $name $lang project without writing support files', async ({ tsconfig, lang }) => {
  const project = await fixture(tsconfig, lang)
  const snapshot = prepareStatefulHmrSnapshot(await buildStatefulHmrSnapshot(project.options, undefined, undefined, undefined, []))
  const page = snapshot.output.find(file => file.fileName === 'pages/home/index.js')
  expect(page?.type === 'chunk' ? page.code : undefined).toContain('managed-preflight-alias')
  expect(page?.type === 'chunk' ? page.code : undefined).not.toContain('<view title=')
  expect(snapshot.inputs).toBeDefined()
  expect(JSON.parse(await readFile(path.join(project.root, 'tsconfig.json'), 'utf8')) as unknown).toEqual(tsconfig)
  await expect(access(path.join(project.root, '.weapp-vite'))).rejects.toMatchObject({ code: 'ENOENT' })
  await expect(access(path.join(project.root, 'dist'))).rejects.toMatchObject({ code: 'ENOENT' })
})

it.each(['rolldown', 'vite'] as const)('keeps an explicitly missing %s managed tsconfig as a build error', async (host) => {
  const project = await fixture({ references: [{ path: './.weapp-vite/tsconfig.app.json' }], files: [] })
  const tsconfig = path.join(project.root, '.weapp-vite/tsconfig.app.json')
  if (host === 'vite') {
    project.options.hostConfig!.config.tsconfig = tsconfig
  }
  else {
    project.options.hostConfig!.config.build = { rolldownOptions: { tsconfig } }
  }
  const error: unknown = await buildStatefulHmrSnapshot(project.options).then(() => undefined, error => error)
  expect(error).toBeInstanceOf(Error)
  expect(error).not.toBeInstanceOf(HmrRuntimeCapabilityError)
  expect((error as Error).message).toContain('Tsconfig not found')
  await expect(access(path.join(project.root, '.weapp-vite'))).rejects.toMatchObject({ code: 'ENOENT' })
})

it('checks compiler capability in the context that actually compiled its providers', async () => {
  const project = await fixture({ files: [] })
  let compiled = false
  project.options.hostConfig!.config.weapp!.compilerPlugins = [{
    name: 'legacy-content-provider',
    capabilities: { content: true },
    create() {
      return {
        buildStart() {
          compiled = true
        },
      }
    },
  }]
  await expect(buildStatefulHmrSnapshot(project.options)).rejects.toMatchObject({ fallback: { code: 'compiler-provider' } })
  expect(compiled).toBe(true)
})
