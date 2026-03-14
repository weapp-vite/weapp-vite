<script setup lang="ts">
type DirectoryIconName
  = | 'viteConfig'
    | 'projectConfig'
    | 'packageJson'
    | 'public'
    | 'srcRoot'
    | 'appTs'
    | 'appVue'
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

const sections: DirectorySection[] = [
  {
    title: 'Root Directory',
    description: '先看工程入口。这里决定项目如何被开发者工具、VitePress 和 Weapp-vite 自身识别。',
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
    description: '再看源码根目录。这里既承接应用入口，也定义页面、组件、分包与特殊固定目录的边界。',
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
        description: 'Vue SFC 形式的应用入口，可在同一文件中组织脚本、JSON 宏与样式。',
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
    title: 'Generated Files',
    description: '最后看自动生成产物。它们默认也落在 srcRoot 下，方便 tsconfig 直接覆盖。',
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
