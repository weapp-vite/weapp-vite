import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runBuild } from '../builders/standard'
import { APP_ROOT } from '../constants'

export const group = 'standard'
export const order = 61

export function registerGithubIssuesBuildCase() {
  it('issue #369: does not inject vite client types when weapp.web is not configured', async () => {
    await runBuild()

    const managedTsconfigPath = path.join(APP_ROOT, '.weapp-vite/tsconfig.app.json')
    const managedTsconfig = await fs.readJson(managedTsconfigPath) as { compilerOptions: { types: string[] } }

    expect(managedTsconfig.compilerOptions.types).toContain('weapp-vite/client')
    expect(managedTsconfig.compilerOptions.types).not.toContain('vite/client')
  })
}
