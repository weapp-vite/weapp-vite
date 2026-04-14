import assert from 'node:assert/strict'
import { it } from 'vitest'

import {
  readWeappGenerateConfigSnapshot,
} from './projectConfig'

it('reads generate dirs and filenames from defineConfig object', () => {
  const snapshot = readWeappGenerateConfigSnapshot([
    'import { defineConfig } from \'weapp-vite\'',
    'export default defineConfig({',
    '  weapp: {',
    '    srcRoot: \'src\',',
    '    generate: {',
    '      dirs: {',
    '        component: \'src/custom-components\',',
    '        page: \'src/custom-pages\',',
    '      },',
    '      filenames: {',
    '        component: \'main\',',
    '        page: \'entry\',',
    '      },',
    '    },',
    '  },',
    '})',
  ].join('\n'))

  assert.deepEqual(snapshot, {
    srcRoot: 'src',
    dirs: {
      component: 'src/custom-components',
      page: 'src/custom-pages',
    },
    filenames: {
      component: 'main',
      page: 'entry',
    },
  })
})

it('reads generate config from function-style defineConfig', () => {
  const snapshot = readWeappGenerateConfigSnapshot([
    'import { defineConfig } from \'weapp-vite\'',
    'export default defineConfig(() => ({',
    '  weapp: {',
    '    generate: {',
    '      dirs: {',
    '        page: \'src/pages\',',
    '      },',
    '    },',
    '  },',
    '}))',
  ].join('\n'))

  assert.deepEqual(snapshot, {
    srcRoot: undefined,
    dirs: {
      page: 'src/pages',
    },
    filenames: {},
  })
})
