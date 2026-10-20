import type { ViteDevServer } from 'vite'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createServer, isRunnableDevEnvironment } from 'vite'
import { describe, expect, it } from 'vitest'
import { createE2ESourceTransform } from './sourceTransform'

interface SourceFixture {
  Item: new () => { value: number }
  Status: { Ready: number }
  readStatus: () => number
}

interface JsxFixture {
  card: {
    type: string
    props: { id: string, children: string }
    runtime: 'development' | 'production'
  }
}

async function withTransformServer(run: (server: ViteDevServer) => Promise<void>) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'e2e-source-transform-'))
  let server: ViteDevServer | undefined
  try {
    await fs.writeFile(path.join(root, 'tsconfig.json'), JSON.stringify({ extends: './.weapp-vite/tsconfig.app.json' }))
    await fs.writeFile(path.join(root, 'entry.ts'), `
      class Base {
        set value(value: number) { throw new Error(String(value)) }
      }
      export class Item extends Base {
        value = 3
        uninitialized!: string
        declare erased: string
      }
      export enum Status { Ready = 3 }
      export function readStatus() { return Status.Ready }
    `)
    await fs.writeFile(path.join(root, 'card.tsx'), 'export const card = <section id="fixture">hello</section>')
    await fs.writeFile(path.join(root, 'invalid.ts'), 'export const broken: = 1')
    const jsxRuntime = path.join(root, 'jsx-runtime.js')
    await fs.writeFile(jsxRuntime, `
      export function jsx(type, props) { return { type, props, runtime: 'production' } }
      export function jsxDEV(type, props) { return { type, props, runtime: 'development' } }
    `)
    server = await createServer({
      root,
      configFile: false,
      logLevel: 'silent',
      oxc: { exclude: /.*/, target: 'node22' },
      plugins: [createE2ESourceTransform()],
      resolve: { alias: { 'react/jsx-runtime': jsxRuntime, 'react/jsx-dev-runtime': jsxRuntime } },
      optimizeDeps: { noDiscovery: true, include: [] },
      server: { middlewareMode: true, watch: null, hmr: false },
    })
    await run(server)
  }
  finally {
    await server?.close()
    await fs.rm(root, { recursive: true, force: true })
  }
}

describe('E2E source transform', () => {
  it('imports TypeScript and TSX without generated configs while preserving class fields and enum reads', async () => {
    await withTransformServer(async (server) => {
      const environment = server.environments.ssr
      if (!environment || !isRunnableDevEnvironment(environment)) {
        throw new Error('The E2E source transform contract requires a runnable SSR environment.')
      }
      const source = await environment.runner.import<SourceFixture>('/entry.ts')
      const item = new source.Item()
      expect(item.value).toBe(3)
      expect(Object.hasOwn(item, 'uninitialized')).toBe(true)
      expect(Object.hasOwn(item, 'erased')).toBe(false)
      expect(source.readStatus()).toBe(3)
      Reflect.set(source.Status, 'Ready', 7)
      expect(source.readStatus()).toBe(7)

      const { card } = await environment.runner.import<JsxFixture>('/card.tsx')
      expect(card).toEqual({
        type: 'section',
        props: { id: 'fixture', children: 'hello' },
        runtime: server.config.isProduction ? 'production' : 'development',
      })
    })
  })

  it('keeps invalid TypeScript as a transform failure', async () => {
    await withTransformServer(async (server) => {
      await expect(server.transformRequest('/invalid.ts', { ssr: true })).rejects.toThrow('Transform failed')
    })
  })
})
