import type { Language, ShotKind } from './timeline'

export interface PhaseCopy {
  kicker: string
  detail: string
  rail: string
}

export interface ShotCopy {
  label: string
  title: readonly [string, string]
  phases: readonly [PhaseCopy, PhaseCopy, PhaseCopy]
}

export interface PromoCopy {
  language: Language
  brand: {
    topTag: string
    bottomTag: string
    functionalDemo: string
    engineered: string
  }
  intro: {
    kicker: string
    phases: readonly [readonly [string, string], readonly [string, string], readonly [string, string]]
    sublines: readonly [string, string, string]
  }
  outro: {
    kicker: string
    tagline: readonly [string, string]
    command: string
    url: string
  }
  ui: {
    project: string
    nativeDetail: string
    nativeFiles: string
    toolchain: string
    typeCaption: string
    buildCaption: string
    ecosystemCaption: string
    familiarSyntax: string
    oneFile: string
    event: string
    stateUpdated: string
    computedCaption: string
    currentState: string
    beforeStyle: string
    editStyle: string
    sameState: string
    palette: string
    routeLabel: string
    createFile: string
    autoDiscover: string
    readyNavigate: string
    componentWrite: string
    localComponent: string
    autoImport: string
    relationGenerated: string
    readyCompose: string
    ecosystem: string
    dependencies: string
    organized: string
    oneToolchain: string
    scenario: string
    interaction: string
    observe: string
    enterScene: string
    interact: string
    observeState: string
    scenarioDetail: string
    interactionDetail: string
    observeDetail: string
    screenTitle: string
    screenIdle: string
    screenPrompt: string
    add: string
    added: string
    screenReady: string
    screenshot: string
    screenshotDetail: string
    runtimeLog: string
    logResult: string
    keepIterating: string
    iterateResult: string
    logScene: string
    logInput: string
    logTap: string
    logState: string
    code: string
    run: string
    evidence: string
  }
  shots: Record<ShotKind, ShotCopy>
}

