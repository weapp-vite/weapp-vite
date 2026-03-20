import { execa } from 'execa'
import fs from 'fs-extra'
import path from 'pathe'
import { describe, expect, it } from 'vitest'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')
const APP_ROOT = path.resolve(import.meta.dirname, '../../e2e-apps/script-setup-macros-mapping')
const DIST_ROOT = path.join(APP_ROOT, 'dist')
const INVALID_JS_WITH_DEFAULTS_APP_ROOT = path.resolve(
  import.meta.dirname,
  '../../e2e-apps/script-setup-macros-js-with-defaults-invalid',
)
const INVALID_JS_WITH_DEFAULTS_DIST_ROOT = path.join(INVALID_JS_WITH_DEFAULTS_APP_ROOT, 'dist')

async function runBuild() {
  await fs.remove(DIST_ROOT)
  await execa('node', [CLI_PATH, 'build', APP_ROOT, '--platform', 'weapp', '--skipNpm'], {
    stdio: 'inherit',
    cwd: APP_ROOT,
  })
}

describe.sequential('e2e app: script-setup-macros-mapping (build)', () => {
  it('covers native component + wevu SFC script setup macro mappings in TS/JS variants', async () => {
    await runBuild()

    const pageJsonPath = path.join(DIST_ROOT, 'pages/index/index.json')
    const pageWxmlPath = path.join(DIST_ROOT, 'pages/index/index.wxml')
    const pageJsPath = path.join(DIST_ROOT, 'pages/index/index.js')
    const nativeBadgeJsonPath = path.join(DIST_ROOT, 'native/native-badge/index.json')
    const nativeBadgeJsPath = path.join(DIST_ROOT, 'native/native-badge/index.js')
    const tsWithDefaultsJsonPath = path.join(DIST_ROOT, 'components/ts-with-defaults/index.json')
    const tsWithDefaultsJsPath = path.join(DIST_ROOT, 'components/ts-with-defaults/index.js')
    const tsWithDefaultsAliasJsonPath = path.join(DIST_ROOT, 'components/ts-with-defaults-alias/index.json')
    const tsWithDefaultsAliasJsPath = path.join(DIST_ROOT, 'components/ts-with-defaults-alias/index.js')
    const tsRuntimeObjectJsonPath = path.join(DIST_ROOT, 'components/ts-runtime-object/index.json')
    const tsRuntimeObjectJsPath = path.join(DIST_ROOT, 'components/ts-runtime-object/index.js')
    const jsRuntimeArrayJsonPath = path.join(DIST_ROOT, 'components/js-runtime-array/index.json')
    const jsRuntimeArrayJsPath = path.join(DIST_ROOT, 'components/js-runtime-array/index.js')
    const jsRuntimeObjectJsonPath = path.join(DIST_ROOT, 'components/js-runtime-object/index.json')
    const jsRuntimeObjectJsPath = path.join(DIST_ROOT, 'components/js-runtime-object/index.js')

    const pageJson = await fs.readJson(pageJsonPath)
    const pageWxml = await fs.readFile(pageWxmlPath, 'utf8')
    const pageJs = await fs.readFile(pageJsPath, 'utf8')
    const nativeBadgeJson = await fs.readJson(nativeBadgeJsonPath)
    const nativeBadgeJs = await fs.readFile(nativeBadgeJsPath, 'utf8')
    const tsWithDefaultsJson = await fs.readJson(tsWithDefaultsJsonPath)
    const tsWithDefaultsJs = await fs.readFile(tsWithDefaultsJsPath, 'utf8')
    const tsWithDefaultsAliasJson = await fs.readJson(tsWithDefaultsAliasJsonPath)
    const tsWithDefaultsAliasJs = await fs.readFile(tsWithDefaultsAliasJsPath, 'utf8')
    const tsRuntimeObjectJson = await fs.readJson(tsRuntimeObjectJsonPath)
    const tsRuntimeObjectJs = await fs.readFile(tsRuntimeObjectJsPath, 'utf8')
    const jsRuntimeArrayJson = await fs.readJson(jsRuntimeArrayJsonPath)
    const jsRuntimeArrayJs = await fs.readFile(jsRuntimeArrayJsPath, 'utf8')
    const jsRuntimeObjectJson = await fs.readJson(jsRuntimeObjectJsonPath)
    const jsRuntimeObjectJs = await fs.readFile(jsRuntimeObjectJsPath, 'utf8')

    expect(pageJson.usingComponents).toMatchObject({
      NativeBadge: '/native/native-badge/index',
      TsWithDefaults: '/components/ts-with-defaults/index',
      TsWithDefaultsAlias: '/components/ts-with-defaults-alias/index',
      TsRuntimeObject: '/components/ts-runtime-object/index',
      JsRuntimeArray: '/components/js-runtime-array/index',
      JsRuntimeObject: '/components/js-runtime-object/index',
    })
    expect(pageJson.navigationBarTitleText).toBe('script setup macros mapping')

    expect(pageWxml).toContain('<NativeBadge')
    expect(pageWxml).toContain('<TsWithDefaults')
    expect(pageWxml).toContain('<TsWithDefaultsAlias')
    expect(pageWxml).toContain('<TsRuntimeObject')
    expect(pageWxml).toContain('<JsRuntimeArray')
    expect(pageWxml).toContain('<JsRuntimeObject')
    expect(pageWxml).toContain('bindsave="__weapp_vite_inline"')
    expect(pageWxml).toContain('bindreset="__weapp_vite_inline"')
    expect(pageWxml).toContain('bindpick="__weapp_vite_inline"')
    expect(pageWxml).toContain('bindtoggle="__weapp_vite_inline"')
    expect(pageWxml).toContain('bindsubmit="__weapp_vite_inline"')
    expect(pageWxml).toContain('bindchange="__weapp_vite_inline"')
    expect(pageWxml).toContain('data-wv-event-detail-save="1"')
    expect(pageWxml).toContain('data-wv-event-detail-pick="1"')
    expect(pageWxml).toContain('data-wv-event-detail-change="1"')

    expect(pageJs).toContain('__weappViteUsingComponent:!0')
    expect(pageJs).toContain('name:`NativeBadge`,from:`/native/native-badge/index`')
    expect(pageJs).toContain('name:`TsWithDefaults`,from:`/components/ts-with-defaults/index`')

    expect(nativeBadgeJson.component).toBe(true)
    expect(nativeBadgeJs).toContain('Component({')
    expect(nativeBadgeJs).toContain('properties')

    expect(tsWithDefaultsJson.component).toBe(true)
    expect(tsWithDefaultsJs).toContain('title:{type:String,required:!1,default:`ts-default-title`}')
    expect(tsWithDefaultsJs).toContain('count:{type:Number,required:!1,default:3}')
    expect(tsWithDefaultsJs).toContain('tags:{type:null,required:!1,default:()=>[`a`,`b`]}')
    expect(tsWithDefaultsJs).toContain('meta:{type:null,required:!1,default:()=>({source:`ts-defaults`})}')
    expect(tsWithDefaultsJs).toContain('tone:{type:String,required:!1,default:`neutral`}')
    expect(tsWithDefaultsJs).toContain('emits:[`save`,`reset`]')
    expect(tsWithDefaultsJs).toContain('emitSave')
    expect(tsWithDefaultsJs).toContain('emitReset')
    expect(tsWithDefaultsJs).toMatch(/setup\([^)]*\{expose:[^,}]+,emit:[^}]+\}\)/)

    expect(tsWithDefaultsAliasJson.component).toBe(true)
    expect(tsWithDefaultsAliasJs).toContain('label:{type:String,required:!1,default:`alias-default-label`}')
    expect(tsWithDefaultsAliasJs).toContain('list:{type:null,required:!1,default:()=>[1,2,3]}')
    expect(tsWithDefaultsAliasJs).toContain('options:{type:null,required:!1,default:()=>({source:`alias-defaults`})}')
    expect(tsWithDefaultsAliasJs).toContain('enabled:{type:Boolean,required:!1,default:!0}')
    expect(tsWithDefaultsAliasJs).toContain('emits:[`pick`,`close`]')
    expect(tsWithDefaultsAliasJs).toContain('emitPick')
    expect(tsWithDefaultsAliasJs).toContain('emitClose')
    expect(tsWithDefaultsAliasJs).toMatch(/setup\([^)]*\{expose:[^,}]+,emit:[^}]+\}\)/)

    expect(tsRuntimeObjectJson.component).toBe(true)
    expect(tsRuntimeObjectJs).toContain('label:{type:String,required:!0}')
    expect(tsRuntimeObjectJs).toContain('active:{type:Boolean,default:!1}')
    expect(tsRuntimeObjectJs).toContain('size:{type:Number,default:20}')
    expect(tsRuntimeObjectJs).toContain('toggle')
    expect(tsRuntimeObjectJs).toContain('resize')
    expect(tsRuntimeObjectJs).toContain('emitToggle')
    expect(tsRuntimeObjectJs).toContain('emitResize')
    expect(tsRuntimeObjectJs).toMatch(/setup\([^)]*\{expose:[^,}]+,emit:[^}]+\}\)/)

    expect(jsRuntimeArrayJson.component).toBe(true)
    expect(jsRuntimeArrayJs).toContain('props:[`foo`,`bar`]')
    expect(jsRuntimeArrayJs).toContain('emits:[`submit`,`cancel`]')
    expect(jsRuntimeArrayJs).toContain('emitSubmit')
    expect(jsRuntimeArrayJs).toContain('emitCancel')
    expect(jsRuntimeArrayJs).toMatch(/setup\([^)]*\{expose:[^,}]+,emit:[^}]+\}\)/)

    expect(jsRuntimeObjectJson.component).toBe(true)
    expect(jsRuntimeObjectJs).toContain('message:{type:String,default:`js-default-message`}')
    expect(jsRuntimeObjectJs).toContain('level:{type:Number,required:!0}')
    expect(jsRuntimeObjectJs).toContain('change')
    expect(jsRuntimeObjectJs).toContain('close')
    expect(jsRuntimeObjectJs).toContain('emitChange')
    expect(jsRuntimeObjectJs).toContain('emitClose')
    expect(jsRuntimeObjectJs).toMatch(/setup\([^)]*\{expose:[^,}]+,emit:[^}]+\}\)/)
  })

  it('reports JS withDefaults + runtime defineProps as unsupported and keeps TS path as canonical', async () => {
    await fs.remove(INVALID_JS_WITH_DEFAULTS_DIST_ROOT)
    const result = await execa(
      'node',
      [CLI_PATH, 'build', INVALID_JS_WITH_DEFAULTS_APP_ROOT, '--platform', 'weapp', '--skipNpm'],
      {
        cwd: INVALID_JS_WITH_DEFAULTS_APP_ROOT,
        reject: false,
      },
    )

    expect(result.exitCode).not.toBe(0)
    const output = `${result.stdout}\n${result.stderr}`
    expect(output).toContain('withDefaults can only be used with type-based defineProps declaration')
  })
})
