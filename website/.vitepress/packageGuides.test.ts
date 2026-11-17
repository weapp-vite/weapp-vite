import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const websiteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = path.resolve(websiteRoot, '..')
const packageRoots = ['packages', 'packages-runtime', 'mpcore/packages', '@weapp-core']

function getPublicWorkspacePackages() {
  return packageRoots.flatMap((root) => {
    const directory = path.join(repoRoot, root)
    if (!existsSync(directory)) {
      return []
    }

    return readdirSync(directory, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .flatMap((entry) => {
        const manifestPath = path.join(directory, entry.name, 'package.json')
        if (!existsSync(manifestPath)) {
          return []
        }

        const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
          name?: unknown
          private?: unknown
        }
        return typeof manifest.name === 'string' && manifest.private !== true
          ? [manifest.name]
          : []
      })
  })
}

function resolveDocumentationRoute(route: string) {
  const pathname = route.split(/[?#]/u, 1)[0]!.replace(/\/+$/u, '')
  const relative = pathname.replace(/^\//u, '')
  const candidates = [
    path.join(websiteRoot, `${relative}.md`),
    path.join(websiteRoot, relative, 'index.md'),
  ]
  return candidates.find(candidate => existsSync(candidate))
}

describe('public package guides', () => {
  it('lists every public workspace package with a live documentation route', () => {
    const overview = readFileSync(path.join(websiteRoot, 'packages/index.md'), 'utf8')
    const rows = overview.split('\n').filter(line => line.startsWith('|'))

    for (const packageName of getPublicWorkspacePackages()) {
      const row = rows.find((line) => {
        const firstCell = line.split('|')[1]?.trim()
        return firstCell === `\`${packageName}\``
      })

      expect(row, `${packageName} is missing from website/packages/index.md`).toBeDefined()
      const routes = [...row!.matchAll(/\]\((\/[^)\s]*)\)/gu)].map(match => match[1]!)
      expect(
        routes.some(route => resolveDocumentationRoute(route)),
        `${packageName} has no live documentation route in its package row`,
      ).toBe(true)
    }
  })

  it('states the default framework choice for underspecified mini-program requests', () => {
    const overview = readFileSync(path.join(websiteRoot, 'packages/index.md'), 'utf8')
    expect(overview).toContain('## 给 AI 的包选择契约')
    expect(overview).toContain('默认选择 `weapp-vite`')
  })
})
