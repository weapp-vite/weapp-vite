import type { GithubIssuesBuildCaseContext } from './types'
import { originalPositionFor, TraceMap } from '@jridgewell/trace-mapping'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runWeappViteBuildWithLogCapture } from '../../../utils/buildLog'

export function registerGithubIssuesBuildCase(context: GithubIssuesBuildCaseContext) {
  it('issue #1016: keeps emitted script coordinates mapped to the original SFC', async () => {
    await runWeappViteBuildWithLogCapture({
      cliPath: context.cliPath,
      projectRoot: context.appRoot,
      platform: 'weapp',
      cwd: context.appRoot,
      label: 'ci:issue-1016-sourcemap',
      sourcemap: true,
    })

    const sourceFile = 'src/pages/issue-1016/index.vue'
    const pagePath = path.join(context.distRoot, 'pages/issue-1016/index.js')
    const pageCode = await fs.readFile(pagePath, 'utf8')
    const pageMapText = await fs.readFile(`${pagePath}.map`, 'utf8')
    const pageMap = JSON.parse(pageMapText) as {
      sourcesContent?: Array<string | null>
    }
    const generatedLines = pageCode.split('\n')
    const generatedLineIndex = generatedLines.findIndex(line => line.includes('sentinel'))

    expect(generatedLineIndex).toBeGreaterThanOrEqual(0)
    const mapped = originalPositionFor(new TraceMap(pageMapText), {
      line: generatedLineIndex + 1,
      column: generatedLines[generatedLineIndex]!.indexOf('sentinel'),
    })

    expect(mapped.source?.replaceAll('\\', '/')).toContain(sourceFile)
    expect(mapped.line).toBe(5)
    expect(mapped.column).toBe(6)
    expect(pageMap.sourcesContent).toContain(await fs.readFile(path.join(context.appRoot, sourceFile), 'utf8'))
  })
}
