import type { RolldownWatcher } from 'rolldown'
import { createCompilerContext } from '#src/createContext'

import { css } from '#src/plugins/css'
import { scanFiles } from '#test/utils'
// import fs from 'fs-extra'
import path from 'pathe'
import { build } from 'rolldown-vite'
// import { wrapPlugin } from 'vite-plugin-performance'
import { customLoadEntryPlugin } from '@/index'

describe('index', () => {
  it('foo bar', async () => {
    const root = path.resolve(import.meta.dirname, 'fixtures/demo')
    const ctx = await createCompilerContext({
      cwd: root,
    })

    const watcher = await build({
      root,
      plugins: [
        // wrapPlugin(
        //   // @ts-ignore
        //   customLoadEntry(),
        //   // {
        //   //   threshold
        //   // }
        // ),
        customLoadEntryPlugin(
          ctx,
        ),
        css(ctx),
        // logPlugin(),
      ],
      build: {
        assetsDir: '',
        rollupOptions: {
          input: {
            app: path.resolve(import.meta.dirname, 'fixtures/demo/app.js'),
          },
          output: {
            // chunkFileNames: '[name].js',
            entryFileNames: '[name].js',
          },

        },
        // watch: {},
      },
    }) as RolldownWatcher
    // watcher.close()
    if ('on' in watcher) {
      watcher.on('event', (event) => {
        console.log('event', event)

        if (event.code === 'END') {
          watcher.close()
        }
      })
    }

    const fileList = await scanFiles(path.resolve(import.meta.dirname, 'fixtures/demo/dist'))

    expect(fileList).toMatchSnapshot('fileList')
  })
})
