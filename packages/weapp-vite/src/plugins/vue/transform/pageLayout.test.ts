import os from 'node:os'
import fs from 'fs-extra'
import path from 'pathe'
import { afterEach, describe, expect, it } from 'vitest'
import { applyPageLayout, extractPageLayoutMeta, extractPageLayoutName, resolvePageLayout } from './pageLayout'

const tempDirs: string[] = []

async function createTempProject() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-layouts-'))
  tempDirs.push(dir)
  await fs.ensureDir(path.join(dir, 'src'))
  return dir
}

describe('page layouts', () => {
  afterEach(async () => {
    while (tempDirs.length) {
      const dir = tempDirs.pop()
      if (dir) {
        await fs.remove(dir)
      }
    }
  })

  it('extracts layout name from definePageMeta', () => {
    const layoutName = extractPageLayoutName(`
<script setup lang="ts">
definePageMeta({
  layout: 'AdminDashboard',
})
</script>
    `.trim(), '/project/src/pages/index/index.vue')

    expect(layoutName).toBe('admin-dashboard')
  })

  it('extracts layout object with props from definePageMeta', () => {
    const layoutMeta = extractPageLayoutMeta(`
<script setup lang="ts">
definePageMeta({
  layout: {
    name: 'panel',
    props: {
      sidebar: true,
      title: 'Dashboard',
      count: 3,
      empty: null,
      source: titleRef.value,
    },
  },
})
</script>
    `.trim(), '/project/src/pages/index/index.vue')

    expect(layoutMeta).toEqual({
      name: 'panel',
      props: {
        sidebar: true,
        title: 'Dashboard',
        count: 3,
        empty: null,
        source: {
          kind: 'expression',
          expression: 'titleRef.value',
        },
      },
    })
  })

  it('resolves default layout when page meta is absent', async () => {
    const projectDir = await createTempProject()
    const srcRoot = path.join(projectDir, 'src')
    const pageFile = path.join(srcRoot, 'pages', 'index', 'index.vue')
    const layoutFile = path.join(srcRoot, 'layouts', 'default.vue')

    await fs.ensureDir(path.dirname(pageFile))
    await fs.ensureDir(path.dirname(layoutFile))
    await fs.writeFile(layoutFile, '<template><slot /></template>', 'utf8')

    const resolved = await resolvePageLayout(
      '<template><view>home</view></template>',
      pageFile,
      {
        absoluteSrcRoot: srcRoot,
        relativeOutputPath: (input: string) => path.relative(srcRoot, input),
      } as any,
    )

    expect(resolved).toEqual({
      file: layoutFile,
      importPath: '/layouts/default',
      kind: 'vue',
      layoutName: 'default',
      tagName: 'weapp-layout-default',
    })
  })

  it('resolves native mini-program layout entries', async () => {
    const projectDir = await createTempProject()
    const srcRoot = path.join(projectDir, 'src')
    const pageFile = path.join(srcRoot, 'pages', 'native', 'index.vue')
    const layoutBase = path.join(srcRoot, 'layouts', 'native-shell', 'index')

    await fs.ensureDir(path.dirname(layoutBase))
    await fs.writeFile(`${layoutBase}.json`, JSON.stringify({ component: true }, null, 2), 'utf8')
    await fs.writeFile(`${layoutBase}.wxml`, '<view class="shell"><slot /></view>', 'utf8')

    const resolved = await resolvePageLayout(
      `
<script setup lang="ts">
definePageMeta({
  layout: 'native-shell',
})
</script>
<template><view>native</view></template>
      `.trim(),
      pageFile,
      {
        absoluteSrcRoot: srcRoot,
        relativeOutputPath: (input: string) => path.relative(srcRoot, input),
      } as any,
    )

    expect(resolved).toEqual({
      file: layoutBase,
      importPath: '/layouts/native-shell/index',
      kind: 'native',
      layoutName: 'native-shell',
      tagName: 'weapp-layout-native-shell',
    })
  })

  it('resolves layout object with props for vue layouts', async () => {
    const projectDir = await createTempProject()
    const srcRoot = path.join(projectDir, 'src')
    const pageFile = path.join(srcRoot, 'pages', 'panel', 'index.vue')
    const layoutFile = path.join(srcRoot, 'layouts', 'panel.vue')

    await fs.ensureDir(path.dirname(layoutFile))
    await fs.writeFile(layoutFile, '<template><slot /></template>', 'utf8')

    const resolved = await resolvePageLayout(
      `
<script setup lang="ts">
definePageMeta({
  layout: {
    name: 'panel',
      props: {
        sidebar: true,
        title: 'Dashboard',
        count: 3,
        source: titleRef.value,
      },
    },
})
</script>
<template><view>panel</view></template>
      `.trim(),
      pageFile,
      {
        absoluteSrcRoot: srcRoot,
        relativeOutputPath: (input: string) => path.relative(srcRoot, input),
      } as any,
    )

    expect(resolved).toEqual({
      file: layoutFile,
      importPath: '/layouts/panel',
      kind: 'vue',
      layoutName: 'panel',
      tagName: 'weapp-layout-panel',
      props: {
        sidebar: true,
        title: 'Dashboard',
        count: 3,
        source: {
          kind: 'expression',
          expression: 'titleRef.value',
        },
      },
    })
  })

  it('respects layout false and skips wrapping', async () => {
    const projectDir = await createTempProject()
    const srcRoot = path.join(projectDir, 'src')
    const pageFile = path.join(srcRoot, 'pages', 'plain', 'index.vue')
    const layoutFile = path.join(srcRoot, 'layouts', 'default.vue')

    await fs.ensureDir(path.dirname(layoutFile))
    await fs.writeFile(layoutFile, '<template><slot /></template>', 'utf8')

    const resolved = await resolvePageLayout(
      `
<script setup lang="ts">
definePageMeta({
  layout: false,
})
</script>
<template><view>plain</view></template>
      `.trim(),
      pageFile,
      {
        absoluteSrcRoot: srcRoot,
        relativeOutputPath: (input: string) => path.relative(srcRoot, input),
      } as any,
    )

    expect(resolved).toBeUndefined()
  })

  it('wraps compiled page output with layout component', () => {
    const result = applyPageLayout(
      {
        script: 'export default {}',
        template: '<view>content</view>',
        config: JSON.stringify({ navigationBarTitleText: '首页' }),
      },
      '/project/src/pages/home/index.vue',
      {
        file: '/project/src/layouts/default.vue',
        importPath: '/layouts/default',
        kind: 'vue',
        layoutName: 'default',
        tagName: 'weapp-layout-default',
      },
    )

    expect(result.template).toBe('<weapp-layout-default><view>content</view></weapp-layout-default>')
    expect(result.script).toContain('import "../../layouts/default.vue"')
    expect(JSON.parse(result.config!)).toEqual({
      navigationBarTitleText: '首页',
      usingComponents: {
        'weapp-layout-default': '/layouts/default',
      },
    })
  })

  it('renders layout props as static attributes on wrapped layout tag', () => {
    const result = applyPageLayout(
      {
        script: 'export default {}',
        template: '<view>content</view>',
        config: JSON.stringify({ navigationBarTitleText: '面板布局' }),
      },
      '/project/src/pages/home/index.vue',
      {
        file: '/project/src/layouts/panel.vue',
        importPath: '/layouts/panel',
        kind: 'vue',
        layoutName: 'panel',
        tagName: 'weapp-layout-panel',
        props: {
          sidebar: true,
          title: 'Dashboard',
          count: 3,
          empty: null,
        },
      },
    )

    expect(result.template).toBe('<weapp-layout-panel sidebar="{{true}}" title="Dashboard" count="{{3}}" empty="{{null}}"><view>content</view></weapp-layout-panel>')
  })

  it('renders runtime layout prop bindings and injects computed entries into script', () => {
    const result = applyPageLayout(
      {
        script: 'const __wevuOptions = { computed: baseComputed, data() { return {} } };export default __wevuOptions',
        template: '<view>content</view>',
        config: JSON.stringify({ navigationBarTitleText: '运行时布局' }),
      },
      '/project/src/pages/home/index.vue',
      {
        file: '/project/src/layouts/panel.vue',
        importPath: '/layouts/panel',
        kind: 'vue',
        layoutName: 'panel',
        tagName: 'weapp-layout-panel',
        props: {
          title: {
            kind: 'expression',
            expression: 'titleRef.value',
          },
          sidebar: {
            kind: 'expression',
            expression: 'sidebarVisible',
          },
        },
      },
    )

    expect(result.template).toBe('<weapp-layout-panel title="{{__wv_layout_bind_title}}" sidebar="{{__wv_layout_bind_sidebar}}"><view>content</view></weapp-layout-panel>')
    expect(result.script).toContain('__wv_layout_bind_title')
    expect(result.script).toContain('__wv_layout_bind_sidebar')
    expect(result.script).toContain('titleRef.value')
    expect(result.script).toContain('sidebarVisible')
  })

  it('does not wrap layout twice when template is already wrapped', () => {
    const result = applyPageLayout(
      {
        script: 'export default {}',
        template: '<weapp-layout-panel sidebar="{{true}}"><weapp-layout-panel sidebar="{{true}}"><view>content</view></weapp-layout-panel></weapp-layout-panel>',
        config: JSON.stringify({ navigationBarTitleText: '面板布局' }),
      },
      '/project/src/pages/home/index.vue',
      {
        file: '/project/src/layouts/panel.vue',
        importPath: '/layouts/panel',
        kind: 'vue',
        layoutName: 'panel',
        tagName: 'weapp-layout-panel',
        props: {
          sidebar: true,
        },
      },
    )

    expect(result.template).toBe('<weapp-layout-panel sidebar="{{true}}"><view>content</view></weapp-layout-panel>')
  })

  it('wraps compiled page output with native layout component without script import', () => {
    const result = applyPageLayout(
      {
        script: 'export default {}',
        template: '<view>content</view>',
        config: JSON.stringify({ navigationBarTitleText: '原生布局' }),
      },
      '/project/src/pages/home/index.vue',
      {
        file: '/project/src/layouts/native-shell/index',
        importPath: '/layouts/native-shell/index',
        kind: 'native',
        layoutName: 'native-shell',
        tagName: 'weapp-layout-native-shell',
      },
    )

    expect(result.template).toBe('<weapp-layout-native-shell><view>content</view></weapp-layout-native-shell>')
    expect(result.script).toBe('export default {}')
    expect(JSON.parse(result.config!)).toEqual({
      navigationBarTitleText: '原生布局',
      usingComponents: {
        'weapp-layout-native-shell': '/layouts/native-shell/index',
      },
    })
  })
})
