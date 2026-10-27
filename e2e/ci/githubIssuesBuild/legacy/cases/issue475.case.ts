import type { GithubIssuesBuildCaseContext } from '../../cases/types'
import { originalPositionFor, TraceMap } from '@jridgewell/trace-mapping'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runBuildWithSourcemap } from '../builders/standard'
import { APP_ROOT, DIST_ROOT } from '../constants'
import { createCachedEnvLinePattern, findGeneratedPosition, stripGeneratedScopeAttrs } from '../helpers'

export const group = 'sourcemap'
export const order = 32

export function registerGithubIssuesBuildCase(context: GithubIssuesBuildCaseContext) {
  it('issue #475: keeps emitted github-issues js traceable back to vue page and component sources', async () => {
    await (context.runSourcemapBuild ?? runBuildWithSourcemap)()

    const pageJsPath = path.join(DIST_ROOT, 'pages/issue-475/index.js')
    const componentJsPath = path.join(DIST_ROOT, 'components/issue-475/SourceMapProbe/index.js')
    const pageWxmlPath = path.join(DIST_ROOT, 'pages/issue-475/index.wxml')
    const pageJs = await fs.readFile(pageJsPath, 'utf-8')
    const componentJs = await fs.readFile(componentJsPath, 'utf-8')
    const pageWxml = stripGeneratedScopeAttrs(await fs.readFile(pageWxmlPath, 'utf-8'))

    expect(pageWxml).toContain('class="issue475-page"')
    expect(pageWxml).toContain('{{pageLabel}}')
    expect(pageWxml).toContain('{{pageTraceLabel}}')
    expect(pageWxml).toContain('{{pageEnvLabel}}')
    expect(pageWxml).toContain('<source-map-probe />')
    expect(pageJs).toContain('issue-475 page marker')
    expect(pageJs).toMatch(createCachedEnvLinePattern('pageEnv'))
    expect(pageJs).not.toContain('const pageEnv = {\n')
    expect(componentJs).toContain('issue-475 component marker')
    expect(componentJs).toMatch(createCachedEnvLinePattern('componentEnv'))
    expect(componentJs).not.toContain('const componentEnv = {\n')

    for (const [outputPath, code, sourceFile, marker] of [
      [pageJsPath, pageJs, 'src/pages/issue-475/index.vue', 'issue-475 page marker'],
      [componentJsPath, componentJs, 'src/components/issue-475/SourceMapProbe/index.vue', 'issue-475 component marker'],
    ] as const) {
      const source = await fs.readFile(path.join(APP_ROOT, sourceFile), 'utf8')
      const sourceLine = source.split('\n').findIndex(line => line.includes(marker)) + 1
      const sourceMap = new TraceMap(await fs.readFile(`${outputPath}.map`, 'utf8'))
      const mapped = originalPositionFor(sourceMap, findGeneratedPosition(code, marker))
      const sourceIndex = sourceMap.resolvedSources.findIndex(file => file.replaceAll('\\', '/').includes(sourceFile))

      expect(code).toContain('//# sourceMappingURL=index.js.map')
      expect(sourceLine).toBeGreaterThan(0)
      expect(sourceIndex).toBeGreaterThanOrEqual(0)
      // env 预处理会更新 sourcesContent，但原始标记行仍须保留并映射到同一 SFC 坐标。
      expect(sourceMap.sourcesContent?.[sourceIndex]?.split('\n')[sourceLine - 1]).toBe(source.split('\n')[sourceLine - 1])
      expect(mapped.source?.replaceAll('\\', '/')).toContain(sourceFile)
      expect(mapped.line).toBe(sourceLine)
    }
  })
}
