import assert from 'node:assert/strict'
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createServer } from 'vite'

export async function verifyOptimizerServer(create = createServer) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'vite-optimizer-close-'))
  const cacheDir = path.join(root, 'cache')
  const entered = Promise.withResolvers()
  const release = Promise.withResolvers()
  let server
  try {
    await writeFile(path.join(root, 'package.json'), '{"type":"module"}')
    await writeFile(path.join(root, 'entry.js'), 'export const answer = 42')
    server = await create({
      root,
      configFile: false,
      cacheDir,
      logLevel: 'silent',
      server: { middlewareMode: true, watch: null },
      optimizeDeps: {
        entries: ['entry.js'],
        rolldownOptions: {
          plugins: [{
            name: 'fixture:hold-dependency-scan',
            async buildStart() {
              entered.resolve()
              await release.promise
            },
          }],
        },
      },
    })
    await entered.promise
    let closed = false
    const closing = server.close().then(() => {
      closed = true
    })
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(closed, false, 'The real server must wait for its dependency scanner')
    release.resolve()
    await closing
    const files = await readdir(cacheDir).catch((error) => {
      if (error.code === 'ENOENT') {
        return []
      }
      throw error
    })
    assert.deepEqual(files, [], 'A cancelled scan must not leave a newly created optimization cache')
    return ['optimizer-server-scan-close']
  }
  finally {
    release.resolve()
    await server?.close()
    await rm(root, { recursive: true, force: true })
  }
}