const zhShots: Record<ShotKind, ShotCopy> = {
  'intro': { label: 'Modern experience', title: ['小程序开发，', '进入现代节奏。'], phases: [{ kicker: '原生小程序', detail: '从熟悉的能力出发。', rail: '原生文件 · Native roots' }, { kicker: '保留能力', detail: '继续使用现有项目。', rail: 'Native API · Existing app' }, { kicker: '现代工具链', detail: '让每次修改更快看见。', rail: 'weapp-vite · Modern flow' }] },
  'native': { label: 'Native first', title: ['原生能力，', '继续用。'], phases: [{ kicker: '项目结构', detail: '原生文件逐项就位。', rail: 'WXML · WXSS · JSON · TS' }, { kicker: '原生写法', detail: 'Page 与 Component 保持熟悉。', rail: 'Page · Component · Native APIs' }, { kicker: '渐进升级', detail: '从现有项目开始，渐进升级。', rail: 'Keep native · Upgrade incrementally' }] },
  'toolchain': { label: 'Modern toolchain', title: ['工具链，', '向前一步。'], phases: [{ kicker: '类型安全', detail: '让类型成为你的助手。', rail: 'TypeScript · Typed code' }, { kicker: '现代构建', detail: 'Vite 与 Rolldown 进入小程序。', rail: 'Vite · Rolldown · Fast build' }, { kicker: '熟悉生态', detail: '继续使用熟悉的工具。', rail: 'ESM · Tailwind · npm' }] },
  'sfc': { label: 'Vue SFC', title: ['熟悉的 Vue，', '写进小程序。'], phases: [{ kicker: '熟悉语法', detail: '从你熟悉的写法开始。', rail: '<script setup> · ref · computed' }, { kicker: '一份文件', detail: '逻辑、模板、样式完整表达。', rail: 'Logic · Template · Style' }, { kicker: '连接界面', detail: 'Vue 语法，连接小程序。', rail: 'Vue SFC → Mini program' }] },
  'reactivity': { label: 'Reactive flow', title: ['一次点击，', '视图响应。'], phases: [{ kicker: '用户动作', detail: '点击改变状态。', rail: '@tap count++ · User action' }, { kicker: '单一来源', detail: '状态更新，界面同步。', rail: 'count.value++ · One source of truth' }, { kicker: '计算结果', detail: '状态联动，结果即现。', rail: 'computed = 2 · UI updates' }] },
  'style': { label: 'Style update', title: ['改完，', '就能看见。'], phases: [{ kicker: '当前主题', detail: '状态保持不变。', rail: '#95EC69 · Current style' }, { kicker: '改变风格', detail: '给界面一点新颜色。', rail: '#FACC15 · Edit style' }, { kicker: '状态保留', detail: '风格焕新，结果即现。', rail: 'SAME STATE · NEW LOOK' }] },
  'routes': { label: 'Automatic routes', title: ['新页面，', '自动发现。'], phases: [{ kicker: '创建文件', detail: '页面从一个文件开始。', rail: 'pages/inspire/index.vue' }, { kicker: '文件到路由', detail: '关联关系自动生成。', rail: 'file → route · Auto discover' }, { kicker: '准备导航', detail: '新页面已就位。', rail: 'app.json · Ready to navigate' }] },
  'components': { label: 'Auto import', title: ['写下组件，', '自动导入。'], phases: [{ kicker: '写下组件', detail: '从一个组件开始。', rail: '<InspireCard /> · Write it' }, { kicker: '自动导入', detail: '关联关系自动生成。', rail: 'usingComponents · Auto import' }, { kicker: '组合界面', detail: '组件就在这里。', rail: 'compose · Ready to use' }] },
  'packages': { label: 'Dependencies', title: ['npm 与分包，', '统一处理。'], phases: [{ kicker: '使用生态', detail: '熟悉的依赖继续使用。', rail: 'npm · Use what you know' }, { kicker: '依赖组织', detail: '依赖与分包清晰归位。', rail: 'npm + packages · Dependencies' }, { kicker: '统一工具链', detail: '主包与分包一并处理。', rail: 'main + subPackages · One toolchain' }] },
  'runtime': { label: 'AI runtime', title: ['让 AI 看见，', '运行现场。'], phases: [{ kicker: '进入场景', detail: '让运行现场成为上下文。', rail: 'scenario · Enter scene' }, { kicker: '连续交互', detail: '把输入、点击和状态串起来。', rail: 'input → tap → state · Interactions' }, { kicker: '观察状态', detail: '从界面变化继续分析。', rail: 'state → next action · Observe' }] },
  'evidence': { label: 'Runtime evidence', title: ['截图。日志。', '继续迭代。'], phases: [{ kicker: '截图', detail: '把当前画面带回协作。', rail: 'screenshot · Shared context' }, { kicker: '运行日志', detail: '运行结果接住下一步。', rail: 'runtime log · Replayable facts' }, { kicker: '继续迭代', detail: '让下一次修改有依据。', rail: 'code → run → evidence · Iterate' }] },
  'native-toolchain': { label: 'Native to modern', title: ['保留原生，', '升级工具链。'], phases: [{ kicker: '原生结构', detail: '原生文件继续保留。', rail: 'WXML · WXSS · JSON · TS' }, { kicker: '类型安全', detail: '让类型成为你的助手。', rail: 'TypeScript · Typed code' }, { kicker: '现代构建', detail: 'Vite 与 Rolldown 向前一步。', rail: 'Vite · Rolldown · Fast build' }] },
  'vue': { label: 'Vue reactive flow', title: ['熟悉的 Vue，', '流动的界面。'], phases: [{ kicker: '状态', detail: '写下状态，让界面流动。', rail: 'ref · computed · Wevu' }, { kicker: '动作', detail: '一次点击，视图响应。', rail: '@tap · count.value++' }, { kicker: '结果', detail: '计算结果即时出现。', rail: 'computed = 2 · Reactive UI' }] },
  'automation': { label: 'Automatic engineering', title: ['把重复工作，', '交给工具链。'], phases: [{ kicker: '自动路由', detail: '文件连接到页面。', rail: 'route · page · app.json' }, { kicker: '自动组件', detail: '组件引用自动归位。', rail: 'component · usingComponents' }, { kicker: '依赖分包', detail: 'npm 与分包统一处理。', rail: 'npm · packages · subPackages' }] },
  'ai': { label: 'AI and evidence', title: ['让 AI 看见，', '运行中的小程序。'], phases: [{ kicker: '运行现场', detail: '进入场景并开始交互。', rail: 'scenario · input · tap' }, { kicker: '截图证据', detail: '界面成为共享上下文。', rail: 'screenshot · Shared context' }, { kicker: '日志迭代', detail: '根据运行结果继续修改。', rail: 'runtime log · Iterate' }] },
  'outro': { label: 'Start creating', title: ['给小程序', '现代化的开发体验'], phases: [{ kicker: '创建项目', detail: '从下一次想法开始。', rail: 'Start building · Create a project' }, { kicker: '现代体验', detail: '原生能力与现代工具链。', rail: 'Native roots · Modern flow' }, { kicker: '现在开始', detail: '把想法带进运行现场。', rail: 'pnpm · weapp-vite · vite.weapp.dev' }] },
}

