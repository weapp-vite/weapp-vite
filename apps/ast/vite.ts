import type { Plugin } from 'vite'
// import _babelGenerate from '@babel/generator'
import _babelTraverse from '@babel/traverse'
import { parse } from 'comment-json'
// import * as traverse from '@babel/traverse'
import { walk as eswalk } from 'estree-walker'
import fs from 'fs-extra'
import isReference from 'is-reference'
import path from 'pathe'
import { build } from 'vite'

export { parse, parseExpression } from '@babel/parser'

function _interopDefaultCompat(e: any) {
  return e && typeof e === 'object' && 'default' in e ? e.default : e
}

// export const generate = _interopDefaultCompat(_babelGenerate) as typeof _babelGenerate

// const traverse = _interopDefaultCompat(_babelTraverse) as typeof _babelTraverse

async function main() {
  await build({

    build: {
      rollupOptions: {
        input: {
          app: 'src/app.ts',
        },
        output: {
          chunkFileNames(chunkInfo) {
            return `${chunkInfo.name}.js`
          },
          entryFileNames(chunkInfo) {
            return `${chunkInfo.name}.js`
          },
          assetFileNames(chunkInfo) {
            return chunkInfo.names[0]
          },
        },

      },
      assetsDir: '',
      minify: false,
    },
    plugins: [
      {
        name: 'vite-plugin-weapp-mp',
        // apply: 'build',
        enforce: 'pre',

        configResolved(config) {
          console.log('configResolved', config)
          const idx = config.plugins?.findIndex(x => x.name === 'vite:build-import-analysis')
          if (idx > -1) {
            (config.plugins as Plugin<any>[]).splice(idx, 1)
          }
        },
        config(config, { command, mode }) {
          console.log('config', config, command, mode)
        },
        options(options) {
          console.log('options', options)

          // const idx = options.plugins?.findIndex(x => x.name === 'vite:build-import-analysis')
          // if (idx > -1) {
          //   options.plugins.splice(idx, 1)
          // }
        },
        buildStart() {
          console.log('buildStart')
        },
        async load(id, options) {
          console.log('load', id, options)
          if (id.endsWith('app.ts')) {
            const json = fs.readJsonSync(path.resolve(import.meta.dirname, './src/app.json'))
            for (const page of json.pages) {
              const c = await this.resolve(`src/${page}.ts`)
              if (c) {
                const info = await this.load(
                  c,
                )
                console.log(c, info)
              }
            }
          }
        },
        async resolveId(source, importer, options) {
          console.log('resolveId', source, importer, options)
          const resolved = await this.resolve(source, importer, { skipSelf: true })
          if (resolved) {
            console.log(resolved)
          }
        },
        shouldTransformCachedModule(options) {
          console.log('shouldTransformCachedModule', options)
        },
        transform(code, id, options) {
          console.log('transform', code, id, options)
        },
        moduleParsed(info) {
          console.log('moduleParsed', info)
          if (info.ast) {
            const imports: string[] = []
            eswalk(info.ast, {
              enter(node, parent, prop, index) {
                // console.log('enter', node)
                if (node.type === 'CallExpression') {
                  if (node.callee.type === 'Identifier' && node.callee.name === 'require') {
                    if (node.arguments[0].type === 'Literal') {
                      // target
                      // node.arguments[0].value
                      typeof node.arguments[0].value === 'string' && imports.push(node.arguments[0].value)
                    }
                  }
                  else if (
                    node.callee.type === 'MemberExpression'
                    && node.callee.object.type === 'Identifier'
                    && node.callee.object.name === 'require'
                    && node.callee.property.type === 'Identifier'
                    && node.callee.property.name === 'async') {
                    if (node.arguments[0].type === 'Literal') {
                      typeof node.arguments[0].value === 'string' && imports.push(node.arguments[0].value)
                      // node.arguments[0].value
                    }
                  }
                }
              },
              leave(node, parent, prop, index) {
                // console.log('leave', node)
              },
            })
            const dirname = path.dirname(info.id)
            const res = imports.map((x) => {
              return path.resolve(dirname, x)
            })
            // @ts-ignore
            info.importedIds.push(...res)
            console.log(imports)
            this.emitFile(
              {
                type: 'chunk',
                id: info.id,
              },
            )
          }
        },
        resolveDynamicImport(specifier, importer, options) {
          console.log('resolveDynamicImport', specifier, importer, options)
        },
        buildEnd() {
          const res = [...this.getModuleIds()]
          console.log(res)
        },
        generateBundle(options, bundle) {
          // this.emitFile(
          //   {
          //     type: 'prebuilt-chunk',
          //   },
          // )
          console.log('generateBundle', bundle, options)
        },
      },
    ],
  })
}

main()
