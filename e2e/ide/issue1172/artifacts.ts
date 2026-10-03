import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { expect } from 'vitest'

export const ROUTES = {
  primary: '/pages/index/index',
  isolation: '/pages/isolation/index',
  nesting: '/pages/nesting/index',
  lifecycle: '/pages/lifecycle/index',
  nativeExport: '/pages/native-export/index',
  exportedOwner: '/pages/exported-owner/index',
}

/** 检查宿主所需页面文件以及原生和增强插槽的实际产物边界。 */
export async function assertIssue1172Artifacts(project: string, requireProps: boolean) {
  const dist = path.join(project, 'dist')
  const app = JSON.parse(await readFile(path.join(dist, 'app.json'), 'utf8')) as { pages: string[] }
  expect(app.pages).toEqual(Object.values(ROUTES).map(route => route.slice(1)))
  for (const page of app.pages) {
    for (const extension of ['js', 'json', 'wxml']) {
      expect((await stat(path.join(dist, `${page}.${extension}`))).isFile()).toBe(true)
    }
  }

  const primary = await readFile(path.join(dist, 'pages/index/index.wxml'), 'utf8')
  const nesting = await readFile(path.join(dist, 'pages/nesting/index.wxml'), 'utf8')
  const provider = await readFile(path.join(dist, 'components/provider/index.wxml'), 'utf8')
  if (requireProps) {
    expect(primary).toMatch(/<provider\b/)
    expect(primary).toMatch(/<leaf\b/)
    expect(nesting).toMatch(/\bslot="named"/)
    expect(provider).toMatch(/<slot\b/)
    expect(provider).toMatch(/<slot\s[^>]*\bname="named"/)
    for (const wxml of [primary, nesting, provider]) {
      expect(wxml).not.toMatch(/generic:scoped-slots-|<scoped-slots-/)
    }
  }
  else {
    expect(primary).toContain('generic:scoped-slots-default=')
    expect(primary).not.toMatch(/<leaf\b/)
  }

  const nativePage = await readFile(path.join(dist, 'pages/native-export/index.wxml'), 'utf8')
  const nativeShell = await readFile(path.join(dist, 'components/nativeShell/index.wxml'), 'utf8')
  expect(nativePage).toContain('native default projection')
  expect(nativePage).toContain('slot="named"')
  expect(nativeShell).toMatch(/<slot\s*\/>/)
  expect(nativeShell).toMatch(/<slot\s+name="named"\s*\/>/)
  expect(nativePage + nativeShell).not.toMatch(/generic:scoped-slots-|<scoped-slots-/)
}
