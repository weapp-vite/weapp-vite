import { originalPositionFor, TraceMap } from '@jridgewell/trace-mapping'
import { parse } from '@weapp-vite/ast/babel'
import { describe, expect, it } from 'vitest'
import { compileVueFile } from '../plugins/vue/transform/compileVueFile'
import { BABEL_TS_MODULE_PARSER_OPTIONS } from '../utils/babel'

const filename = '/project/src/pages/external/index.vue'
const externalFilename = '/project/src/scripts/setup.ts'

function compileExternal(content: string, isPage: boolean, normalScript = '') {
  return compileVueFile(`${normalScript}<template><local-card /></template><script setup lang="ts" src="../../scripts/setup.ts"></script>`, filename, {
    isPage,
    sourceMap: true,
    sfcSrc: {
      async resolveId() { return externalFilename },
      async readFile() { return content },
    },
  })
}

describe.each([true, false])('external script compile descriptor (isPage=%s)', (isPage) => {
  it.each(['', '\n', '\r\n', '\n// trailing comment', '\n// trailing comment\n'])('compiles import-only setup with ending %j', async (ending) => {
    const content = `import LocalCard from '../components/LocalCard.vue'${ending}`
    const result = await compileExternal(content, isPage)
    expect(() => parse(result.script!, BABEL_TS_MODULE_PARSER_OPTIONS)).not.toThrow()
    expect(result.script).toContain('../../components/LocalCard.vue')
    expect(result.scriptMap?.sources).toContain(externalFilename)
    expect(result.scriptMap?.sourcesContent).toContain(content)
  })

  it('compiles an empty external setup after its imports are removed', async () => {
    const result = await compileExternal('', isPage)
    expect(() => parse(result.script!, BABEL_TS_MODULE_PARSER_OPTIONS)).not.toThrow()
    expect(result.script).not.toContain('LocalCard')
  })

  it('keeps mixed script sources and maps the external binding to its source', async () => {
    const content = 'import LocalCard from \'../components/LocalCard.vue\'\nconst externalSentinel = \'external\'\ndefineExpose({ externalSentinel })\n'
    const normal = '<script lang="ts">export const inlineSentinel = "inline"</script>'
    const result = await compileExternal(content, isPage, normal)
    expect(() => parse(result.script!, BABEL_TS_MODULE_PARSER_OPTIONS)).not.toThrow()
    expect(result.script).toContain('inlineSentinel')
    const prefix = result.script!.slice(0, result.script!.indexOf('const externalSentinel')).split('\n')
    expect(originalPositionFor(new TraceMap(JSON.stringify(result.scriptMap)), {
      line: prefix.length,
      column: prefix.at(-1)!.length,
    })).toMatchObject({ source: externalFilename, line: 2, column: 0 })
  })

  it.each([false, true])('preserves module bindings across two external scripts (setupFirst=%s)', async (setupFirst) => {
    const normalFilename = '/project/src/scripts/normal.ts'
    const scripts = [
      '<script lang="ts" src="../../scripts/normal.ts"></script>',
      '<script setup lang="ts" src="../../scripts/setup.ts"></script>',
    ]
    if (setupFirst) {
      scripts.reverse()
    }
    const result = await compileVueFile(scripts.join('\r\n'), filename, {
      isPage,
      sfcSrc: {
        async resolveId(source) { return source.includes('normal') ? normalFilename : externalFilename },
        async readFile(source) {
          return source === normalFilename
            ? 'const require = (id: string) => id; export const sibling = \'normal\'; export default {}'
            : 'import LocalCard from \'../components/LocalCard.vue\'\nconst local = require(\'./opaque\')\ndefineExpose({ local, sibling, LocalCard })'
        },
      },
    })
    expect(() => parse(result.script!, BABEL_TS_MODULE_PARSER_OPTIONS)).not.toThrow()
    expect(result.script).toContain('./opaque')
    expect(result.script).toContain('../../components/LocalCard.vue')
    expect(result.scriptMap?.sources).toEqual(expect.arrayContaining([normalFilename, externalFilename]))
  })

  it.each([false, true])('keeps external normal and inline setup aligned through JSON/defineOptions transforms (sourceMap=%s)', async (sourceMap) => {
    const jsonMacro = isPage ? 'definePageJson' : 'defineComponentJson'
    const setup = `<script setup lang="ts">${jsonMacro}({ options: { virtualHost: true } }); defineOptions(() => ({ name: 'ExternalMixed' })); const inlineValue = 'inline'; defineExpose({ inlineValue, normalValue })</script>`
    const result = await compileVueFile(`${setup}<script lang="ts" src="../../scripts/setup.ts"></script>`, filename, {
      isPage,
      sourceMap,
      sfcSrc: {
        async resolveId() { return externalFilename },
        async readFile() { return 'export const normalValue = \'normal\'; export default {}' },
      },
    })
    expect(() => parse(result.script!, BABEL_TS_MODULE_PARSER_OPTIONS)).not.toThrow()
    expect(result.script).toContain('normalValue')
    expect(result.script).toContain('inlineValue')
    expect(JSON.parse(result.config!)).toMatchObject({ options: { virtualHost: true } })
    if (sourceMap) {
      expect(result.scriptMap?.sources).toEqual(expect.arrayContaining([filename, externalFilename]))
    }
    else {
      expect(result.scriptMap).toBeNull()
    }
  })
})

describe('external block dependency ownership', () => {
  it('separates script and template compile inputs from external styles', async () => {
    const files: Record<string, string> = {
      '/src/part.html': '<view>{{ caption }}</view>',
      '/src/setup.ts': 'const caption = \'external\'',
      '/src/normal.ts': 'export default {}',
      '/src/theme.css': 'view { color: red; }',
    }
    const result = await compileVueFile('<template src="./part.html"/><script src="./normal.ts"/><script setup src="./setup.ts"/><style src="./theme.css"/>', '/src/component.vue', {
      sfcSrc: {
        async resolveId(source) { return source.replace('./', '/src/') },
        async readFile(source) { return files[source]! },
      },
    })
    expect(result.meta?.sfcSrcDeps).toEqual(expect.arrayContaining(Object.keys(files)))
    expect(result.meta?.sfcSrcCompilationDeps).toEqual(['/src/part.html', '/src/normal.ts', '/src/setup.ts'])
  })
})
