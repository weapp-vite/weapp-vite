import type { DevframeDefinition } from 'devframe'
import type { Plugin } from 'vite'
import type {
  AnalyzeDashboardDevframeController,
  AnalyzeSubpackagesResult,
  CreateAnalyzeDashboardDevframeOptions,
  DashboardAnalyzeSnapshot,
  DashboardArtifactFile,
  DashboardArtifactFiles,
  DashboardContentRoots,
  DashboardRuntimeEventInput,
  DashboardRuntimeEventProfile,
} from 'weapp-vite/dashboard'
import { expectError, expectType } from 'tsd'
import * as dashboard from 'weapp-vite/dashboard'
import { createAnalyzeDashboardDevframe, createDashboardArtifactSnapshot, resolveDashboardClientAssets } from 'weapp-vite/dashboard'
import { createAnalyzeDashboardPlugin } from 'weapp-vite/dashboard/vite'

declare const current: AnalyzeSubpackagesResult
declare const previous: AnalyzeSubpackagesResult

const artifacts = createDashboardArtifactSnapshot()
expectType<void>(artifacts.capture('app.js', 'Page({})'))
expectType<void>(artifacts.capture('app.wxss', new Uint8Array([1, 2])))
expectType<DashboardArtifactFiles>(artifacts.files)
expectType<DashboardArtifactFile | undefined>(artifacts.files.get('app.js'))
expectError(artifacts.files.clear())

const roots: DashboardContentRoots = { projectRoot: '/project', srcRoot: '/project/src', pluginRoot: '/plugin' }
const profile: DashboardRuntimeEventProfile = { totalMs: 12, sourceRootFile: 'app.ts' }
const event: DashboardRuntimeEventInput = { kind: 'build', level: 'success', title: 'Built', detail: 'Ready', profile }
const snapshot: DashboardAnalyzeSnapshot = { current, previous, artifacts: artifacts.files }
const options: CreateAnalyzeDashboardDevframeOptions = { snapshot, roots, initialEvents: [event], clientAssets: resolveDashboardClientAssets('/project') }
const controller = createAnalyzeDashboardDevframe(options)
const definition: DevframeDefinition = controller.definition
expectType<AnalyzeDashboardDevframeController>(controller)
expectType<DevframeDefinition>(controller.definition)
expectType<Promise<void>>(controller.update(current, artifacts.files))
expectType<Promise<void>>(controller.update(current, artifacts.files, previous))
expectType<Promise<void>>(controller.update(current, artifacts.files, null))
expectType<void>(controller.emitRuntimeEvents([event]))
expectType<void>(controller.dispose())
expectType<string | undefined>(resolveDashboardClientAssets())
expectType<Plugin>(createAnalyzeDashboardPlugin(controller))
expectType<Plugin>(createAnalyzeDashboardPlugin(controller, { base: '/tools/dashboard/' }))

expectError(createAnalyzeDashboardDevframe({ snapshot }))
expectError(createAnalyzeDashboardDevframe({ snapshot, roots, clientAssets: 123 }))
expectError(controller.update(current))
expectError(controller.definition = definition)
expectError(controller.emitRuntimeEvents([{ kind: 'unknown', level: 'info', title: '', detail: '' }]))
expectError(dashboard.createDashboardFileReader)
expectError(dashboard.readDashboardFileContent)
expectError(dashboard.createDashboardContentAllowlist)
