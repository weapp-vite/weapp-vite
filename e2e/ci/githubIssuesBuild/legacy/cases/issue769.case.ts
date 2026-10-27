import type { GithubIssuesBuildCaseContext } from '../../cases/types'
import { originalPositionFor, TraceMap } from '@jridgewell/trace-mapping'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runBuildWithSourcemap } from '../builders/standard'
import { APP_ROOT, DIST_ROOT } from '../constants'
import { findGeneratedPosition } from '../helpers'

export const group = 'sourcemap'
export const order = 33

export function registerGithubIssuesBuildCase(context: GithubIssuesBuildCaseContext) {
  it('issue #769: keeps native ts sourcemaps aligned after local npm rewrite', async () => {
    await (context.runSourcemapBuild ?? runBuildWithSourcemap)()

    const sourceFile = 'src/subpackages/item/issue-769/index.ts'
    const pageJsPath = path.join(DIST_ROOT, 'subpackages/item/issue-769/index.js')
    const pageMapPath = `${pageJsPath}.map`
    const pageJs = await fs.readFile(pageJsPath, 'utf-8')
    const pageMap = JSON.parse(await fs.readFile(pageMapPath, 'utf-8')) as ConstructorParameters<typeof TraceMap>[0]
    const sourceTs = await fs.readFile(path.join(APP_ROOT, sourceFile), 'utf-8')
    const sourceLines = sourceTs.split('\n')
    const sourceMap = new TraceMap(pageMap)
    const mappedMarkers = [
      ['issue 769 sourcemap marker', `camelCase('issue 769 sourcemap marker')`],
      ['Page({', 'Page({'],
      ['_runE2E() {', '_runE2E() {'],
      ['issue769SourcemapMarker', `ok: issue769NpmMarker === 'issue769SourcemapMarker'`],
    ]

    expect(pageJs).toMatch(/require\((['"])\.\.\/miniprogram_npm\/camelcase(?:\/index)?\1\)/)
    expect(await fs.pathExists(pageMapPath)).toBe(true)
    for (const [generatedMarker, sourceMarker] of mappedMarkers) {
      const expectedSourceLine = sourceLines.findIndex(line => line.includes(sourceMarker)) + 1
      const originalPosition = originalPositionFor(sourceMap, findGeneratedPosition(pageJs, generatedMarker))
      expect(expectedSourceLine).toBeGreaterThan(0)
      expect(originalPosition.source?.replaceAll('\\', '/')).toContain(sourceFile)
      expect(originalPosition.line).toBe(expectedSourceLine)
    }
  })
}
