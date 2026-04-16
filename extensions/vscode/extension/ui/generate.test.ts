import assert from 'node:assert/strict'
import path from 'node:path'
import { it, vi } from 'vitest'

function createVscodeModule(mockVscode: Record<string, unknown>) {
  return {
    ...mockVscode,
    default: mockVscode,
  }
}

async function loadGenerateModule() {
  vi.doMock('vscode', () => createVscodeModule({}))
  vi.resetModules()
  return import('./generate')
}

it('resolves default page target path from app.json source root', async () => {
  const { resolveGenerateTargetPath } = await loadGenerateModule()
  const targetPath = resolveGenerateTargetPath(
    '/workspace/demo',
    '/workspace/demo/src/app.json',
    'page',
    'home',
  )

  assert.equal(targetPath, path.join('/workspace/demo/src/pages/home/index.vue'))
})

it('resolves default component target path from app.json source root', async () => {
  const { resolveGenerateTargetPath } = await loadGenerateModule()
  const targetPath = resolveGenerateTargetPath(
    '/workspace/demo',
    '/workspace/demo/src/app.json',
    'component',
    'card/user',
  )

  assert.equal(targetPath, path.join('/workspace/demo/src/components/card/user/index.vue'))
})

it('resolves target path from explorer directory when provided', async () => {
  const { resolveGenerateTargetPath } = await loadGenerateModule()
  const targetPath = resolveGenerateTargetPath(
    '/workspace/demo',
    '/workspace/demo/src/app.json',
    'page',
    'detail',
    '/workspace/demo/src/packageA',
  )

  assert.equal(targetPath, path.join('/workspace/demo/src/packageA/detail/index.vue'))
})

it('resolves target path from generate config defaults when no explorer directory is provided', async () => {
  const { resolveGenerateTargetPath } = await loadGenerateModule()
  const targetPath = resolveGenerateTargetPath(
    '/workspace/demo',
    '/workspace/demo/src/app.json',
    'component',
    'card',
    null,
    {
      dirs: {
        component: 'src/custom-components',
      },
      filenames: {
        component: 'main',
      },
    },
  )

  assert.equal(targetPath, path.join('/workspace/demo/src/custom-components/card/main.vue'))
})

it('rejects unsafe relative paths', async () => {
  const { resolveGenerateTargetPath } = await loadGenerateModule()
  assert.equal(resolveGenerateTargetPath(
    '/workspace/demo',
    '/workspace/demo/src/app.json',
    'component',
    '../escape',
  ), null)
})
