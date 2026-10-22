import { WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY, WEAPP_VITE_STATEFUL_HMR_CONTROL_KEY, WEAPP_VITE_STATEFUL_HMR_DIRECTORY } from '@weapp-core/constants'
import { describe, expect, it } from 'vitest'
import { assertNoStatefulInstallations } from './installedRuntime.mjs'

describe('classic emitted stateful installation inspection', () => {
  it.each([
    [WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY, 'WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY'],
    [WEAPP_VITE_STATEFUL_HMR_CONTROL_KEY, 'WEAPP_VITE_STATEFUL_HMR_CONTROL_KEY'],
    [WEAPP_VITE_STATEFUL_HMR_DIRECTORY, 'WEAPP_VITE_STATEFUL_HMR_DIRECTORY'],
  ])('allows inert public constants but rejects executable uses of %s', (key, publicName) => {
    const literal = JSON.stringify(key)
    const template = `\`${key}\``
    const escapedLiteral = literal.replaceAll('_', '\\u005f')
    const split = Math.floor(key.length / 2)
    const concatenated = `${JSON.stringify(key.slice(0, split))} + ${JSON.stringify(key.slice(split))}`
    for (const source of [
      `const arbitraryAlias = ${literal};`,
      `var arbitraryAlias = ${literal}; exports.${publicName} = arbitraryAlias;`,
      `const arbitraryAlias = ${literal}; module.exports.${publicName} = arbitraryAlias;`,
      `const arbitraryAlias = ${literal}; export { arbitraryAlias as ${publicName} };`,
      `export const ${publicName} = ${literal};`,
      `exports.${publicName} = ${literal};`,
      `module['exports'] = { ${publicName}: ${literal} };`,
      `const a = ${literal}; const b = a; exports.${publicName} = b;`,
      `const a = ${template}; export { a as ${publicName} };`,
      `const a = ${escapedLiteral}; export { a as ${publicName} };`,
      `const a = ${concatenated}; export { a as ${publicName} };`,
      `const a = ${literal}; const b = \`\${a}\`; exports.${publicName} = b;`,
      `import { ${publicName} as a } from '@weapp-core/constants'; export { a as ${publicName} };`,
      `import { '${publicName}' as a } from '@weapp-core/constants'; export { a as ${publicName} };`,
      `const { ${publicName}: a } = require('@weapp-core/constants'); exports.${publicName} = a;`,
      `const a = require('@weapp-core/constants').${publicName}; exports.${publicName} = a;`,
      `const a = ${literal}; exports.${publicName} = a; function unrelated(a) { return a + 1; }`,
      `const a = ${literal}; exports.${publicName} = a; { const a = 'ordinary'; console.log(a); }`,
      `${literal};`,
      `${template};`,
      `var a = ${literal}; \`\${a}\`; \`\${a}\`; \`\${a}\`;`,
      `const a = ${literal}; const b = a; \`\${b}\`;`,
      `const a = ${literal}; \`\${a + '/discarded'}\`;`,
      `const a = ${literal}; a + '/discarded';`,
      `function unrelated(${publicName}) { return ${publicName}; }`,
      `// ${key}\nApp({});`,
    ]) {
      for (const filename of ['app.js', 'vendor/constants.js', 'vendor/runtime.js']) {
        expect(() => assertNoStatefulInstallations(filename, source), source).not.toThrow()
      }
    }
    for (const source of [
      `globalThis[${literal}] = {};`,
      `globalThis[${template}] = {};`,
      `globalThis[${escapedLiteral}] = {};`,
      `globalThis[${concatenated}] = {};`,
      `globalThis.${key} = {};`,
      `const a = ${literal}; const b = a; globalThis[b] = {};`,
      `const a = ${literal}; const b = \`\${a}\`; globalThis[b] = {};`,
      `const a = ${literal}; exports.${publicName} = a; wx[a] = {};`,
      `const a = ${literal}; install(a);`,
      `const a = ${literal}; \`\${a}\`; install(a);`,
      `const a = ${literal}; \`\${a}\`; globalThis[a] = {};`,
      `const a = ${literal}; \`\${a + unknown}\`;`,
      `const a = ${literal}; \`\${a}\${read()}\`;`,
      `const a = ${literal}; a + read();`,
      `const a = ${literal}; (a, 'ordinary');`,
      `let a = ${literal}; a = 'ordinary'; \`\${a}\`;`,
      `void install(${literal});`,
      `\`\${constants.${publicName}}\`;`,
      `const a = constants.${publicName}; \`\${a}\`;`,
      `import { ${publicName} as a } from '@weapp-core/constants'; \`\${a}\`;`,
      `const { ${publicName}: a } = require('@weapp-core/constants'); \`\${a}\`;`,
      `import { ${publicName} as a } from '@weapp-core/constants'; globalThis[a] = {};`,
      `import { '${publicName}' as a } from '@weapp-core/constants'; globalThis[a] = {};`,
      `import * as constants from '@weapp-core/constants'; globalThis[constants.${publicName}] = {};`,
      `const { ${publicName}: a } = require('@weapp-core/constants'); globalThis[a] = {};`,
      `let { ${publicName}: a } = require('@weapp-core/constants'); globalThis[a] = {}; a = 'ordinary';`,
      `const { ['${publicName}']: a = 'ordinary' } = require('@weapp-core/constants'); wx[a] = {};`,
      `const { ${publicName}: a } = require('@weapp-core/constants'); const b = a; globalThis[b] = {};`,
      `globalThis[require('@weapp-core/constants').${publicName}] = {};`,
      `const { ${key}: client } = globalThis; client.poll();`,
      `Object.assign(globalThis, { ${key}: {} });`,
      `const a = ${literal}; function f(a) { return a; } globalThis[a] = {};`,
      `const a = ${literal}; function f() { const a = 'ordinary'; return a; } install(a);`,
      `const payload = ${JSON.stringify(`globalThis[${literal}] = {}`)}; install(payload);`,
      `const payload = \`globalThis[${key}] = \${unknown};\`; install(payload);`,
    ]) {
      expect(() => assertNoStatefulInstallations('vendor/runtime.js', source), source).toThrow(`must remove ${key}`)
    }
  })

  it('keeps constant bindings separate when minified wrappers reuse the same local name', () => {
    const source = `
      (function(exports) { var a = ${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY)}; exports.WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY = a; })({});
      (function(exports) { var a = ${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_CONTROL_KEY)}; exports.WEAPP_VITE_STATEFUL_HMR_CONTROL_KEY = a; })({});
      (function(a) { return a + 1; })(1);
    `
    expect(() => assertNoStatefulInstallations('vendor/runtime.js', source)).not.toThrow()
  })

  it.each([
    `require('./${WEAPP_VITE_STATEFUL_HMR_DIRECTORY}/control.js');`,
    `import './${WEAPP_VITE_STATEFUL_HMR_DIRECTORY}/control.js';`,
    `const directory = ${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_DIRECTORY)}; require(directory + '/control.js');`,
    `const directory = ${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_DIRECTORY)}; const entry = \`\${directory}/preload.js\`; read(entry);`,
    `const { WEAPP_VITE_STATEFUL_HMR_DIRECTORY: directory } = require('@weapp-core/constants'); read(directory + '/update.js');`,
  ])('rejects actual retired control paths even when composed through aliases: %s', (source) => {
    expect(() => assertNoStatefulInstallations('app.js', source)).toThrow(`must remove ${WEAPP_VITE_STATEFUL_HMR_DIRECTORY}`)
  })

  it('allows complete public path constants while rejecting any subsequent executable use', () => {
    const source = `
      var WEAPP_VITE_STATEFUL_HMR_DIRECTORY = ${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_DIRECTORY)};
      var WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE = \`\${WEAPP_VITE_STATEFUL_HMR_DIRECTORY}/control.js\`;
      var WEAPP_VITE_STATEFUL_HMR_PRELOAD_FILE = WEAPP_VITE_STATEFUL_HMR_DIRECTORY + '/preload.js';
      var WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE = \`\${WEAPP_VITE_STATEFUL_HMR_DIRECTORY}/update.js\`;
      exports.WEAPP_VITE_STATEFUL_HMR_DIRECTORY = WEAPP_VITE_STATEFUL_HMR_DIRECTORY;
      exports.WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE = WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE;
      exports.WEAPP_VITE_STATEFUL_HMR_PRELOAD_FILE = WEAPP_VITE_STATEFUL_HMR_PRELOAD_FILE;
      exports.WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE = WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE;
    `
    expect(() => assertNoStatefulInstallations('vendor/constants.js', source)).not.toThrow()
    for (const use of [
      'require(WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE);',
      'const alias = WEAPP_VITE_STATEFUL_HMR_PRELOAD_FILE; read(alias);',
      'globalThis[WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE] = {};',
    ]) {
      expect(() => assertNoStatefulInstallations('vendor/constants.js', source + use)).toThrow(`must remove ${WEAPP_VITE_STATEFUL_HMR_DIRECTORY}`)
    }
  })

  it('rejects malformed scripts containing the runtime contract', () => {
    expect(() => assertNoStatefulInstallations('broken.js', `const = ${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY)}`)).toThrow('Cannot inspect')
  })
})
