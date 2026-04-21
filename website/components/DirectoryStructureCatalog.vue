<script setup lang="ts">
type DirectoryIconName
  = | 'viteConfig'
    | 'projectConfig'
    | 'packageJson'
    | 'public'
    | 'srcRoot'
    | 'appTs'
    | 'appVue'
    | 'layouts'
    | 'appJson'
    | 'appStyle'
    | 'customTabBar'
    | 'appBar'
    | 'pages'
    | 'components'
    | 'subPackage'
    | 'shared'
    | 'utils'
    | 'workers'
    | 'typedRouter'

interface DirectoryItem {
  icon: DirectoryIconName
  title: string
  href: string
  description: string
}

interface DirectorySection {
  title: string
  description: string
  items: DirectoryItem[]
}

const iconMap: Record<
  DirectoryIconName,
  { label?: string, className: string }
> = {
  viteConfig: { className: 'is-vite-config' },
  projectConfig: { className: 'is-project-config' },
  packageJson: { className: 'is-package-json' },
  public: { className: 'is-public' },
  srcRoot: { className: 'is-src-root' },
  appTs: { label: 'TS', className: 'is-app-ts' },
  appVue: { label: 'Vue', className: 'is-app-vue' },
  layouts: { className: 'is-layouts' },
  appJson: { label: '{}', className: 'is-app-json' },
  appStyle: { className: 'is-app-style' },
  customTabBar: { className: 'is-custom-tab-bar' },
  appBar: { className: 'is-app-bar' },
  pages: { className: 'is-pages' },
  components: { className: 'is-components' },
  subPackage: { className: 'is-sub-package' },
  shared: { className: 'is-shared' },
  utils: { className: 'is-utils' },
  workers: { className: 'is-workers' },
  typedRouter: { label: 'TS', className: 'is-typed-router' },
}

