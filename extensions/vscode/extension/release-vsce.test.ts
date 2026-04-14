import assert from 'node:assert/strict'
import { it } from 'vitest'

import { createPublishManifest } from '../scripts/release-vsce.ts'

it('publish manifest strips dev-only fields before invoking vsce', () => {
  const publishManifest = createPublishManifest({
    'name': '@weapp-vite/vscode',
    'displayName': 'weapp-vite',
    'version': '0.1.1',
    'publisher': 'weapp-vite',
    'private': true,
    'scripts': {
      build: 'pnpm build',
    },
    'devDependencies': {
      '@types/vscode': '^1.115.0',
    },
    'engines': {
      vscode: '^1.88.0',
    },
    'x-vsce': {
      name: 'weapp-vite',
      displayName: 'Weapp Vite',
    },
  })

  assert.equal(publishManifest.name, 'weapp-vite')
  assert.equal(publishManifest.displayName, 'Weapp Vite')
  assert.equal('devDependencies' in publishManifest, false)
  assert.equal('scripts' in publishManifest, false)
  assert.equal('private' in publishManifest, false)
  assert.deepEqual(publishManifest.engines, {
    vscode: '^1.88.0',
  })
})
