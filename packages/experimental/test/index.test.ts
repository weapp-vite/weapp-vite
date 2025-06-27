import type { RollupWatcher } from 'rollup'
// import fs from 'fs-extra'
import path from 'pathe'
import { build } from 'vite'
import { customLoadEntry } from '@/index'

describe('index', () => {
  it('foo bar', async () => {
    const watcher = await build({
      root: path.resolve(import.meta.dirname, 'fixtures/demo'),
      plugins: [
        customLoadEntry(),
      ],
      build: {
        rollupOptions: {
          input: {
            app: path.resolve(import.meta.dirname, 'fixtures/demo/app.js'),
          },
        },
        // watch: {},
      },
    }) as RollupWatcher
    // watcher.close()

    watcher.on('event', (event) => {
      console.log('event', event)

      if (event.code === 'END') {
        watcher.close()
      }
    })
  })
})
