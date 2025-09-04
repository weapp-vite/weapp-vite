import type { RolldownWatcher } from 'rolldown'
import consola from 'consola'
import path from 'pathe'
import { build } from 'rolldown-vite'
import { customLoadEntry } from '@/index'

async function main() {
  const watcher = await build({
    root: path.resolve(import.meta.dirname, 'fixtures/demo'),
    plugins: [
      customLoadEntry(),
    ],
    build: {
      rolldownOptions: {
        input: {
          app: path.resolve(import.meta.dirname, 'fixtures/demo/app.js'),
        },
      },
      watch: {},
    },
  }) as RolldownWatcher
  if ('on' in watcher) {
    watcher.on('event', (e) => {
      consola.info('[RolldownWatcher]', e.code)
    })
  }
}

main()
