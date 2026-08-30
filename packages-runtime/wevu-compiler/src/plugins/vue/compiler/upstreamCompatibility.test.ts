import type { RootNode } from '@vue/compiler-core'
import { NodeTypes } from '@vue/compiler-core'
import { parse } from '@vue/compiler-dom'
import { describe, expect, it } from 'vitest'
import { compileVueTemplateToWxml } from './template'
import {
  VUE_UPSTREAM_COMPATIBILITY_CASES,
  VUE_UPSTREAM_COMPATIBILITY_SOURCE,
} from './upstreamCompatibility'

function collectOfficialTemplateShape(ast: RootNode, source: string) {
  const tags: string[] = []
  const directives: string[] = []
  const visit = (node: any) => {
    if (node.type === NodeTypes.ELEMENT) {
      tags.push(node.tag)
      expect(node.loc.start.offset).toBeGreaterThanOrEqual(0)
      expect(node.loc.end.offset).toBeLessThanOrEqual(source.length)
      expect(source.slice(node.loc.start.offset, node.loc.end.offset)).not.toBe('')
      for (const prop of node.props) {
        expect(prop.loc.start.offset).toBeGreaterThanOrEqual(node.loc.start.offset)
        expect(prop.loc.end.offset).toBeLessThanOrEqual(node.loc.end.offset)
        if (prop.type === NodeTypes.DIRECTIVE) {
          directives.push(prop.name)
        }
      }
    }
    for (const child of node.children ?? []) {
      visit(child)
    }
  }
  visit(ast)
  return { tags, directives }
}

describe('Vue 3.5.42 official compiler compatibility matrix', () => {
  it('pins the upstream source and keeps categories unique', () => {
    expect(VUE_UPSTREAM_COMPATIBILITY_SOURCE).toEqual({
      repository: 'vuejs/core',
      tag: 'v3.5.42',
      license: 'MIT',
      packages: ['@vue/compiler-dom', '@vue/compiler-sfc'],
    })
    const categories = VUE_UPSTREAM_COMPATIBILITY_CASES.map(item => item.category)
    expect(new Set(categories).size).toBe(categories.length)
  })

  it.each(VUE_UPSTREAM_COMPATIBILITY_CASES)(
    'keeps $category aligned with official parse semantics and WXML invariants',
    (fixture) => {
      const parseErrors: Error[] = []
      const ast = parse(fixture.source, {
        onError: error => parseErrors.push(error),
      })
      const shape = collectOfficialTemplateShape(ast, fixture.source)
      const compiled = compileVueTemplateToWxml(
        fixture.source,
        `/project/src/upstream/${fixture.category}.vue`,
      )

      expect(parseErrors).toEqual([])
      expect(shape.tags).toEqual(fixture.tags)
      expect(shape.directives).toEqual(fixture.directives)
      for (const expected of fixture.wxmlIncludes) {
        expect(compiled.code).toContain(expected)
      }
      expect(compiled.diagnostics.map(diagnostic => diagnostic.code)).toEqual(fixture.diagnosticCodes ?? [])
    },
  )
})
