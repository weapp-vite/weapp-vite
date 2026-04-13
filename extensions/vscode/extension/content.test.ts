import assert from 'node:assert/strict'
import { it, vi } from 'vitest'

function createDocument(text: string) {
  const lines = text.split('\n')

  return {
    lineCount: lines.length,
    lineAt(index: number) {
      return {
        text: lines[index],
      }
    },
  }
}

it('builds app.json diagnostics for missing page routes', async () => {
  vi.doMock('vscode', () => {
    return {
      default: {
        Range: class {
          start
          end

          constructor(startLine: number, startCharacter: number, endLine: number, endCharacter: number) {
            this.start = { line: startLine, character: startCharacter }
            this.end = { line: endLine, character: endCharacter }
          }
        },
        Diagnostic: class {
          range
          message
          severity

          constructor(range: any, message: string, severity: number) {
            this.range = range
            this.message = message
            this.severity = severity
          }
        },
        DiagnosticSeverity: {
          Information: 1,
        },
        MarkdownString: class {
          value

          constructor(value: string) {
            this.value = value
          }
        },
      },
    }
  })
  vi.resetModules()

  const {
    buildAppJsonDiagnostics,
  } = await import('./content')
  const diagnostics = buildAppJsonDiagnostics(createDocument([
    '{',
    '  "pages": [',
    '    "pages/home/index",',
    '    "pages/missing/index"',
    '  ]',
    '}',
  ].join('\n')), ['pages/missing/index'])

  assert.equal(diagnostics.length, 1)
  assert.equal(diagnostics[0].message, '未找到页面文件：pages/missing/index（已尝试 .vue / .ts / .js / .wxml）')
  assert.equal(diagnostics[0].range.start.line, 3)

  vi.doUnmock('vscode')
  vi.resetModules()
})
