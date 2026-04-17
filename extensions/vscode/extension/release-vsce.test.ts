import assert from 'node:assert/strict'
import { it } from 'vitest'

import { createPublishManifest, createVsceEnv } from '../scripts/release-vsce.ts'

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
  const publishManifestWithEngines = publishManifest as typeof publishManifest & {
    engines?: {
      vscode: string
    }
  }

  assert.equal(publishManifest.name, 'weapp-vite')
  assert.equal(publishManifest.displayName, 'Weapp Vite')
  assert.equal('devDependencies' in publishManifest, false)
  assert.equal('scripts' in publishManifest, false)
  assert.equal('private' in publishManifest, false)
  assert.deepEqual(publishManifestWithEngines.engines, {
    vscode: '^1.88.0',
  })
})

it('vsce env strips pnpm and npm script context noise', () => {
  const env = createVsceEnv({
    PATH: '/bin',
    HOME: '/tmp/home',
    VSCE_PAT: 'secret',
    npm_package_json: '/workspace/extensions/vscode/package.json',
    npm_config_user_agent: 'pnpm/10',
    PNPM_HOME: '/tmp/pnpm',
    LANG: 'en_US.UTF-8',
  })

  assert.deepEqual(env, {
    HOME: '/tmp/home',
    LANG: 'en_US.UTF-8',
    PATH: '/bin',
    VSCE_PAT: 'secret',
  })
})
