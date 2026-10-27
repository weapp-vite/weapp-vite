import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { parseJsLike } from '../../../../../utils/babel'
import { compileVueFile } from '../index'
import { resolveSetupPropConflicts } from './index'

describe('standalone props source reads', () => {
  it('uses the rebased import origin of an external setup script', async () => {
    const filename = path.resolve('src/external-navigation.vue')
    const setupFile = path.resolve('src/scripts/setup.ts')
    const propsFile = path.resolve('src/scripts/props.ts')
    const files = new Map([
      [setupFile, `import { computed } from 'wevu'
import { navigationProps } from './props'
const props = defineProps(navigationProps)
const haveNext = computed(() => props.max > 1)`],
      [propsFile, 'export const navigationProps = Object.freeze({ max: Number })'],
    ])
    const result = await compileVueFile('<script setup src="./scripts/setup.ts" lang="ts"></script><template><button :disabled="!haveNext" /></template>', filename, {
      sfcSrc: {
        resolveId: async (source, importer = filename) => {
          const id = path.resolve(path.dirname(importer), source)
          return [id, `${id}.ts`].find(candidate => files.has(candidate))
        },
        readFile: async (id) => {
          const source = files.get(id)
          if (source === undefined) {
            throw new Error('Unexpected analysis source')
          }
          return source
        },
      },
    })
    expect(result.template).toContain('disabled="{{!haveNext}}"')
    expect(result.meta?.propsAnalysisDeps).toContain(propsFile)
    expect(result.meta?.sfcSrcCompilationDeps).toContain(setupFile)
  })

  it('keeps missing default-reader candidates and discovers a subsequently created module', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'wevu-props-analysis-'))
    try {
      const script = 'import { props } from "./props"; export default { props: props }'
      const analyze = () => resolveSetupPropConflicts({
        script,
        bindings: { haveNext: 'setup-ref' },
        getScriptAst: () => parseJsLike(script),
        filename: path.join(root, 'navigation.vue'),
        source: { checkMtime: true },
      })
      const missing = await analyze()
      expect(missing.conflicts).toEqual(['haveNext'])
      expect(missing.dependencies).toContain(path.join(root, 'props.ts'))
      await writeFile(path.join(root, 'props.ts'), 'export const props = Object.freeze({ max: Number })')
      expect((await analyze()).conflicts).toEqual([])
      await rm(path.join(root, 'props.ts'))
      expect((await analyze()).conflicts).toEqual(['haveNext'])
      await writeFile(path.join(root, 'props.ts'), 'export const props = Object.freeze({ haveNext: Boolean })')
      expect((await analyze()).conflicts).toEqual(['haveNext'])
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
