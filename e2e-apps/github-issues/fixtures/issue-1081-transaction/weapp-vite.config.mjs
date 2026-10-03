import { access, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

export default {
  plugins: [{
    name: 'issue-1081-controlled-transform',
    enforce: 'pre',
    async transform(code, id) {
      if (!id.replaceAll('\\', '/').endsWith('/src/batch.ts')) {
        return
      }
      if (code.includes('BATCH_FAIL')) {
        throw new Error('issue1081 injected transform failure')
      }
      if (!code.includes('BATCH_HOLD')) {
        return
      }
      await writeFile(path.join(import.meta.dirname, 'batch.entered'), 'entered')
      const deadline = Date.now() + 30000
      while (true) {
        try {
          await access(path.join(import.meta.dirname, 'batch.release'))
          break
        }
        catch {
          if (Date.now() > deadline) {
            throw new Error('issue1081 transform barrier timed out')
          }
          await delay(20)
        }
      }
    },
  }],
  build: { minify: true, cssMinify: true, sourcemap: true },
  weapp: {
    srcRoot: 'src',
    hmr: { runtime: 'stateful-experimental' },
    wevu: { defaults: { component: { options: { virtualHost: true, styleIsolation: 'apply-shared' } } } },
    autoRoutes: { include: ['pages/**'] },
    styles: [{ source: 'app.css', include: 'app.vue' }],
    tailwindcss: {
      cssEntries: [path.resolve(import.meta.dirname, 'src/app.css')],
      cssOptions: { cssPreflight: false, rem2rpx: true },
    },
  },
}