const sections: DirectorySection[] = [
  {
    title: 'Root Directory',
    description:
      '先看工程入口。这里决定项目如何被开发者工具、VitePress 和 Weapp-vite 自身识别。',
    items: [
      {
        icon: 'viteConfig',
        title: 'vite.config.ts',
        href: '/guide/directory-structure/vite-config',
        description: '定义 srcRoot、自动路由、分包和自动导入组件等目录能力。',
      },
      {
        icon: 'projectConfig',
        title: 'project.config.json',
        href: '/guide/directory-structure/project-config',
        description: '微信开发者工具项目配置，通常决定 dist 的打开方式。',
      },
      {
        icon: 'packageJson',
        title: 'package.json',
        href: '/guide/directory-structure/package-json',
        description: '项目脚本与依赖入口，承载 dev、build、open 等命令。',
      },
      {
        icon: 'public',
        title: 'public/',
        href: '/guide/directory-structure/public',
        description: '原样复制到产物目录的静态资源，不参与页面扫描。',
      },
    ],
  },
  {
    title: 'App Directory',
    description:
      '再看源码根目录。这里既承接应用入口，也定义页面、组件、分包与特殊固定目录的边界。',
    items: [
      {
        icon: 'srcRoot',
        title: '<srcRoot>/',
        href: '/guide/directory-structure/src-root',
        description: '所有 pages、components、分包和生成类型文件都基于它定位。',
      },
      {
        icon: 'appTs',
        title: 'app.(js|ts)',
        href: '/guide/directory-structure/app-ts',
        description: '应用脚本入口，承载 App 生命周期、启动逻辑和全局初始化。',
      },
      {
        icon: 'appVue',
        title: 'app.vue',
        href: '/guide/directory-structure/app-vue',
        description:
          'Vue SFC 形式的应用入口，可在同一文件中组织脚本、JSON 宏与样式。',
      },
      {
        icon: 'appJson',
        title: 'app.json(.js|.ts)?',
        href: '/guide/directory-structure/app-json',
        description: '应用配置入口，既支持原生 JSON，也支持脚本化生成配置。',
      },
      {
        icon: 'appStyle',
        title: 'app.(css|scss|wxss|...)',
        href: '/guide/directory-structure/app-style',
        description: '应用级全局样式入口，支持 CSS、WXSS 及常见预处理器后缀。',
      },
      {
        icon: 'customTabBar',
        title: 'custom-tab-bar/',
        href: '/guide/directory-structure/custom-tab-bar',
        description: 'tabBar.custom 为 true 时的固定保留目录。',
      },
      {
        icon: 'appBar',
        title: 'app-bar/',
        href: '/guide/directory-structure/app-bar',
        description: 'Skyline appBar 开启时的固定保留目录。',
      },
      {
        icon: 'subPackage',
        title: '<subPackageRoot>/',
        href: '/guide/directory-structure/subpackages',
        description: '通过 weapp.subPackages 声明的分包根目录。',
      },
      {
        icon: 'shared',
        title: 'shared/',
        href: '/guide/directory-structure/shared',
        description: '跨主包与分包共享模块的推荐目录。',
      },
      {
        icon: 'utils',
        title: 'utils/',
        href: '/guide/directory-structure/utils',
        description: '通用工具函数和轻量 helper 的稳定落点。',
      },
      {
        icon: 'workers',
        title: 'workers/',
        href: '/guide/directory-structure/workers',
        description: 'Worker 入口的推荐目录。',
      },
    ],
  },
  {
    title: 'Pages And Components',
    description:
      '接着看页面与组件目录。这里承载主包页面、可复用组件，以及页面级 layout 的组织方式。',
    items: [
      {
        icon: 'layouts',
        title: 'layouts/',
        href: '/guide/directory-structure/layouts',
        description: '页面 layout 约定目录，承载 default 与命名布局。',
      },
      {
        icon: 'pages',
        title: 'pages/',
        href: '/guide/directory-structure/pages',
        description: '主包页面目录，也是自动路由的默认扫描入口之一。',
      },
      {
        icon: 'components',
        title: 'components/',
        href: '/guide/directory-structure/components',
        description: '主包组件目录，默认参与自动导入组件扫描。',
      },
    ],
  },
  {
    title: 'Generated Files',
    description:
      '最后看自动生成产物。它们默认也落在 srcRoot 下，方便 tsconfig 直接覆盖。',
    items: [
      {
        icon: 'typedRouter',
        title: 'typed-router.d.ts / typed-components.d.ts / components.d.ts',
        href: '/guide/directory-structure/generated-files',
        description: '自动路由和自动导入组件生成的类型声明文件集合。',
      },
    ],
  },
]
</script>

<template>
  <div class="directory-catalog">
    <section
      v-for="section in sections"
      :key="section.title"
      class="directory-catalog-section"
    >
      <div class="directory-catalog-header">
        <h2>{{ section.title }}</h2>
        <p>{{ section.description }}</p>
      </div>
      <div class="directory-catalog-grid">
        <a
          v-for="item in section.items"
          :key="item.href"
          :href="item.href"
          class="directory-catalog-card"
        >
          <div class="directory-catalog-card-title">
            <span
              class="directory-catalog-card-icon"
              :class="iconMap[item.icon].className"
            >
              {{ iconMap[item.icon].label }}
            </span>
            <code>{{ item.title }}</code>
          </div>
          <p>{{ item.description }}</p>
        </a>
      </div>
    </section>
  </div>
</template>

<style scoped>
.directory-catalog {
  display: grid;
  gap: 28px;
  margin: 28px 0 36px;
}

.directory-catalog-section {
  display: grid;
  gap: 14px;
}

.directory-catalog-header h2 {
  margin: 0;
  font-size: 1.25rem;
  letter-spacing: -0.02em;
}

.directory-catalog-header p {
  margin: 8px 0 0;
  color: var(--vp-c-text-2);
}

