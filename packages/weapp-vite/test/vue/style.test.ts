import { compileVueStyleToWxss } from '../../src/plugins/vue/compiler/style'

describe('Vue Style Compiler', () => {
  describe('Basic Style Conversion', () => {
    it('should convert simple CSS to WXSS', () => {
      const styleBlock = {
        content: '.container { color: red; }',
        scoped: false,
        module: false,
      }
      const result = compileVueStyleToWxss(styleBlock, { id: 'test' })
      expect(result.code).toContain('.container')
      expect(result.code).toContain('color: red')
    })

    it('should handle multiple selectors', () => {
      const styleBlock = {
        content: `
.title { font-size: 16px; }
.content { color: blue; }
        `.trim(),
        scoped: false,
        module: false,
      }
      const result = compileVueStyleToWxss(styleBlock, { id: 'test' })
      expect(result.code).toContain('.title')
      expect(result.code).toContain('.content')
    })
  })

  describe('Unit Conversion', () => {
    it('should keep rem as-is', () => {
      const styleBlock = {
        content: '.box { width: 2rem; }',
        scoped: false,
        module: false,
      }
      const result = compileVueStyleToWxss(styleBlock, { id: 'test' })
      expect(result.code).toContain('2rem')
    })

    it('should keep vw as-is', () => {
      const styleBlock = {
        content: '.box { width: 50vw; }',
        scoped: false,
        module: false,
      }
      const result = compileVueStyleToWxss(styleBlock, { id: 'test' })
      expect(result.code).toContain('50vw')
    })

    it('should keep vh as-is', () => {
      const styleBlock = {
        content: '.box { height: 100vh; }',
        scoped: false,
        module: false,
      }
      const result = compileVueStyleToWxss(styleBlock, { id: 'test' })
      expect(result.code).toContain('100vh')
    })
  })

  describe('Scoped CSS', () => {
    it('should add scoped attribute to selectors', () => {
      const styleBlock = {
        content: '.container { color: red; }',
        scoped: true,
        module: false,
      }
      const result = compileVueStyleToWxss(styleBlock, { id: 'abc123' })
      expect(result.code).toContain('[data-v-abc123]')
    })

    it('should handle multiple scoped selectors', () => {
      const styleBlock = {
        content: `
.title { font-size: 16px; }
.content { color: blue; }
        `.trim(),
        scoped: true,
        module: false,
      }
      const result = compileVueStyleToWxss(styleBlock, { id: 'test' })
      expect(result.code).toMatch(/\[data-v-test\]/g)
    })
  })

  describe('CSS Modules', () => {
    it('should transform class names in modules mode', () => {
      const styleBlock = {
        content: `
.container { display: flex; }
.title { font-size: 16px; }
        `.trim(),
        scoped: false,
        module: true,
      }
      const result = compileVueStyleToWxss(styleBlock, { id: 'test' })
      expect(result.modules).toBeDefined()
      // CSS modules are wrapped in a module name
      const modules = result.modules?.$style || result.modules
      expect(modules.container).toMatch(/container_\w+/)
      expect(modules.title).toMatch(/title_\w+/)
    })

    it('should generate unique class names', () => {
      const styleBlock = {
        content: '.box { width: 100px; }',
        scoped: false,
        module: true,
      }
      const result1 = compileVueStyleToWxss(styleBlock, { id: 'test1' })
      const result2 = compileVueStyleToWxss(styleBlock, { id: 'test2' })
      const modules1 = result1.modules?.$style || result1.modules
      const modules2 = result2.modules?.$style || result2.modules
      expect(modules1.box).not.toBe(modules2.box)
    })

    it('should transform class names in compiled code', () => {
      const styleBlock = {
        content: '.myClass { color: red; }',
        scoped: false,
        module: true,
      }
      const result = compileVueStyleToWxss(styleBlock, { id: 'test' })
      expect(result.code).toContain('.myClass_')
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty styles', () => {
      const styleBlock = {
        content: '',
        scoped: false,
        module: false,
      }
      const result = compileVueStyleToWxss(styleBlock, { id: 'test' })
      expect(result.code).toBe('')
    })

    it('should handle comments', () => {
      const styleBlock = {
        content: `
/* This is a comment */
.box { width: 100px; }
        `.trim(),
        scoped: false,
        module: false,
      }
      const result = compileVueStyleToWxss(styleBlock, { id: 'test' })
      expect(result.code).toContain('/*')
    })

    it('should handle @media queries', () => {
      const styleBlock = {
        content: `
@media (min-width: 768px) {
  .box { width: 100%; }
}
        `.trim(),
        scoped: false,
        module: false,
      }
      const result = compileVueStyleToWxss(styleBlock, { id: 'test' })
      expect(result.code).toContain('@media')
    })
  })
})
