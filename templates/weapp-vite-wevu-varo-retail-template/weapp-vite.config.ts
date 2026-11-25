import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'weapp-vite/config'

const root = import.meta.dirname
const registryStyles = readdirSync(resolve(root, 'src/styles'))
  .filter(name => name.endsWith('.css'))
  .sort((left, right) =>
    left === 'varo.css'
      ? -1
      : right === 'varo.css'
        ? 1
        : left.localeCompare(right),
  )

export default defineConfig({
  weapp: {
    srcRoot: 'src',
    platform: 'weapp',
    styles: [
      ...registryStyles.map(name => ({
        source: `styles/${name}`,
        include: 'app.vue',
      })),
      { source: 'styles.css', include: 'app.vue' },
    ],
    tailwindcss: {
      appType: 'weapp-vite',
      cssEntries: [resolve(root, 'src/styles.css')],
      cssOptions: {
        cssPreflight: false,
        rem2rpx: true,
        cssRemoveActivePseudoClass: true,
      },
      ignoreCallExpressionIdentifiers: ['cn'],
      logLevel: 'warn',
    },
    vue: {
      template: {
        nativeSlotContext: true,
        scopedSlotsRequireProps: true,
      },
    },
    wevu: {
      defaults: {
        component: {
          options: {
            virtualHost: true,
            styleIsolation: 'apply-shared',
          },
        },
      },
    },
  },
})
