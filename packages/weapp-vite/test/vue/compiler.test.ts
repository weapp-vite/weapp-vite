import { compileVueTemplateToWxml } from '../../src/plugins/vue/compiler/template'

describe('Vue Template Compiler', () => {
  describe('Structural Directives', () => {
    it('should compile v-if to wx:if', () => {
      const result = compileVueTemplateToWxml(
        '<view v-if="visible">Show me</view>',
        'test.vue',
      )
      expect(result.code).toContain('wx:if="{{visible}}"')
    })

    it('should compile v-for to wx:for', () => {
      const result = compileVueTemplateToWxml(
        '<view v-for="item in items" :key="item.id">{{ item.name }}</view>',
        'test.vue',
      )
      expect(result.code).toContain('wx:for="{{items}}"')
      expect(result.code).toContain('wx:for-item="item"')
    })
  })

  describe('Template literal normalization', () => {
    it('should support template literals in attribute bindings', () => {
      /* eslint-disable no-template-curly-in-string -- test fixture contains Vue template literal for runtime output */
      const templateWithLiteral = '<native-badge :text="`状态：${currentType}`" :type="currentType" />'
      const result = compileVueTemplateToWxml(
        templateWithLiteral,
        'test.vue',
      )
      const normalized = result.code.replace('\\u72b6\\u6001\\uff1a', '状态：')
      expect(normalized).toMatch(/text="\{\{[^}]*\+currentType\}\}"/)
      expect(normalized).toContain('type="{{currentType}}"')
    })

    it('should normalize nested template literals inside interpolation', () => {
      const templateWithNested = '<view>{{ `Hello ${who}, number ${`${n}`}` }}</view>'
      /* eslint-enable no-template-curly-in-string */
      const result = compileVueTemplateToWxml(
        templateWithNested,
        'test.vue',
      )
      const normalized = result.code.replace('\\u0048\\u0065\\u006c\\u006c\\u006f', 'Hello')
      expect(normalized).toContain('{{\'Hello \'+who+\', number \'+n}}')
    })

    it('should normalize template literals inside conditional expressions', () => {
      /* eslint-disable no-template-curly-in-string -- test fixture contains Vue template literal for runtime output */
      const templateWithConditional = '<view>{{ hasSubtitle ? \'已同步\' : `仅标题 ${title.length}` }}</view>'
      /* eslint-enable no-template-curly-in-string */
      const result = compileVueTemplateToWxml(
        templateWithConditional,
        'test.vue',
      )
      expect(result.code).not.toContain('`')
      expect(result.code).toContain('{{hasSubtitle?\'已同步\':\'仅标题 \'+title.length}}')
    })
  })

  describe('Text escaping', () => {
    it('should escape decoded angle brackets in text nodes for WXML', () => {
      const result = compileVueTemplateToWxml(
        '<text>&lt;script setup&gt; &amp; &lt;config&gt;</text>',
        'test.vue',
      )
      expect(result.code).toContain('&lt;script setup&gt; &amp; &lt;config&gt;')
      expect(result.code).not.toContain('<script setup>')
    })
  })

  describe('Attribute Bindings', () => {
    it('should compile v-bind to attribute binding', () => {
      const result = compileVueTemplateToWxml(
        '<view :class="className">Hello</view>',
        'test.vue',
      )
      expect(result.code).toContain('class="{{__wv_cls_0}}"')
      expect(result.classStyleRuntime).toBe('js')
      expect(result.classStyleBindings?.length).toBe(1)
    })

    it('should compile v-text to element children interpolation', () => {
      const result = compileVueTemplateToWxml(
        `<text v-text="'hello'"></text>`,
        'test.vue',
      )
      expect(result.code).toContain('<text>{{\'hello\'}}</text>')
    })

    it('should normalize :class array/object to WXML-safe expression', () => {
      const result = compileVueTemplateToWxml(
        `<view class="card" :class="[active ? 'active' : 'inactive', $style.moduleBox, { [$style.highlight]: highlight }]" />`,
        'test.vue',
      )
      expect(result.code).toContain('class="{{__wv_cls_0}}"')
      expect(result.classStyleRuntime).toBe('js')
      expect(result.classStyleBindings?.length).toBe(1)
      const binding = result.classStyleBindings?.[0]
      expect(binding?.exp).toContain('card')
      expect(binding?.expAst).toBeTruthy()
    })

    it('should compile interpolation', () => {
      const result = compileVueTemplateToWxml(
        '<view>{{ message }}</view>',
        'test.vue',
      )
      expect(result.code).toContain('{{message}}')
    })
  })

  describe('Event Handlers', () => {
    it('should compile @click to bindtap', () => {
      const result = compileVueTemplateToWxml(
        '<button @click="handleClick">Click me</button>',
        'test.vue',
      )
      expect(result.code).toContain('bindtap="handleClick"')
    })
  })

  describe('v-model - Text Input', () => {
    it('should compile v-model on input (default text)', () => {
      const result = compileVueTemplateToWxml(
        '<input v-model="value" />',
        'test.vue',
      )
      expect(result.code).toContain('value="{{value}}"')
      expect(result.code).toContain('bindinput="__weapp_vite_model"')
      expect(result.code).toContain('data-wv-model="value"')
    })

    it('should compile v-model on input with explicit type text', () => {
      const result = compileVueTemplateToWxml(
        '<input type="text" v-model="text" />',
        'test.vue',
      )
      expect(result.code).toContain('value="{{text}}"')
      expect(result.code).toContain('bindinput="__weapp_vite_model"')
      expect(result.code).toContain('data-wv-model="text"')
    })
  })

  describe('v-model - Checkbox', () => {
    it('should compile v-model on input type checkbox', () => {
      const result = compileVueTemplateToWxml(
        '<input type="checkbox" v-model="checked" />',
        'test.vue',
      )
      expect(result.code).toContain('checked="{{checked}}"')
      expect(result.code).toContain('bindchange="__weapp_vite_model"')
      expect(result.code).toContain('data-wv-model="checked"')
    })

    it('should compile v-model on checkbox element', () => {
      const result = compileVueTemplateToWxml(
        '<checkbox v-model="agreed" />',
        'test.vue',
      )
      expect(result.code).toContain('checked="{{agreed}}"')
      expect(result.code).toContain('bindchange="__weapp_vite_model"')
      expect(result.code).toContain('data-wv-model="agreed"')
    })
  })

  describe('v-model - Radio', () => {
    it('should compile v-model on input type radio', () => {
      const result = compileVueTemplateToWxml(
        '<input type="radio" v-model="selected" />',
        'test.vue',
      )
      expect(result.code).toContain('value="{{selected}}"')
      expect(result.code).toContain('bindchange="__weapp_vite_model"')
      expect(result.code).toContain('data-wv-model="selected"')
    })
  })

  describe('v-model - Other Elements', () => {
    it('should compile v-model on textarea', () => {
      const result = compileVueTemplateToWxml(
        '<textarea v-model="content" />',
        'test.vue',
      )
      expect(result.code).toContain('value="{{content}}"')
      expect(result.code).toContain('bindinput="__weapp_vite_model"')
      expect(result.code).toContain('data-wv-model="content"')
    })

    it('should compile v-model on select', () => {
      const result = compileVueTemplateToWxml(
        '<select v-model="selected" />',
        'test.vue',
      )
      expect(result.code).toContain('value="{{selected}}"')
      expect(result.code).toContain('bindchange="__weapp_vite_model"')
      expect(result.code).toContain('data-wv-model="selected"')
    })

    it('should compile v-model on switch', () => {
      const result = compileVueTemplateToWxml(
        '<switch v-model="enabled" />',
        'test.vue',
      )
      expect(result.code).toContain('checked="{{enabled}}"')
      expect(result.code).toContain('bindchange="__weapp_vite_model"')
      expect(result.code).toContain('data-wv-model="enabled"')
    })

    it('should compile v-model on slider', () => {
      const result = compileVueTemplateToWxml(
        '<slider v-model="progress" />',
        'test.vue',
      )
      expect(result.code).toContain('value="{{progress}}"')
      expect(result.code).toContain('bindchange="__weapp_vite_model"')
      expect(result.code).toContain('data-wv-model="progress"')
    })

    it('should compile v-model on picker', () => {
      const result = compileVueTemplateToWxml(
        '<picker v-model="date" />',
        'test.vue',
      )
      expect(result.code).toContain('value="{{date}}"')
      expect(result.code).toContain('bindchange="__weapp_vite_model"')
      expect(result.code).toContain('data-wv-model="date"')
    })
  })

  describe('Slots', () => {
    it('should compile default slot', () => {
      const result = compileVueTemplateToWxml(
        '<slot></slot>',
        'test.vue',
      )
      expect(result.code).toContain('<slot />')
    })

    it('should emit scoped slot placeholder for plain slot', () => {
      const result = compileVueTemplateToWxml(
        '<slot></slot>',
        'test.vue',
      )
      expect(result.code).toContain('scoped-slots-default')
      expect(result.code).toContain('__wv-slot-props')
      expect(result.componentGenerics?.['scoped-slots-default']).toBe(true)
    })

    it('should compile named slot', () => {
      const result = compileVueTemplateToWxml(
        '<slot name="header"></slot>',
        'test.vue',
      )
      expect(result.code).toContain('name="header"')
    })

    it('should compile slot with fallback content', () => {
      const result = compileVueTemplateToWxml(
        '<slot><view>Fallback content</view></slot>',
        'test.vue',
      )
      expect(result.code).toContain('<slot>')
      expect(result.code).toContain('Fallback content')
    })

    it('should compile scoped slot provider bindings', () => {
      const result = compileVueTemplateToWxml(
        '<slot :data="slotProps"></slot>',
        'test.vue',
      )
      expect(result.code).toContain('<slot')
      expect(result.code).toContain('scoped-slots-default')
      expect(result.code).toContain('__wv-slot-props')
      expect(result.componentGenerics?.['scoped-slots-default']).toBe(true)
    })
  })

  describe('Template Slots', () => {
    it('should warn for template v-slot outside component', () => {
      const result = compileVueTemplateToWxml(
        '<template v-slot:header><view>Header content</view></template>',
        'test.vue',
      )
      expect(result.warnings.some(warning => warning.includes('template v-slot'))).toBe(true)
      expect(result.code).toContain('Header content')
    })

    it('should compile component v-slot for default slot', () => {
      const result = compileVueTemplateToWxml(
        '<my-comp v-slot="{ item }"><view>{{ item }} {{ foo }}</view></my-comp>',
        'test.vue',
      )
      expect(result.scopedSlotComponents).toHaveLength(1)
      const slotComp = result.scopedSlotComponents?.[0]
      expect(slotComp).toBeDefined()
      expect(result.code).toContain(`generic:scoped-slots-default="${slotComp?.componentName}"`)
      expect(result.code).toContain('vue-slots="{{[\'default\']}}"')
      expect(result.code).toContain('__wv-slot-owner-id="{{__wvOwnerId || \'\'}}"')
      expect(slotComp?.template).toContain('{{__wvSlotPropsData.item}}')
      expect(slotComp?.template).toContain('{{__wvOwner.foo}}')
    })

    it('should compile template v-slot for named slot on component', () => {
      const result = compileVueTemplateToWxml(
        '<my-comp><template v-slot:header="{ title }"><view>{{ title }}</view></template></my-comp>',
        'test.vue',
      )
      expect(result.scopedSlotComponents).toHaveLength(1)
      const slotComp = result.scopedSlotComponents?.[0]
      expect(slotComp?.slotKey).toBe('header')
      expect(result.code).toContain(`generic:scoped-slots-header="${slotComp?.componentName}"`)
      expect(result.code).toContain('vue-slots="{{[\'header\']}}"')
      expect(slotComp?.template).toContain('{{__wvSlotPropsData.title}}')
    })

    it('should compile component v-slot with dynamic slot name', () => {
      const result = compileVueTemplateToWxml(
        '<my-comp v-slot:[slotName]="{ item }"><view>{{ item }}</view></my-comp>',
        'test.vue',
      )
      expect(result.scopedSlotComponents).toHaveLength(1)
      const slotComp = result.scopedSlotComponents?.[0]
      expect(slotComp?.slotKey.startsWith('dyn-')).toBe(true)
      expect(result.code).toContain(`generic:scoped-slots-${slotComp?.slotKey}`)
      expect(result.code).toContain('vue-slots="{{[slotName]}}"')
      expect(result.warnings.some(warning => warning.includes('动态插槽名'))).toBe(true)
    })

    it('should pass v-for scope into slot component', () => {
      const result = compileVueTemplateToWxml(
        '<my-comp v-for="item in items" v-slot="{ foo }"><view>{{ item }} {{ foo }}</view></my-comp>',
        'test.vue',
      )
      const normalized = result.code.replace(/\s/g, '')
      expect(normalized).toContain('__wv-slot-scope="{{[\'item\',item,\'__wv_index_0\',__wv_index_0]}}"')
      const slotComp = result.scopedSlotComponents?.[0]
      expect(slotComp?.template).toContain('{{__wvSlotPropsData.item}}')
      expect(slotComp?.template).toContain('{{__wvSlotPropsData.foo}}')
    })

    it('should drop plain template wrapper with no directives/attrs', () => {
      const result = compileVueTemplateToWxml(
        '<view><template><text>Inner</text></template></view>',
        'test.vue',
      )
      expect(result.code).toContain('<view><text>Inner</text></view>')
      expect(result.code).not.toContain('<template>')
    })

    it('should convert template v-if chain to block for mini-programs', () => {
      const result = compileVueTemplateToWxml(
        '<template v-if="ok"><view>OK</view></template><template v-else><view>NO</view></template>',
        'test.vue',
      )
      expect(result.code).toContain('<block wx:if="{{ok}}"><view>OK</view></block>')
      expect(result.code).toContain('<block wx:else><view>NO</view></block>')
      expect(result.code).not.toContain('<template v-if')
    })

    it('should keep template when name/is/data is present', () => {
      const result = compileVueTemplateToWxml(
        '<template name="cell"><view>Cell</view></template>',
        'test.vue',
      )
      expect(result.code).toContain('<template name="cell">')
      expect(result.code).toContain('Cell')
    })

    it('should keep template when is attribute is present', () => {
      const result = compileVueTemplateToWxml(
        '<template is="foo"><view>bar</view></template>',
        'test.vue',
      )
      expect(result.code).toContain('<template is="foo">')
      expect(result.code).toContain('bar')
    })

    it('should convert template v-for to block with wx:for', () => {
      const result = compileVueTemplateToWxml(
        '<template v-for="item in items"><view>{{ item }}</view></template>',
        'test.vue',
      )
      expect(result.code).toContain('<block wx:for="{{items}}" wx:for-item="item" wx:for-index="__wv_index_0">')
      expect(result.code).not.toContain('<template')
    })

    it('should convert template v-else-if/v-else chain to block with children only once', () => {
      const result = compileVueTemplateToWxml(
        '<template v-else-if="other"><view>ElseIf</view></template><template v-else><view>Else</view></template>',
        'test.vue',
      )
      expect(result.code).toContain('<block wx:elif="{{other}}"><view>ElseIf</view></block>')
      expect(result.code).toContain('<block wx:else><view>Else</view></block>')
      expect(result.code).not.toContain('<template v-else')
    })

    it('should convert template with other directives to block', () => {
      const result = compileVueTemplateToWxml(
        '<template @click="tap"><text>Click</text></template>',
        'test.vue',
      )
      expect(result.code).toContain('<block bindtap="tap"><text>Click</text></block>')
      expect(result.code).not.toContain('<template')
    })
  })

  describe('Custom Directives', () => {
    it('should compile custom directive with expression', () => {
      const result = compileVueTemplateToWxml(
        '<view v-color="activeColor">Custom directive</view>',
        'test.vue',
      )
      expect(result.code).toContain('data-v-color="{{activeColor}}"')
    })

    it('should compile custom directive with argument', () => {
      const result = compileVueTemplateToWxml(
        '<view v-custom:red>Custom directive with arg</view>',
        'test.vue',
      )
      expect(result.code).toContain('data-v-custom="red"')
    })

    it('should compile custom directive with complex expression', () => {
      const result = compileVueTemplateToWxml(
        '<view v-style="color + \'red\'">Complex expression</view>',
        'test.vue',
      )
      expect(result.code).toContain('data-v-style="{{color + \'red\'}}"')
    })

    it('should warn about custom directives', () => {
      const result = compileVueTemplateToWxml(
        '<view v-tooltip>Show tooltip</view>',
        'test.vue',
      )
      expect(result.code).toContain('data-v-tooltip')
      expect(result.warnings.some(w => w.includes('v-tooltip'))).toBe(true)
    })

    it('should ignore v-cloak', () => {
      const result = compileVueTemplateToWxml(
        '<view v-cloak>Content</view>',
        'test.vue',
      )
      expect(result.code).not.toContain('v-cloak')
      expect(result.code).not.toContain('data-v-cloak')
    })

    it('should warn about v-once', () => {
      const result = compileVueTemplateToWxml(
        '<view v-once>Once only</view>',
        'test.vue',
      )
      expect(result.warnings.some(w => w.includes('v-once'))).toBe(true)
    })

    it('should handle v-pre (content is preserved as-is)', () => {
      const result = compileVueTemplateToWxml(
        '<view v-pre>{{ raw }}</view>',
        'test.vue',
      )
      // v-pre is handled at parse time by Vue, the content is preserved as plain text
      expect(result.code).toContain('{{ raw }}')
    })
  })

  describe('Other Features', () => {
    it('should compile nested elements', () => {
      const result = compileVueTemplateToWxml(
        '<view class="outer"><view class="inner">Hello</view></view>',
        'test.vue',
      )
      expect(result.code).toContain('<view class="outer">')
      expect(result.code).toContain('<view class="inner">')
      expect(result.code).toContain('Hello')
    })

    it('should keep unicode characters in generated expressions', () => {
      const result = compileVueTemplateToWxml(
        // eslint-disable-next-line no-template-curly-in-string
        '<view :title="`Checklist（已完成 ${count}/3）`" />',
        'test.vue',
      )
      expect(result.code).toContain('Checklist（已完成 ')
      expect(result.code).not.toContain('\\uFF08')
      expect(result.code).not.toContain('\\u5DF2')
    })
  })

  describe('Edge Cases', () => {
    it('should handle v-else-if correctly', () => {
      const result = compileVueTemplateToWxml(
        '<view v-else-if="condition">Else if content</view>',
        'test.vue',
      )
      expect(result.code).toContain('wx:elif="{{condition}}"')
    })

    it('should handle v-else correctly', () => {
      const result = compileVueTemplateToWxml(
        '<view v-else>Else content</view>',
        'test.vue',
      )
      expect(result.code).toContain('wx:else>')
    })

    it('should handle v-for with complex expression (item, key, index)', () => {
      const result = compileVueTemplateToWxml(
        '<view v-for="(item, key, index) in object" :key="index">{{ item }}</view>',
        'test.vue',
      )
      expect(result.code).toContain('wx:for="{{object}}"')
      expect(result.code).toContain('wx:for-item="item"')
      expect(result.code).toContain('wx:for-index="index"')
    })

    it('should handle v-for with (item, index) syntax', () => {
      const result = compileVueTemplateToWxml(
        '<view v-for="(item, index) in items" :key="index">{{ item }}</view>',
        'test.vue',
      )
      expect(result.code).toContain('wx:for="{{items}}"')
      expect(result.code).toContain('wx:for-item="item"')
      expect(result.code).toContain('wx:for-index="index"')
    })

    it('should map :key bound to item to "*this" in wx:key', () => {
      const result = compileVueTemplateToWxml(
        '<view v-for="item in items" :key="item">{{ item }}</view>',
        'test.vue',
      )
      expect(result.code).toContain('wx:for="{{items}}"')
      expect(result.code).toContain('wx:for-item="item"')
      expect(result.code).toContain('wx:key="*this"')
    })

    it('should map :key bound to v-for key alias to "*this"', () => {
      const result = compileVueTemplateToWxml(
        '<view v-for="(item, key, index) in items" :key="key">{{ item }}</view>',
        'test.vue',
      )
      expect(result.code).toContain('wx:for="{{items}}"')
      expect(result.code).toContain('wx:for-item="item"')
      expect(result.code).toContain('wx:for-index="index"')
      expect(result.code).toContain('wx:key="*this"')
    })

    it('should keep custom key expressions unchanged', () => {
      const result = compileVueTemplateToWxml(
        '<view v-for="item in items" :key="item.id">{{ item }}</view>',
        'test.vue',
      )
      expect(result.code).toContain('wx:key="id"')
    })

    it('should fall back to "*this" for complex :key expressions', () => {
      const result = compileVueTemplateToWxml(
        '<view v-for="item in items" :key="item.key ?? item.title">{{ item }}</view>',
        'test.vue',
      )
      expect(result.code).toContain('wx:key="*this"')
    })

    it('should handle element with multiple directives', () => {
      const result = compileVueTemplateToWxml(
        '<view v-if="visible" :class="className" @click="handleClick">Multi directive</view>',
        'test.vue',
      )
      expect(result.code).toContain('wx:if="{{visible}}"')
      expect(result.code).toContain('class="{{__wv_cls_0}}"')
      expect(result.code).toContain('bindtap="handleClick"')
    })

    it('should handle empty template', () => {
      const result = compileVueTemplateToWxml('', 'test.vue')
      expect(result.code).toBe('')
    })

    it('should handle plain text only', () => {
      const result = compileVueTemplateToWxml('Plain text content', 'test.vue')
      expect(result.code).toBe('Plain text content')
    })

    it('should handle malformed v-for gracefully', () => {
      const result = compileVueTemplateToWxml(
        '<view v-for="invalidSyntax">{{ item }}</view>',
        'test.vue',
      )
      // Should still compile, but might not have wx:for attributes
      expect(result.code).toBeDefined()
    })

    it('should handle v-show with style attribute', () => {
      const result = compileVueTemplateToWxml(
        '<view v-show="isVisible">Show or hide</view>',
        'test.vue',
      )
      expect(result.code).toContain('style=')
    })

    it('should handle comments (should be removed)', () => {
      const result = compileVueTemplateToWxml(
        '<view><!-- This is a comment -->Content</view>',
        'test.vue',
      )
      expect(result.code).not.toContain('<!--')
      expect(result.code).toContain('Content')
    })
  })

  describe('Vue 3 Syntax Support', () => {
    it('should compile :key to wx:key without {{ }}', () => {
      const result = compileVueTemplateToWxml(
        '<view v-for="item in items" :key="item.id">{{ item.name }}</view>',
        'test.vue',
      )
      expect(result.code).toContain('wx:key="id"')
      expect(result.code).not.toContain('wx:key="{{')
    })

    it('should compile :key with index', () => {
      const result = compileVueTemplateToWxml(
        '<view v-for="(item, index) in items" :key="index">{{ item.name }}</view>',
        'test.vue',
      )
      expect(result.code).toContain('wx:key="index"')
      expect(result.code).not.toContain('wx:key="{{')
    })

    it('should compile @click to bindtap', () => {
      const result = compileVueTemplateToWxml(
        '<button @click="handleClick">Click me</button>',
        'test.vue',
      )
      expect(result.code).toContain('bindtap="handleClick"')
    })

    it('should compile @input to bindinput', () => {
      const result = compileVueTemplateToWxml(
        '<input @input="handleInput" />',
        'test.vue',
      )
      expect(result.code).toContain('bindinput="handleInput"')
    })

    it('should compile @change to bindchange', () => {
      const result = compileVueTemplateToWxml(
        '<checkbox @change="handleChange" />',
        'test.vue',
      )
      expect(result.code).toContain('bindchange="handleChange"')
    })

    it('should compile complex Vue 3 template with multiple directives', () => {
      const result = compileVueTemplateToWxml(
        `<view v-for="(item, index) in items" :key="item.id" :class="itemClass" @click="selectItem(item)">
          {{ item.name }}
        </view>`,
        'test.vue',
      )
      expect(result.code).toContain('wx:for="{{items}}"')
      expect(result.code).toContain('wx:for-item="item"')
      expect(result.code).toContain('wx:for-index="index"')
      expect(result.code).toContain('wx:key="id"')
      expect(result.code).toContain('class="{{__wv_cls_0[index]}}"')
      expect(result.code).toContain('data-wv-inline="selectItem(item)"')
      expect(result.code).toContain('bindtap="__weapp_vite_inline"')
    })

    it('should support v-bind shorthand for data attributes', () => {
      const result = compileVueTemplateToWxml(
        '<view :data-id="item.id" :data-name="item.name">Item</view>',
        'test.vue',
      )
      expect(result.code).toContain('data-id="{{item.id}}"')
      expect(result.code).toContain('data-name="{{item.name}}"')
    })

    it('should compile inline @click expression with $event to inline handler', () => {
      const result = compileVueTemplateToWxml(
        '<button @click="handle(\'ok\', $event)">Click</button>',
        'test.vue',
      )
      expect(result.code).toContain('data-wv-handler="handle"')
      expect(result.code).toContain('data-wv-args="[&quot;ok&quot;,&quot;$event&quot;]"')
      expect(result.code).toContain('bindtap="__weapp_vite_inline"')
    })

    it('should keep simple @click as direct handler without inline wrapper', () => {
      const result = compileVueTemplateToWxml(
        '<button @click="handleClick">Click</button>',
        'test.vue',
      )
      expect(result.code).toContain('bindtap="handleClick"')
      expect(result.code).not.toContain('__weapp_vite_inline')
    })

    it('should fallback to data-wv-inline when inline expression is not parseable', () => {
      const result = compileVueTemplateToWxml(
        '<button @click="call(fn)">Click</button>',
        'test.vue',
      )
      expect(result.code).toContain('data-wv-inline="call(fn)"')
      expect(result.code).toContain('bindtap="__weapp_vite_inline"')
    })

    it('should return original template with warning when unexpected error happens', () => {
      // @ts-expect-error intentionally pass non-string to hit catch branch
      const result = compileVueTemplateToWxml(undefined, 'test.vue')
      expect(result.code).toBeUndefined()
      expect(result.warnings.length).toBeGreaterThan(0)
    })

    it('should ignore v-if without expression and render normally', () => {
      const result = compileVueTemplateToWxml(
        '<view v-if>Empty if</view>',
        'test.vue',
      )
      expect(result.code).toContain('<view>Empty if</view>')
      expect(result.code).not.toContain('wx:if')
    })

    it('should ignore v-for without expression and render normally', () => {
      const result = compileVueTemplateToWxml(
        '<view v-for>Empty for</view>',
        'test.vue',
      )
      expect(result.code).toContain('<view>Empty for</view>')
      expect(result.code).not.toContain('wx:for')
    })

    it('should collect parse warnings via onError', () => {
      const result = compileVueTemplateToWxml(
        '<view :class="">{{</view>',
        'test.vue',
      )
      expect(result.warnings.length).toBeGreaterThan(0)
    })

    it('should keep static attributes inside v-for', () => {
      const result = compileVueTemplateToWxml(
        '<view v-for="item in items" class="foo">{{ item }}</view>',
        'test.vue',
      )
      expect(result.code).toContain('class="foo"')
      expect(result.code).toContain('wx:for="{{items}}"')
    })

    it('should fallback interpolation to empty braces when expression malformed', () => {
      const result = compileVueTemplateToWxml(
        '<view>{{ }}</view>',
        'test.vue',
      )
      expect(result.code).toContain('{{}}')
    })
  })
})
