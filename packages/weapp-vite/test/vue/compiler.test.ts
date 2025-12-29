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
  })

  describe('Attribute Bindings', () => {
    it('should compile v-bind to attribute binding', () => {
      const result = compileVueTemplateToWxml(
        '<view :class="className">Hello</view>',
        'test.vue',
      )
      expect(result.code).toContain('class="{{className}}"')
    })

    it('should normalize :class array/object to WXML-safe expression', () => {
      const result = compileVueTemplateToWxml(
        `<view class="card" :class="[active ? 'active' : 'inactive', $style.moduleBox, { [$style.highlight]: highlight }]" />`,
        'test.vue',
      )
      expect(result.code).not.toContain('class="{{[')
      expect(result.code).toContain('class="card')
      expect(result.code).toContain('{{active?\'active\':\'inactive\'}}')
      expect(result.code).toContain('{{$style.moduleBox}}')
      expect(result.code).toContain('{{highlight?$style.highlight:\'\'}')
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
      expect(result.code).toContain('bind:input="value = $event.detail.value"')
    })

    it('should compile v-model on input with explicit type text', () => {
      const result = compileVueTemplateToWxml(
        '<input type="text" v-model="text" />',
        'test.vue',
      )
      expect(result.code).toContain('value="{{text}}"')
      expect(result.code).toContain('bind:input="text = $event.detail.value"')
    })
  })

  describe('v-model - Checkbox', () => {
    it('should compile v-model on input type checkbox', () => {
      const result = compileVueTemplateToWxml(
        '<input type="checkbox" v-model="checked" />',
        'test.vue',
      )
      expect(result.code).toContain('checked="{{checked}}"')
      expect(result.code).toContain('bind:change')
    })

    it('should compile v-model on checkbox element', () => {
      const result = compileVueTemplateToWxml(
        '<checkbox v-model="agreed" />',
        'test.vue',
      )
      expect(result.code).toContain('checked="{{agreed}}"')
      expect(result.code).toContain('bind:change')
    })
  })

  describe('v-model - Radio', () => {
    it('should compile v-model on input type radio', () => {
      const result = compileVueTemplateToWxml(
        '<input type="radio" v-model="selected" />',
        'test.vue',
      )
      expect(result.code).toContain('checked="{{selected === $event.detail.value}}"')
      expect(result.code).toContain('bind:change')
    })
  })

  describe('v-model - Other Elements', () => {
    it('should compile v-model on textarea', () => {
      const result = compileVueTemplateToWxml(
        '<textarea v-model="content" />',
        'test.vue',
      )
      expect(result.code).toContain('value="{{content}}"')
      expect(result.code).toContain('bind:input="content = $event.detail.value"')
    })

    it('should compile v-model on select', () => {
      const result = compileVueTemplateToWxml(
        '<select v-model="selected" />',
        'test.vue',
      )
      expect(result.code).toContain('value="{{selected}}"')
      expect(result.code).toContain('bind:change="selected = $event.detail.value"')
    })

    it('should compile v-model on switch', () => {
      const result = compileVueTemplateToWxml(
        '<switch v-model="enabled" />',
        'test.vue',
      )
      expect(result.code).toContain('checked="{{enabled}}"')
      expect(result.code).toContain('bind:change="enabled = $event.detail.value"')
    })

    it('should compile v-model on slider', () => {
      const result = compileVueTemplateToWxml(
        '<slider v-model="progress" />',
        'test.vue',
      )
      expect(result.code).toContain('value="{{progress}}"')
      expect(result.code).toContain('bind:change="progress = $event.detail.value"')
    })

    it('should compile v-model on picker', () => {
      const result = compileVueTemplateToWxml(
        '<picker v-model="date" />',
        'test.vue',
      )
      expect(result.code).toContain('value="{{date}}"')
      expect(result.code).toContain('bind:change="date = $event.detail.value"')
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
  })

  describe('Template Slots', () => {
    it('should compile template with v-slot for named slot', () => {
      const result = compileVueTemplateToWxml(
        '<template v-slot:header><view>Header content</view></template>',
        'test.vue',
      )
      expect(result.code).toContain('<block slot="header">')
      expect(result.code).toContain('Header content')
    })

    it('should compile template with v-slot for default slot', () => {
      const result = compileVueTemplateToWxml(
        '<template v-slot><view>Default content</view></template>',
        'test.vue',
      )
      expect(result.code).toContain('<block slot="">')
    })

    it('should compile template with scoped slot', () => {
      const result = compileVueTemplateToWxml(
        '<template v-slot="slotProps"><view>{{ slotProps.item }}</view></template>',
        'test.vue',
      )
      expect(result.code).toContain('<block slot="" data="slotProps">')
      expect(result.warnings).toHaveLength(1)
      expect(result.warnings[0]).toContain('Scoped slots')
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
      expect(result.code).toContain('<block wx:for="{{items}}" wx:for-item="item">')
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

    it('should handle element with multiple directives', () => {
      const result = compileVueTemplateToWxml(
        '<view v-if="visible" :class="className" @click="handleClick">Multi directive</view>',
        'test.vue',
      )
      expect(result.code).toContain('wx:if="{{visible}}"')
      expect(result.code).toContain('class="{{className}}"')
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
      expect(result.code).toContain('class="{{itemClass}}"')
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
