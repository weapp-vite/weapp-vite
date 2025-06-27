import type { RollupWatcher } from 'rollup'
import consola from 'consola'
import path from 'pathe'
import { build } from 'vite'
import { customLoadEntry } from '@/index'

async function main() {
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
      watch: {},
    },
  }) as RollupWatcher

  watcher.on('event', (e) => {
    consola.info('[RollupWatcher]', e.code)
  })
}

main()
