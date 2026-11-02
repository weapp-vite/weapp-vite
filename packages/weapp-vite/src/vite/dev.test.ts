import type { InlineConfig } from 'vite'
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
