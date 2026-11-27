import type { InlineConfig, Matcher } from 'vite'
import { realpathSync } from 'node:fs'
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { prepareDevHostConfig } from './dev'
import { WeappBuildSession } from './session'

it.each([false, true])('keeps the classic host and session root identical with preserveSymlinks=%s', async (preserveSymlinks) => {
  const container = realpathSync.native(await mkdtemp(path.join(os.tmpdir(), 'classic-host-root-')))
  const physicalRoot = path.join(container, 'physical')
  const logicalRoot = path.join(container, 'logical')
  const session = new WeappBuildSession()
  try {
    await mkdir(path.join(physicalRoot, 'src'), { recursive: true })
    await writeFile(path.join(physicalRoot, 'package.json'), '{"name":"classic-host-root-fixture","type":"module"}')
    await writeFile(path.join(physicalRoot, 'project.config.json'), '{"miniprogramRoot":"dist"}')
    await writeFile(path.join(physicalRoot, 'src/app.js'), 'App({})')
    await writeFile(path.join(physicalRoot, 'src/app.json'), '{"pages":[]}')
    await symlink(physicalRoot, logicalRoot, 'junction')
    const config: InlineConfig = {
      root: logicalRoot,
      configFile: false,
      resolve: { preserveSymlinks },
      server: { middlewareMode: true },
      weapp: { srcRoot: 'src', autoRoutes: false, vue: { enable: false }, hmr: { runtime: 'classic' } },
    }
    const merged = await session.prepare(config, logicalRoot, 'development', true)
    const expectedRoot = preserveSymlinks ? logicalRoot : realpathSync.native(physicalRoot)
    expect(path.normalize(session.context.configService.cwd)).toBe(path.normalize(expectedRoot))
    const host = prepareDevHostConfig(session, merged, config)
    expect(host.config.root).toBe(session.context.configService.cwd)
    expect(host.config.resolve?.preserveSymlinks).toBe(preserveSymlinks)
  }
  finally {
    try {
      await session.close()
    }
    finally {
      await rm(container, { recursive: true, force: true })
    }
  }
})

it('applies build watch filters to the stateful host without forwarding build watch', () => {
  const userIgnored = (id: string) => id.endsWith('.user-ignored')
  const configFileDependencies: string[] = []
  const session = {
    context: {
      configService: {
        cwd: '/project',
        outDir: '/project/dist',
        inlineConfig: {},
        configFileDependencies,
      },
    },
    statefulController: { plugins: [] },
  } as any
  const user: InlineConfig = {
    build: { watch: { include: ['../shared/**'], exclude: ['**/ignored/**'] } },
    server: { watch: { ignored: userIgnored } },
  }
  const host = prepareDevHostConfig(session, { root: '/project' }, user)
  const matchers = host.config.server?.watch?.ignored as Matcher[]
  const isIgnored = (file: string) => matchers.some(match => typeof match === 'function' && match(file))

  expect(isIgnored('/shared/message.ts')).toBe(false)
  expect(isIgnored('/shared/ignored/message.ts')).toBe(true)
  expect(isIgnored('/project/src/page.ts')).toBe(true)
  expect(isIgnored('/project/src/page.user-ignored')).toBe(true)
  expect(isIgnored('/project/dist/app.js')).toBe(true)
  expect(host.config.build?.watch).toBeUndefined()

  const dependency = '/project/config/value.mjs'
  expect(isIgnored(dependency)).toBe(true)
  configFileDependencies.push(dependency)
  expect(isIgnored(dependency)).toBe(false)
})
