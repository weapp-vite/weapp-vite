import path from 'node:path'
import { build } from 'esbuild'
import { describe, expect, it } from 'vitest'

async function retainedCatalogs(entry: string, names: string[]) {
  const result = await build({
    stdin: {
      contents: `export { ${names.join(', ')} } from ${JSON.stringify(entry)}`,
      resolveDir: import.meta.dirname,
    },
    bundle: true,
    format: 'esm',
    platform: 'browser',
    treeShaking: true,
    metafile: true,
    write: false,
  })
  return Object.values(result.metafile!.outputs).flatMap(output => Object.entries(output.inputs)).filter(([file, input]) => input.bytesInOutput > 0 && /\/apiCatalog\/(?:wx|my|tt)Methods[^/]*\.ts$/.test(file.replaceAll('\\', '/'))).map(([file]) => path.basename(file))
}

describe('API runtime catalog ownership', () => {
  it('removes diagnostic method catalogs from the browser API runtime', async () => {
    expect(await retainedCatalogs('../createWeapi.ts', ['createWeapi'])).toEqual([])
  })

  it('retains every platform catalog when support diagnostics are requested', async () => {
    const catalogs = await retainedCatalogs('./index.ts', ['validateSupportMatrixConsistency', 'generateApiSupportCoverageReport'])
    for (const platform of ['wx', 'my', 'tt']) {
      expect(catalogs.some(file => file.startsWith(`${platform}Methods`))).toBe(true)
    }
  })
})