const enShots: Record<ShotKind, ShotCopy> = {
  'intro': { label: 'Modern experience', title: ['Mini program dev,', 'in a modern rhythm.'], phases: [{ kicker: 'Native mini programs', detail: 'Start with the power you know.', rail: 'Native files · Existing APIs' }, { kicker: 'Keep native', detail: 'Bring the current project forward.', rail: 'Native roots · Existing app' }, { kicker: 'Modern toolchain', detail: 'See every change sooner.', rail: 'weapp-vite · Modern flow' }] },
  'native': { label: 'Native first', title: ['Keep the native', 'power.'], phases: [{ kicker: 'Project structure', detail: 'Native files fall into place.', rail: 'WXML · WXSS · JSON · TS' }, { kicker: 'Native APIs', detail: 'Page and Component stay familiar.', rail: 'Page · Component · Native APIs' }, { kicker: 'Upgrade incrementally', detail: 'Start from the project you have.', rail: 'Keep native · Upgrade incrementally' }] },
  'toolchain': { label: 'Modern toolchain', title: ['Move your', 'toolchain forward.'], phases: [{ kicker: 'Typed code', detail: 'Let types become your assistant.', rail: 'TypeScript · Typed code' }, { kicker: 'Fast build', detail: 'Vite and Rolldown enter mini programs.', rail: 'Vite · Rolldown · Fast build' }, { kicker: 'Familiar ecosystem', detail: 'Keep using the tools you know.', rail: 'ESM · Tailwind · npm' }] },
  'sfc': { label: 'Vue SFC', title: ['Familiar Vue,', 'now in mini programs.'], phases: [{ kicker: 'Familiar syntax', detail: 'Start with the way you already write.', rail: '<script setup> · ref · computed' }, { kicker: 'One file', detail: 'Logic, template and style in one place.', rail: 'Logic · Template · Style' }, { kicker: 'Connect the UI', detail: 'Vue syntax, connected to mini programs.', rail: 'Vue SFC → Mini program' }] },
  'reactivity': { label: 'Reactive flow', title: ['One tap,', 'reactive UI.'], phases: [{ kicker: 'User action', detail: 'A tap changes state.', rail: '@tap count++ · User action' }, { kicker: 'One source of truth', detail: 'State updates, UI follows.', rail: 'count.value++ · One source of truth' }, { kicker: 'Computed result', detail: 'The result appears immediately.', rail: 'computed = 2 · UI updates' }] },
  'style': { label: 'Style update', title: ['Change style,', 'see it instantly.'], phases: [{ kicker: 'Current style', detail: 'Keep the state exactly where it is.', rail: '#95EC69 · Current style' }, { kicker: 'Edit style', detail: 'Give the interface a new color.', rail: '#FACC15 · Edit style' }, { kicker: 'Same state', detail: 'New look, same result.', rail: 'SAME STATE · NEW LOOK' }] },
  'routes': { label: 'Automatic routes', title: ['New pages,', 'auto-discovered.'], phases: [{ kicker: 'Create a file', detail: 'A page starts with one file.', rail: 'pages/inspire/index.vue' }, { kicker: 'File to route', detail: 'The relation is generated for you.', rail: 'file → route · Auto discover' }, { kicker: 'Ready to navigate', detail: 'The new page is ready.', rail: 'app.json · Ready to navigate' }] },
  'components': { label: 'Auto import', title: ['Write components,', 'import automatically.'], phases: [{ kicker: 'Write it', detail: 'Start with one component.', rail: '<InspireCard /> · Write it' }, { kicker: 'Auto import', detail: 'The relation is generated for you.', rail: 'usingComponents · Auto import' }, { kicker: 'Ready to compose', detail: 'The component is ready here.', rail: 'compose · Ready to use' }] },
  'packages': { label: 'Dependencies', title: ['npm and subpackages,', 'one toolchain.'], phases: [{ kicker: 'Use what you know', detail: 'Bring your familiar dependencies.', rail: 'npm · Use what you know' }, { kicker: 'Organize dependencies', detail: 'Dependencies and packages align.', rail: 'npm + packages · Dependencies' }, { kicker: 'One toolchain', detail: 'Main and subpackages move together.', rail: 'main + subPackages · One toolchain' }] },
  'runtime': { label: 'AI runtime', title: ['Let AI see', 'the running app.'], phases: [{ kicker: 'Enter the scene', detail: 'Make the running app context.', rail: 'scenario · Enter scene' }, { kicker: 'Interactions', detail: 'Connect input, tap and state.', rail: 'input → tap → state · Interactions' }, { kicker: 'Observe state', detail: 'Read the next move from the UI.', rail: 'state → next action · Observe' }] },
  'evidence': { label: 'Runtime evidence', title: ['Screenshots. Logs.', 'Keep iterating.'], phases: [{ kicker: 'Screenshot', detail: 'Bring the current screen back to the team.', rail: 'screenshot · Shared context' }, { kicker: 'Runtime log', detail: 'Turn runtime results into the next move.', rail: 'runtime log · Replayable facts' }, { kicker: 'Keep iterating', detail: 'Give the next change a reason.', rail: 'code → run → evidence · Iterate' }] },
  'outro': { label: 'Start creating', title: ['A modern development', 'experience for mini programs.'], phases: [{ kicker: 'Start building', detail: 'Begin with the next idea.', rail: 'Start building · Create a project' }, { kicker: 'Modern experience', detail: 'Native power with a modern toolchain.', rail: 'Native roots · Modern flow' }, { kicker: 'Start now', detail: 'Bring the idea into the running app.', rail: 'pnpm · weapp-vite · vite.weapp.dev' }] },
  'native-toolchain': { label: 'Native to modern', title: ['Keep native,', 'upgrade the toolchain.'], phases: [{ kicker: 'Native structure', detail: 'Keep the native files in place.', rail: 'WXML · WXSS · JSON · TS' }, { kicker: 'Typed code', detail: 'Let types become your assistant.', rail: 'TypeScript · Typed code' }, { kicker: 'Fast build', detail: 'Vite and Rolldown move you forward.', rail: 'Vite · Rolldown · Fast build' }] },
  'vue': { label: 'Vue reactive flow', title: ['Familiar Vue,', 'a UI that flows.'], phases: [{ kicker: 'State', detail: 'Write state and let the UI flow.', rail: 'ref · computed · Wevu' }, { kicker: 'Action', detail: 'One tap, reactive UI.', rail: '@tap · count.value++' }, { kicker: 'Result', detail: 'Computed results appear at once.', rail: 'computed = 2 · Reactive UI' }] },
  'automation': { label: 'Automatic engineering', title: ['Give repetitive work', 'to the toolchain.'], phases: [{ kicker: 'Auto routes', detail: 'Connect a file to a page.', rail: 'route · page · app.json' }, { kicker: 'Auto components', detail: 'Component references fall into place.', rail: 'component · usingComponents' }, { kicker: 'Dependencies', detail: 'npm and packages move together.', rail: 'npm · packages · subPackages' }] },
  'ai': { label: 'AI and evidence', title: ['Let AI see', 'the running mini program.'], phases: [{ kicker: 'Running scene', detail: 'Enter the scene and interact.', rail: 'scenario · input · tap' }, { kicker: 'Screenshot evidence', detail: 'Make the UI shared context.', rail: 'screenshot · Shared context' }, { kicker: 'Logs to iteration', detail: 'Use runtime results for the next change.', rail: 'runtime log · Iterate' }] },
}

