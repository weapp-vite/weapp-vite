import type { PackageJson } from 'pkg-types'
import type { ProjectConfig, SharedUpdateOptions, UpdatePackageJsonOptions, UpdateProjectConfigOptions } from './types'
import path from 'node:path'
import process from 'node:process'
import logger from '@weapp-core/logger'
import { defu, get, set } from '@weapp-core/shared'
import fs from 'fs-extra'
import { createContext } from './context'

const ctx = createContext()

export function updateProjectConfig(options: UpdateProjectConfigOptions) {
  const { root, dest, cb, write, filename } = defu<
    Required<UpdateProjectConfigOptions>,
    Partial<UpdateProjectConfigOptions>[]
  >(
    options,
    {
      write: true,
      filename: 'project.config.json',
    },
  )
  const projectConfigFilename = ctx.projectConfig.name = filename
  const projectConfigPath = ctx.projectConfig.path = path.resolve(root, projectConfigFilename)
  if (fs.existsSync(projectConfigPath)) {
    try {
      const projectConfig = fs.readJSONSync(projectConfigPath) as ProjectConfig

      set(projectConfig, 'miniprogramRoot', 'dist/')
      set(projectConfig, 'srcMiniprogramRoot', 'dist/')
      set(projectConfig, 'setting.packNpmManually', true)
      cb?.(
        (...args) => {
          set(projectConfig, ...args)
        },
      )
      if (Array.isArray(get(projectConfig, 'setting.packNpmRelationList'))) {
        const x = projectConfig.setting.packNpmRelationList.find(
          x => x.packageJsonPath === './package.json' && x.miniprogramNpmDistDir === './dist',
        )
        if (!x) {
          projectConfig.setting.packNpmRelationList.push({
            packageJsonPath: './package.json',
            miniprogramNpmDistDir: './dist',
          })
        }
      }
      else {
        set(projectConfig, 'setting.packNpmRelationList', [
          {
            packageJsonPath: './package.json',
            miniprogramNpmDistDir: './dist',
          },
        ])
      }
      if (write) {
        fs.outputJSONSync(dest ?? projectConfigPath, projectConfig, {
          spaces: 2,
        })
        logger.log(`✨ 设置 ${projectConfigFilename} 配置文件成功!`)
      }
      ctx.projectConfig.value = projectConfig
      return projectConfig
    }
    catch {
      logger.warn(`✨ 设置 ${projectConfigFilename} 配置文件失败!`)
    }
  }
  else {
    logger.warn(`✨ 没有找到 ${projectConfigFilename} 文件!`)
  }
}

export function updatePackageJson(options: UpdatePackageJsonOptions) {
  const { root, dest, command, cb, write, filename } = defu<
    Required<UpdatePackageJsonOptions>,
    Partial<UpdatePackageJsonOptions>[]
  >(options, {
    write: true,
    filename: 'package.json',
    command: 'weapp-vite',
  })
  const packageJsonFilename = ctx.packageJson.name = filename
  const packageJsonPath = ctx.packageJson.path = path.resolve(root, packageJsonFilename)
  let packageJson: PackageJson
  if (fs.existsSync(packageJsonPath)) {
    packageJson = fs.readJSONSync(packageJsonPath) as PackageJson
  }
  else {
    packageJson = {
      name: 'weapp-vite-app',
    }
  }
  try {
    set(packageJson, 'scripts.dev', `${command} dev`)
    set(packageJson, 'scripts.build', `${command} build`)
    if (command === 'weapp-vite') {
      // set(packageJson, 'type', 'module')
      set(packageJson, 'scripts.open', `${command} open`)
      set(packageJson, 'scripts.build-npm', `${command} build-npm`)
      set(packageJson, 'devDependencies.miniprogram-api-typings', `latest`)
      set(packageJson, 'devDependencies.weapp-vite', `latest`)
    }
    cb?.(
      (...args) => {
        set(packageJson, ...args)
      },
    )
    if (write) {
      fs.outputJSONSync(dest ?? packageJsonPath, packageJson, {
        spaces: 2,
      })
      logger.log(`✨ 设置 ${packageJsonFilename} 配置文件成功!`)
    }
    ctx.packageJson.value = packageJson
    return packageJson
  }
  catch { }
}

