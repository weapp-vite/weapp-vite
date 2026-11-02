import type { ViteDevServer } from 'vite'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createServer } from 'vite'
import { expect, it } from 'vitest'
import { applyAction } from './driver'
import { FrameworkSequenceSession } from './framework'
import { createFrameworkResourceSequence } from './frameworkSequence'
import { createSequenceProject } from './project'
import { SequenceResourceOwnership } from './resourceOwnership'

it('publishes the first classic edit through the live host and reloads the real runtime', async () => {
  const project = await createSequenceProject()
  const session = new FrameworkSequenceSession('weapp-classic', project.root)
  const sequence = createFrameworkResourceSequence(14, 2)
  const files = { ...sequence.files }
  try {
    const initial = await session.observe({ files, step: 0, signal: AbortSignal.timeout(30_000) })
    expect(initial.pages['pages/page-0000/index']).toMatchObject({ data: { message: 'page-0000-v0000' } })
    expect(session.observeSession()).toEqual({ watchers: 1, engines: 0 })
    const action = sequence.steps[0]!.action
    applyAction(files, action)
    // 两页回归仅定位首次编辑的事件链；正式资源序列继续使用 worker 的 180 秒预算。
    const updated = await session.observe({ files, step: 1, action, signal: AbortSignal.timeout(15_000) })
    expect(updated.pages['pages/page-0000/index']).toMatchObject({ data: { message: 'page-0000-v0001' } })
    expect(updated.pages['pages/page-0001/index']).toEqual(initial.pages['pages/page-0001/index'])
    expect(session.observeSession()).toEqual({ watchers: 1, engines: 0 })
  }
  finally {
    try {
      await session.close()
    }
    finally {
      await project.close()
    }
  }
  expect(session.observeSession()).toEqual({ watchers: 0, engines: 0 })
}, 60_000)

it('registers the public Vite bundled owner before listen and observes its native close', async () => {
  const project = await createSequenceProject()
  const ownership = new SequenceResourceOwnership()
  let server: ViteDevServer | undefined
  let nativeCloseHooks = 0
  try {
    await writeFile(path.join(project.root, 'index.html'), '<script type="module" src="/entry.js"></script>')
    await writeFile(path.join(project.root, 'entry.js'), 'console.log("public-bundled-owner")')
    server = await createServer({
      root: project.root,
      configFile: false,
      logLevel: 'error',
      experimental: { bundledDev: true },
      server: { host: '127.0.0.1', port: 0, ws: false },
      plugins: [{
        name: 'sequence-public-bundled-owner-control',
        applyToEnvironment: environment => environment.name === 'client',
        configureServer(host) {
          const owner = host.environments.client?.bundledDev
          if (!owner) {
            throw new Error('Vite must expose the bundled owner before listen')
          }
          ownership.track(owner)
        },
        closeBundle() { nativeCloseHooks++ },
      }],
    })
    expect(ownership.size).toBe(1)
    await server.listen()
    const owner = server.environments.client!.bundledDev!
    // listen 后首构仍在后台运行；先等真实产物，再验证原生构建资源的关闭。
    await expect.poll(() => owner.hasBuildOutput, { timeout: 10_000 }).toBe(true)
    const closing = owner.close()
    expect(owner.close()).toBe(closing)
    await closing
    expect(ownership.size).toBe(0)
    expect(nativeCloseHooks).toBeGreaterThan(0)
    await server.close()
    ownership.assertReleased()
  }
  finally {
    try {
      await server?.close()
    }
    finally {
      await project.close()
    }
  }
}, 30_000)