const zh: PromoCopy = {
  language: 'zh',
  brand: { topTag: 'NATIVE ROOTS. MODERN FLOW.', bottomTag: 'BUILD WITH POSSIBILITY', functionalDemo: '功能演绎', engineered: 'ENGINEERED FOR MINI PROGRAMS' },
  intro: { kicker: 'CREATE. BUILD. GO.', phases: [['小程序开发，', '进入现代节奏。'], ['原生底色。', '现代锋芒。'], ['weapp-vite', '给小程序现代化的开发体验']], sublines: ['NATIVE × MODERN', 'YOUR IDEAS, IN MOTION', 'START SOMETHING NEW'] },
  outro: { kicker: 'YOUR NEXT PROJECT STARTS HERE', tagline: ['给小程序', '现代化的开发体验'], command: 'pnpm create weapp-vite', url: 'vite.weapp.dev' },
  ui: { project: 'YOUR PROJECT', nativeDetail: '原生的写法，原生的能力。', nativeFiles: 'WXML · WXSS · JSON', toolchain: 'MODERN TOOLCHAIN', typeCaption: '让类型成为你的助手。', buildCaption: '现代构建，进入小程序。', ecosystemCaption: '熟悉的生态，继续创造。', familiarSyntax: 'FAMILIAR SYNTAX. NEW POSSIBILITIES.', oneFile: '一份文件，完整表达。', event: 'EVENT / @tap="count++"', stateUpdated: '状态已更新', computedCaption: '状态联动，结果即现。', currentState: 'CURRENT STATE', beforeStyle: 'BEFORE / 当前主题', editStyle: 'EDIT / 改变风格', sameState: 'SAME STATE. NEW LOOK.', palette: 'YOUR NEW PALETTE', routeLabel: 'ROUTES / 新页面', createFile: 'CREATE A FILE', autoDiscover: '自动发现。', readyNavigate: '新页面，已就位。', componentWrite: 'COMPONENT / WRITE IT', localComponent: 'LOCAL COMPONENT', autoImport: 'AUTO IMPORT / 原生组件声明', relationGenerated: '关联关系，自动生成。', readyCompose: 'READY TO COMPOSE', ecosystem: 'NPM / YOUR ECOSYSTEM', dependencies: 'DEPENDENCIES / 分包组织', organized: '熟悉的依赖，清晰的组织。', oneToolchain: 'ONE TOOLCHAIN', scenario: 'SCENARIO', interaction: 'INTERACTION', observe: 'OBSERVE', enterScene: '进入场景。', interact: '点击。输入。', observeState: '看见状态。', scenarioDetail: '让运行现场成为上下文', interactionDetail: '把交互过程串起来', observeDetail: '从界面变化继续分析', screenTitle: '灵感清单', screenIdle: '今天，创造什么？', screenPrompt: '输入你的想法…', add: '加入清单', added: '已加入清单', screenReady: '想法，已经就位。', screenshot: 'SCREENSHOT', screenshotDetail: '把当前画面带回协作。', runtimeLog: 'RUNTIME LOG / 示例', logResult: '运行结果，接住下一步。', keepIterating: 'KEEP ITERATING', iterateResult: '让下一次修改，有依据。', logScene: 'scene', logInput: 'input', logTap: 'tap', logState: 'state', code: '代码', run: '运行', evidence: '证据' },
  shots: zhShots,
}