export function initViteConfigFile(options: SharedUpdateOptions) {
  const { root, write = true } = options

  const type = get(ctx.packageJson.value, 'type')

  const targetFilename = ctx.viteConfig.name = type === 'module' ? 'vite.config.ts' : 'vite.config.mts'
  const viteConfigFilePath = ctx.viteConfig.path = path.resolve(root, targetFilename)
  const viteConfigFileCode = ctx.viteConfig.value = `import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    // weapp-vite options
  },
})
`
  if (write) {
    fs.outputFileSync(viteConfigFilePath, viteConfigFileCode, 'utf8')
    logger.log(`✨ 设置 ${targetFilename} 配置文件成功!`)
  }
  return viteConfigFileCode
}

export function initTsDtsFile(options: SharedUpdateOptions) {
  const { root, write = true } = options
  const targetFilename = 'vite-env.d.ts'
  const viteDtsFilePath = path.resolve(root, targetFilename)
  const code = `/// <reference types="vite/client" />
`
  if (write) {
    fs.outputFileSync(viteDtsFilePath, code, 'utf8')
    logger.log(`✨ 设置 ${targetFilename} 配置文件成功!`)
  }
  return code
}

export function initTsJsonFiles(options: SharedUpdateOptions) {
  const { root, write = true } = options
  const tsJsonFilename = ctx.tsconfig.name = 'tsconfig.json'
  const tsJsonFilePath = ctx.tsconfig.path = path.resolve(root, tsJsonFilename)
  const tsNodeJsonFilename = ctx.tsconfigNode.name = 'tsconfig.node.json'
  const tsNodeJsonFilePath = ctx.tsconfigNode.path = path.resolve(root, tsNodeJsonFilename)
  if (write) {
    const tsJsonValue = {
      compilerOptions: {
        target: 'ES2020',
        jsx: 'preserve',
        lib: [
          'ES2020',
          'DOM',
          'DOM.Iterable',
        ],
        useDefineForClassFields: true,
        baseUrl: '.',
        module: 'ESNext',
        moduleResolution: 'bundler',
        paths: {
          '@/*': [
            './*',
          ],
        },
        resolveJsonModule: true,
        types: [
          'miniprogram-api-typings',
        ],
        allowImportingTsExtensions: true,
        allowJs: true,
        strict: true,
        noFallthroughCasesInSwitch: true,
        noUnusedLocals: true,
        noUnusedParameters: true,
        noEmit: true,
        isolatedModules: true,
        skipLibCheck: true,
      },
      references: [
        {
          path: './tsconfig.node.json',
        },
      ],
      include: [
        '**/*.ts',
        '**/*.js',
      ],
      exclude: [
        'node_modules',
      ],
    }
    if (write) {
      fs.outputJSONSync(
        tsJsonFilePath,
        tsJsonValue,
        {
          encoding: 'utf8',
          spaces: 2,
        },
      )
      logger.log(`✨ 设置 ${tsJsonFilename} 配置文件成功!`)
    }
    ctx.tsconfig.value = tsJsonValue

    const tsJsonNodeValue = {
      compilerOptions: {
        composite: true,
        module: 'ESNext',
        moduleResolution: 'bundler',
        strict: true,
        allowSyntheticDefaultImports: true,
        skipLibCheck: true,
      },
      include: [
        ctx.viteConfig.name,
      ],
    }
    if (write) {
      fs.outputJSONSync(tsNodeJsonFilePath, tsJsonNodeValue, {
        encoding: 'utf8',
        spaces: 2,
      })
      logger.log(`✨ 设置 ${tsNodeJsonFilename} 配置文件成功!`)
    }
    ctx.tsconfigNode.value = tsJsonNodeValue
  }
}

function updateGitIgnore(options: SharedUpdateOptions) {
  const { root, write = true } = options
  const filepath = path.resolve(root, '.gitignore')
  const data = `# dependencies
node_modules
.pnp
.pnp.js

# testing
coverage

# next.js
.next/
out/
build

# misc
.DS_Store
*.pem

# debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.pnpm-debug.log*

# local env files
.env.local
.env.development.local
.env.test.local
.env.production.local

# turbo
.turbo

dist
vite.config.ts.timestamp-*.mjs`
  if (write) {
    fs.outputFileSync(filepath, data, {
      encoding: 'utf8',
    })
  }
  return data
}

export function initConfig(options: { root?: string, command?: 'weapp-vite' }) {
  const { root = process.cwd(), command } = options

  updateProjectConfig({ root })
  updatePackageJson({ root, command })
  updateGitIgnore({ root })
  if (command === 'weapp-vite') {
    initViteConfigFile({ root })
    initTsDtsFile({ root })
    initTsJsonFiles({ root })
  }
  return ctx
}
