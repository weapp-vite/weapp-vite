import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { describe, expect, it } from 'vitest'

const packageRoot = fileURLToPath(new URL('../', import.meta.url))
const targets = ['weapp', 'alipay', 'tt', 'swan', 'jd', 'xhs', 'web'] as const

describe.each(['production', 'development'] as const)('%s published platform tree-shaking', (mode) => {
  it.each(targets)('specializes %s after consuming the published ESM modules', async (platform) => {
    const entry = mode === 'development' ? './dist/dev/internal-runtime.mjs' : './dist/internal-runtime.mjs'
    const result = await build({
      stdin: {
        contents: `import { createWevuComponent } from ${JSON.stringify(entry)}; createWevuComponent({ setup() { return { value: 1 } } })`,
        resolveDir: packageRoot,
      },
      bundle: true,
      write: false,
      metafile: true,
      format: 'esm',
      platform: 'browser',
      // 发布 ESM 是中间产物；最终消费仍可降级到小程序要求的 ES2015。
      target: 'es2015',
      minify: true,
      logLevel: 'error',
      define: {
        'import.meta.env.PLATFORM': JSON.stringify(platform),
        'process.env.NODE_ENV': JSON.stringify(mode),
      },
    })
    const contributions = Object.values(result.metafile.outputs).flatMap(output => Object.entries(output.inputs)).filter(([, contribution]) => contribution.bytesInOutput > 0).map(([filename]) => filename.replace(/\\/g, '/'))
    const code = result.outputFiles[0]!.text

    expect(contributions.some(filename => filename.endsWith('/runtime/platform/generic.mjs'))).toBe(false)
    expect(contributions.some(filename => filename.endsWith('/platforms/descriptors.js'))).toBe(false)
    expect(contributions.some(filename => filename.endsWith('/platforms/runtime/helpers.js'))).toBe(false)
    expect(contributions.some(filename => filename.endsWith('/component/alipayRegistration.mjs'))).toBe(platform === 'alipay')
    expect(code.includes('project.config.json')).toBe(false)
    expect(code.includes('didMount')).toBe(platform === 'alipay')
  })
})