.directory-catalog-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.directory-catalog-card {
  display: grid;
  gap: 10px;
  padding: 14px 16px;
  text-decoration: none;
  background: linear-gradient(180deg, color-mix(in srgb, var(--vp-c-bg-soft) 92%, white 8%), var(--vp-c-bg-soft));
  border: 1px solid color-mix(in srgb, var(--vp-c-divider) 80%, transparent);
  border-radius: 16px;
  transition:
    transform 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease;
}

.directory-catalog-card:hover {
  border-color: color-mix(in srgb, var(--vp-c-brand-1) 38%, var(--vp-c-divider));
  box-shadow: 0 10px 24px rgb(0 0 0 / 8%);
  transform: translateY(-2px);
}

.directory-catalog-card-title {
  display: flex;
  gap: 10px;
  align-items: center;
  font-weight: 600;
  color: var(--vp-c-text-1);
}

.directory-catalog-card-icon {
  position: relative;
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  font-size: 0.56rem;
  font-weight: 800;
  line-height: 1;
  color: var(--directory-icon-fg, #475569);
  text-transform: uppercase;
  letter-spacing: 0.02em;
  background:
    linear-gradient(180deg, rgb(255 255 255 / 36%), transparent), var(--directory-icon-bg, rgb(100 116 139 / 10%));
  border: 1px solid var(--directory-icon-border, rgb(100 116 139 / 20%));
  border-radius: 8px;
  box-shadow: 0 1px 0 rgb(255 255 255 / 65%) inset;
}

.directory-catalog-card-icon::before,
.directory-catalog-card-icon::after {
  position: absolute;
  display: block;
  content: '';
}

.directory-catalog-card-icon.is-vite-config {
  --directory-icon-bg: rgb(245 158 11 / 12%);
  --directory-icon-border: rgb(245 158 11 / 24%);
  --directory-icon-fg: #b45309;
}

.directory-catalog-card-icon.is-vite-config::before {
  width: 9px;
  height: 14px;
  background: currentcolor;
  clip-path: polygon(55% 0, 0 58%, 44% 58%, 30% 100%, 100% 38%, 58% 38%);
}

.directory-catalog-card-icon.is-project-config {
  --directory-icon-bg: rgb(100 116 139 / 12%);
  --directory-icon-border: rgb(100 116 139 / 22%);
  --directory-icon-fg: #475569;
}

.directory-catalog-card-icon.is-project-config::before,
.directory-catalog-card-icon.is-project-config::after {
  width: 12px;
  height: 2px;
  background: currentcolor;
  border-radius: 999px;
}

.directory-catalog-card-icon.is-project-config::before {
  box-shadow:
    0 4px 0 currentcolor,
    0 8px 0 currentcolor;
  transform: translateY(-4px);
}

.directory-catalog-card-icon.is-package-json {
  --directory-icon-bg: rgb(34 197 94 / 11%);
  --directory-icon-border: rgb(34 197 94 / 22%);
  --directory-icon-fg: #15803d;
}

.directory-catalog-card-icon.is-package-json::before {
  inset: 5px;
  border: 2px solid currentcolor;
  border-radius: 5px;
}

.directory-catalog-card-icon.is-package-json::after {
  width: 8px;
  height: 2px;
  background: currentcolor;
  border-radius: 999px;
}

.directory-catalog-card-icon.is-public {
  --directory-icon-bg: rgb(6 182 212 / 11%);
  --directory-icon-border: rgb(6 182 212 / 22%);
  --directory-icon-fg: #0f766e;
}

.directory-catalog-card-icon.is-public::before {
  width: 13px;
  height: 9px;
  border: 2px solid currentcolor;
  border-radius: 3px;
  transform: translateY(-1px);
}

.directory-catalog-card-icon.is-public::after {
  right: 5px;
  bottom: 6px;
  width: 4px;
  height: 4px;
  background: var(--vp-c-bg);
  border: 2px solid currentcolor;
  border-radius: 999px;
}

.directory-catalog-card-icon.is-src-root {
  --directory-icon-bg: rgb(16 185 129 / 11%);
  --directory-icon-border: rgb(16 185 129 / 22%);
  --directory-icon-fg: #047857;
}

.directory-catalog-card-icon.is-src-root::before {
  width: 14px;
  height: 10px;
  border: 2px solid currentcolor;
  border-radius: 4px 4px 3px 3px;
  transform: translateY(2px);
}

.directory-catalog-card-icon.is-src-root::after {
  top: 4px;
  left: 5px;
  width: 8px;
  height: 4px;
  border: 2px solid currentcolor;
  border-bottom: 0;
  border-radius: 3px 3px 0 0;
}

.directory-catalog-card-icon.is-app-ts,
.directory-catalog-card-icon.is-typed-router {
  --directory-icon-bg: rgb(37 99 235 / 12%);
  --directory-icon-border: rgb(37 99 235 / 24%);
  --directory-icon-fg: #1d4ed8;
}

.directory-catalog-card-icon.is-app-vue {
  --directory-icon-bg: rgb(20 184 166 / 12%);
  --directory-icon-border: rgb(20 184 166 / 22%);
  --directory-icon-fg: #0f766e;
}

.directory-catalog-card-icon.is-layouts {
  --directory-icon-bg: rgb(168 85 247 / 11%);
  --directory-icon-border: rgb(168 85 247 / 22%);
  --directory-icon-fg: #7c3aed;
}

.directory-catalog-card-icon.is-layouts::before {
  inset: 4px;
  border: 2px solid currentcolor;
  border-radius: 4px;
}

.directory-catalog-card-icon.is-layouts::after {
  width: 2px;
  height: 12px;
  background: currentcolor;
  border-radius: 999px;
  box-shadow: 0 -4px 0 currentcolor inset;
}

.directory-catalog-card-icon.is-app-json {
  --directory-icon-bg: rgb(99 102 241 / 12%);
  --directory-icon-border: rgb(99 102 241 / 22%);
  --directory-icon-fg: #4338ca;

  font-size: 0.62rem;
}

.directory-catalog-card-icon.is-app-style {
  --directory-icon-bg: rgb(244 63 94 / 11%);
  --directory-icon-border: rgb(244 63 94 / 22%);
  --directory-icon-fg: #be185d;
}

.directory-catalog-card-icon.is-app-style::before {
  width: 12px;
  height: 12px;
  background: currentcolor;
  border-radius: 60% 40% 55% 45%;
  transform: rotate(45deg);
}

.directory-catalog-card-icon.is-custom-tab-bar {
  --directory-icon-bg: rgb(168 85 247 / 11%);
  --directory-icon-border: rgb(168 85 247 / 22%);
  --directory-icon-fg: #7c3aed;
}

.directory-catalog-card-icon.is-custom-tab-bar::before {
  inset: 4px;
  border: 2px solid currentcolor;
  border-radius: 4px;
}

.directory-catalog-card-icon.is-custom-tab-bar::after {
  bottom: 7px;
  width: 12px;
  height: 2px;
  background: currentcolor;
  border-radius: 999px;
  box-shadow:
    -4px 0 0 currentcolor,
    4px 0 0 currentcolor;
}

.directory-catalog-card-icon.is-app-bar {
  --directory-icon-bg: rgb(249 115 22 / 12%);
  --directory-icon-border: rgb(249 115 22 / 22%);
  --directory-icon-fg: #c2410c;
}

.directory-catalog-card-icon.is-app-bar::before {
  inset: 4px;
  border: 2px solid currentcolor;
  border-radius: 5px;
}

.directory-catalog-card-icon.is-app-bar::after {
  top: 7px;
  width: 12px;
  height: 2px;
  background: currentcolor;
  border-radius: 999px;
}

.directory-catalog-card-icon.is-pages {
  --directory-icon-bg: rgb(14 165 233 / 11%);
  --directory-icon-border: rgb(14 165 233 / 22%);
  --directory-icon-fg: #0369a1;
}

.directory-catalog-card-icon.is-pages::before {
  top: 5px;
  left: 5px;
  width: 5px;
  height: 5px;
  background: currentcolor;
  border-radius: 1px;
  box-shadow:
    9px 0 0 currentcolor,
    0 9px 0 currentcolor,
    9px 9px 0 currentcolor;
}

.directory-catalog-card-icon.is-components {
  --directory-icon-bg: rgb(168 85 247 / 11%);
  --directory-icon-border: rgb(168 85 247 / 22%);
  --directory-icon-fg: #7c3aed;
}

.directory-catalog-card-icon.is-components::before {
  top: 5px;
  left: 5px;
  width: 5px;
  height: 5px;
  background: currentcolor;
  border-radius: 1px;
  box-shadow:
    9px 0 0 currentcolor,
    4px 9px 0 currentcolor;
}

.directory-catalog-card-icon.is-sub-package {
  --directory-icon-bg: rgb(132 204 22 / 12%);
  --directory-icon-border: rgb(132 204 22 / 24%);
  --directory-icon-fg: #4d7c0f;
}

.directory-catalog-card-icon.is-sub-package::before {
  width: 10px;
  height: 10px;
  border: 2px solid currentcolor;
  border-radius: 3px;
  box-shadow:
    4px 4px 0 -1px var(--vp-c-bg),
    4px 4px 0 1px currentcolor;
  transform: translate(-2px, -2px);
}

.directory-catalog-card-icon.is-shared {
  --directory-icon-bg: rgb(16 185 129 / 10%);
  --directory-icon-border: rgb(16 185 129 / 22%);
  --directory-icon-fg: #047857;
}

.directory-catalog-card-icon.is-shared::before {
  left: 5px;
  width: 4px;
  height: 4px;
  background: currentcolor;
  border-radius: 999px;
  box-shadow:
    10px -4px 0 currentcolor,
    10px 4px 0 currentcolor;
}

.directory-catalog-card-icon.is-shared::after {
  left: 8px;
  width: 9px;
  height: 2px;
  background: currentcolor;
  border-radius: 999px;
  box-shadow: 0 4px 0 currentcolor;
  transform: rotate(-23deg);
}

.directory-catalog-card-icon.is-utils {
  --directory-icon-bg: rgb(234 179 8 / 11%);
  --directory-icon-border: rgb(234 179 8 / 24%);
  --directory-icon-fg: #a16207;
}

.directory-catalog-card-icon.is-utils::before {
  width: 12px;
  height: 4px;
  background: currentcolor;
  border-radius: 999px;
  transform: rotate(-45deg);
}

.directory-catalog-card-icon.is-utils::after {
  right: 5px;
  bottom: 5px;
  width: 5px;
  height: 5px;
  background: var(--vp-c-bg);
  border: 2px solid currentcolor;
  border-radius: 999px;
}

.directory-catalog-card-icon.is-workers {
  --directory-icon-bg: rgb(244 63 94 / 11%);
  --directory-icon-border: rgb(244 63 94 / 22%);
  --directory-icon-fg: #be185d;
}

.directory-catalog-card-icon.is-workers::before {
  inset: 6px 5px 7px;
  border: 2px solid currentcolor;
  border-radius: 4px;
}

.directory-catalog-card-icon.is-workers::after {
  top: 4px;
  width: 2px;
  height: 4px;
  background: currentcolor;
  border-radius: 999px;
  box-shadow:
    4px 0 0 currentcolor,
    -4px 0 0 currentcolor,
    0 14px 0 currentcolor;
}

.directory-catalog-card-title code {
  font-size: 0.95rem;
}

.directory-catalog-card p {
  margin: 0;
  line-height: 1.6;
  color: var(--vp-c-text-2);
}

@media (max-width: 768px) {
  .directory-catalog-grid {
    grid-template-columns: 1fr;
  }
}
</style>
