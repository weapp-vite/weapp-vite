/// <reference types="node" />

import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import path from 'node:path'
import { it, vi } from 'vitest'

function createVscodeModule(mockVscode: Record<string, unknown>) {
  return {
    ...mockVscode,
    default: mockVscode,
  }
}

function normalizeFsPath(fsPath: string) {
  return path.normalize(fsPath)
}

function toUriPath(fsPath: string) {
  return fsPath.replaceAll('\\', '/')
}

function createDocument(text: string, fsPath: string) {
  return {
    uri: {
      fsPath,
      path: toUriPath(fsPath),
    },
    getText() {
      return text
    },
    lineAt() {
      return { text: '' }
    },
  }
}

it('only offers package.json script quick fix when common scripts are actually missing', async () => {
  const files = new Map<string, string>([
    [normalizeFsPath('/workspace/app/package.json'), JSON.stringify({
      name: 'demo-app',
      dependencies: {
        'weapp-vite': '^1.0.0',
      },
      scripts: {
        dev: 'wv dev',
      },
    })],
    [normalizeFsPath('/workspace/app-complete/package.json'), JSON.stringify({
      name: 'demo-app-complete',
      dependencies: {
        'weapp-vite': '^1.0.0',
      },
      scripts: {
        'build': 'wv build',
        'dev:open': 'wv dev --open',
        'g': 'weapp-vite generate',
        'open': 'wv open',
      },
    })],
    [normalizeFsPath('/workspace/app/vite.config.ts'), 'import { defineConfig } from \'weapp-vite\'\nexport default defineConfig({})\n'],
    [normalizeFsPath('/workspace/app-complete/vite.config.ts'), 'import { defineConfig } from \'weapp-vite\'\nexport default defineConfig({})\n'],
  ])

  vi.doMock('vscode', () => {
    const mockVscode = {
      CodeAction: class {
        title
        kind

        constructor(title: string, kind: string) {
          this.title = title
          this.kind = kind
        }
      },
      CodeActionKind: {
        QuickFix: 'QuickFix',
        RefactorRewrite: 'RefactorRewrite',
      },
      CompletionItemKind: {
        File: 1,
        Function: 2,
        Property: 3,
        Snippet: 4,
        Value: 5,
      },
      Uri: {
        file(nextFsPath: string) {
          return {
            fsPath: nextFsPath,
            path: toUriPath(nextFsPath),
          }
        },
      },
      workspace: {
        fs: {
          stat: async (uri: { fsPath: string }) => {
            if (!files.has(uri.fsPath)) {
              throw new TypeError('not found')
            }

            return {}
          },
          readFile: async (uri: { fsPath: string }) => {
            const content = files.get(uri.fsPath)

            if (typeof content !== 'string') {
              throw new TypeError('not found')
            }

            return Buffer.from(content)
          },
        },
      },
      MarkdownString: class {
        value

        constructor(value: string) {
          this.value = value
        }
      },
    }

    return createVscodeModule(mockVscode)
  })
  vi.resetModules()

  const {
    WeappViteCodeActionProvider,
  } = await import('./providers')
  const provider = new WeappViteCodeActionProvider()
  const missingActions = await provider.provideCodeActions(
    createDocument(files.get(normalizeFsPath('/workspace/app/package.json'))!, normalizeFsPath('/workspace/app/package.json')),
    { start: { line: 0 } },
  )
  const completeActions = await provider.provideCodeActions(
    createDocument(files.get(normalizeFsPath('/workspace/app-complete/package.json'))!, normalizeFsPath('/workspace/app-complete/package.json')),
    { start: { line: 0 } },
  )

  assert.equal(missingActions.length, 1)
  assert.equal(missingActions[0].title, '补齐常用 weapp-vite scripts')
  assert.equal(completeActions.length, 0)

  vi.doUnmock('vscode')
  vi.resetModules()
})
