import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'pathe'
import { expect, it } from 'vitest'
import { createSidecarSourceSpecifier } from '../../moduleGraph/protocol'
import { getNativeComponentSidecarSource, isChangedNativeComponentSidecar } from './nativeComponentSidecar'

it('compares component ownership by filesystem identity across root aliases', async () => {
  const temporary = await realpath(await mkdtemp(path.join(tmpdir(), 'native-component-identity-')))
  const physicalRoot = path.join(temporary, 'project')
  const aliasRoot = path.join(temporary, 'linked-project')
  await mkdir(path.join(physicalRoot, 'src'), { recursive: true })
  await symlink(physicalRoot, aliasRoot, 'junction')
  const source = path.join(physicalRoot, 'src/counter.js')
  const alias = path.join(aliasRoot, 'src/counter.js')
  await writeFile(source, 'Component({})')
  try {
    const sidecar = createSidecarSourceSpecifier(path.join(aliasRoot, 'src/page.js'), alias, 'using-component')
    const entries = [alias]
    expect(getNativeComponentSidecarSource(sidecar, aliasRoot, entries)).toBe(source)
    expect(isChangedNativeComponentSidecar(sidecar, [alias], {
      root: aliasRoot,
      srcRoot: path.join(aliasRoot, 'src'),
      entryIds: entries,
    })).toBe(true)
    expect(isChangedNativeComponentSidecar(sidecar, [path.join(aliasRoot, 'src/other.js')], {
      root: aliasRoot,
      srcRoot: path.join(aliasRoot, 'src'),
      entryIds: entries,
    })).toBe(false)
  }
  finally {
    await rm(temporary, { recursive: true, force: true })
  }
})
