import type { RolldownWatcher } from 'rolldown'
import { scanFiles } from '#test/utils'

// import fs from 'fs-extra'
import path from 'pathe'
import { build } from 'rolldown-vite'
// import { wrapPlugin } from 'vite-plugin-performance'
import { customLoadEntryPlugin, logPlugin } from '@/index'

describe('index', () => {
  it('foo bar', async () => {
    const root = path.resolve(import.meta.dirname, 'fixtures/demo')
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
          {
            cwd: root,
            stage: {
              build: true,
              output: true,
            },
          },
        ),
        logPlugin(),
      ],
      build: {
        rollupOptions: {
          input: {
            app: path.resolve(import.meta.dirname, 'fixtures/demo/app.js'),
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
