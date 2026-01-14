import { compileVueTemplateToWxml } from '../../src/plugins/vue/compiler/template'

describe('Vue Advanced Features', () => {
  describe('Dynamic Components', () => {
    it('should compile <component :is>', () => {
      const result = compileVueTemplateToWxml(
        '<component :is="currentComponent" />',
        'test.vue',
      )
      expect(result.code).toContain('data-is="{{currentComponent}}"')
      expect(result.warnings.some(w => w.includes('动态组件'))).toBe(true)
    })

    it('should compile <component :is> with props', () => {
      const result = compileVueTemplateToWxml(
        '<component :is="type" :title="title" />',
        'test.vue',
      )
      expect(result.code).toContain('data-is="{{type}}"')
      expect(result.code).toContain('title="{{title}}"')
    })

    it('should warn about component without :is', () => {
      const result = compileVueTemplateToWxml(
        '<component />',
        'test.vue',
      )
      expect(result.warnings.some(w => w.includes('未提供 :is 绑定'))).toBe(true)
    })

    it('should compile <component :is> with children', () => {
      const result = compileVueTemplateToWxml(
        '<component :is="type"><view>Content</view></component>',
        'test.vue',
      )
      expect(result.code).toContain('data-is="{{type}}"')
      expect(result.code).toContain('Content')
    })
  })

  describe('Transition', () => {
    it('should render children of <transition>', () => {
      const result = compileVueTemplateToWxml(
        '<transition><view>Fade me</view></transition>',
        'test.vue',
      )
      expect(result.code).toContain('Fade me')
      expect(result.warnings.some(w => w.includes('transition'))).toBe(true)
    })

    it('should handle <transition> with multiple children', () => {
      const result = compileVueTemplateToWxml(
        '<transition><view>First</view><view>Second</view></transition>',
        'test.vue',
      )
      expect(result.code).toContain('First')
      expect(result.code).toContain('Second')
    })

    it('should handle <transition> with name prop', () => {
      const result = compileVueTemplateToWxml(
        '<transition name="fade"><view>Fade</view></transition>',
        'test.vue',
      )
      // name prop is not directly supported, but children should render
      expect(result.code).toContain('Fade')
    })
  })

  describe('KeepAlive', () => {
    it('should wrap children in block with data-keep-alive', () => {
      const result = compileVueTemplateToWxml(
        '<keep-alive><view>Persistent content</view></keep-alive>',
        'test.vue',
      )
      expect(result.code).toContain('data-keep-alive="true"')
      expect(result.code).toContain('Persistent content')
    })

    it('should warn about keep-alive requirements', () => {
      const result = compileVueTemplateToWxml(
        '<keep-alive><component :is="view" /></keep-alive>',
        'test.vue',
      )
      expect(result.warnings.some(w => w.includes('keep-alive'))).toBe(true)
    })

    it('should handle nested keep-alive', () => {
      const result = compileVueTemplateToWxml(
        '<keep-alive><keep-alive><view>Nested</view></keep-alive></keep-alive>',
        'test.vue',
      )
      expect(result.code).toContain('data-keep-alive="true"')
      expect(result.code).toContain('Nested')
    })
  })

  describe('Component + Transition', () => {
    it('should handle component inside transition', () => {
      const result = compileVueTemplateToWxml(
        '<transition><component :is="current" /></transition>',
        'test.vue',
      )
      expect(result.code).toContain('data-is="{{current}}"')
    })

    it('should handle transition inside keep-alive', () => {
      const result = compileVueTemplateToWxml(
        '<keep-alive><transition><view>Content</view></transition></keep-alive>',
        'test.vue',
      )
      expect(result.code).toContain('data-keep-alive="true"')
      expect(result.code).toContain('Content')
    })
  })
})
