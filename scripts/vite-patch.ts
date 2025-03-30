import { parse } from '@babel/parser'
import _babelTraverse from '@babel/traverse'
import fs from 'fs-extra'
import MagicString from 'magic-string'
import path from 'pathe'

function _interopDefaultCompat(e: any) {
  return e && typeof e === 'object' && 'default' in e ? e.default : e
}

// export const generate = _interopDefaultCompat(_babelGenerate) as typeof _babelGenerate

export const traverse = _interopDefaultCompat(_babelTraverse) as typeof _babelTraverse
async function main() {
  const viteDir = path.resolve(import.meta.dirname, '../node_modules/.pnpm_patches/vite@6.2.3')
  // createCSSResolvers
  const targetFile = path.resolve(viteDir, 'dist/node/chunks/dep-DDxXL6bt.js')
  const code = await fs.readFile(targetFile, 'utf-8')
  const ast = parse(code, {
    sourceType: 'module',
  })
  const ms = new MagicString(code)

  traverse(ast, {
    FunctionDeclaration: {
      enter(p) {
        if (p.get('id').isIdentifier({ name: 'createCSSResolvers' })) {
          const fc = ms.slice(p.node.start!, p.node.end!)
          const r = /"\.css"/g
          fc.matchAll(r).forEach((v) => {
            ms.appendRight(p.node.start! + v.index + v[0].length, ',".wxss"')
          })
        }
      },
    },
  })
  await fs.writeFile(targetFile, ms.toString())
}

main()

// function createCSSResolvers(config) {
//   let cssResolve;
//   let sassResolve;
//   let lessResolve;
//   return {
//     get css() {
//       return cssResolve ??= createBackCompatIdResolver(config, {
//         extensions: [".css"],
//         mainFields: ["style"],
//         conditions: ["style", DEV_PROD_CONDITION],
//         tryIndex: false,
//         preferRelative: true
//       });
//     },
//     get sass() {
//       if (!sassResolve) {
//         const resolver = createBackCompatIdResolver(config, {
//           extensions: [".scss", ".sass", ".css"],
//           mainFields: ["sass", "style"],
//           conditions: ["sass", "style", DEV_PROD_CONDITION],
//           tryIndex: true,
//           tryPrefix: "_",
//           preferRelative: true
//         });
//         sassResolve = async (...args) => {
//           if (args[1].startsWith("file://")) {
//             args[1] = fileURLToPath$1(args[1], {
//               windows: (
//                 // file:///foo cannot be converted to path with windows mode
//                 isWindows$3 && args[1].startsWith("file:///") ? false : void 0
//               )
//             });
//           }
//           return resolver(...args);
//         };
//       }
//       return sassResolve;
//     },
//     get less() {
//       return lessResolve ??= createBackCompatIdResolver(config, {
//         extensions: [".less", ".css"],
//         mainFields: ["less", "style"],
//         conditions: ["less", "style", DEV_PROD_CONDITION],
//         tryIndex: false,
//         preferRelative: true
//       });
//     }
//   };
// }