const en: PromoCopy = {
  language: 'en',
  brand: { topTag: 'NATIVE ROOTS. MODERN FLOW.', bottomTag: 'BUILD WITH POSSIBILITY', functionalDemo: 'FUNCTIONAL DEMO', engineered: 'ENGINEERED FOR MINI PROGRAMS' },
  intro: { kicker: 'CREATE. BUILD. GO.', phases: [['Mini program dev,', 'in a modern rhythm.'], ['Native roots.', 'Modern edge.'], ['weapp-vite', 'A modern development experience']], sublines: ['NATIVE × MODERN', 'YOUR IDEAS, IN MOTION', 'START SOMETHING NEW'] },
  outro: { kicker: 'YOUR NEXT PROJECT STARTS HERE', tagline: ['A modern development', 'experience for mini programs.'], command: 'pnpm create weapp-vite', url: 'vite.weapp.dev' },
  ui: { project: 'YOUR PROJECT', nativeDetail: 'Native syntax. Native power.', nativeFiles: 'WXML · WXSS · JSON', toolchain: 'MODERN TOOLCHAIN', typeCaption: 'Let types become your assistant.', buildCaption: 'Modern build for mini programs.', ecosystemCaption: 'Keep the ecosystem you know.', familiarSyntax: 'FAMILIAR SYNTAX. NEW POSSIBILITIES.', oneFile: 'One file. Complete expression.', event: 'EVENT / @tap="count++"', stateUpdated: 'STATE UPDATED', computedCaption: 'Reactive state. Instant result.', currentState: 'CURRENT STATE', beforeStyle: 'BEFORE / CURRENT STYLE', editStyle: 'EDIT / CHANGE STYLE', sameState: 'SAME STATE. NEW LOOK.', palette: 'YOUR NEW PALETTE', routeLabel: 'ROUTES / NEW PAGE', createFile: 'CREATE A FILE', autoDiscover: 'AUTO-DISCOVERED.', readyNavigate: 'READY TO NAVIGATE.', componentWrite: 'COMPONENT / WRITE IT', localComponent: 'LOCAL COMPONENT', autoImport: 'AUTO IMPORT / NATIVE DECLARATION', relationGenerated: 'RELATION GENERATED.', readyCompose: 'READY TO COMPOSE', ecosystem: 'NPM / YOUR ECOSYSTEM', dependencies: 'DEPENDENCIES / PACKAGE SPLIT', organized: 'Familiar dependencies. Clear organization.', oneToolchain: 'ONE TOOLCHAIN', scenario: 'SCENARIO', interaction: 'INTERACTION', observe: 'OBSERVE', enterScene: 'ENTER THE SCENE.', interact: 'TAP. TYPE.', observeState: 'SEE THE STATE.', scenarioDetail: 'Make the running app context', interactionDetail: 'Connect the interaction flow', observeDetail: 'Read the next move from the UI', screenTitle: 'IDEA LIST', screenIdle: 'What will you create today?', screenPrompt: 'Type your idea…', add: 'ADD TO LIST', added: 'ADDED TO LIST', screenReady: 'IDEA IN PLACE.', screenshot: 'SCREENSHOT', screenshotDetail: 'Bring the current screen back to the team.', runtimeLog: 'RUNTIME LOG / SAMPLE', logResult: 'Runtime result. Next move.', keepIterating: 'KEEP ITERATING', iterateResult: 'Give the next change a reason.', logScene: 'scene', logInput: 'input', logTap: 'tap', logState: 'state', code: 'CODE', run: 'RUN', evidence: 'EVIDENCE' },
  shots: enShots,
}

export function copyFor(language: Language): PromoCopy {
  return language === 'en' ? en : zh
}
