export const printerCases = [
  { id: 'unicode-crlf', source: 'const label = "😀"; const 数量 = 2;\r\nexport { 数量, label };' },
  { id: 'directives-asi', source: '"use strict"; function f() { return\n { value: 1 }; } export { f };' },
  { id: 'annotations', source: '/*! @license sample */\n/* @__PURE__ */ factory(); // ordinary comment\nexport const value = /* @__NO_SIDE_EFFECTS__ */ () => 1;' },
  { id: 'computed-optional', source: 'const key = "name"; const obj = { [key]: 1 }; export const result = obj?.[key] ?? 0;' },
  { id: 'private-class', source: 'export class Sample { #value = 2; static total = 1; static { this.total++; } read() { return this.#value; } }' },
  { id: 'scope-shorthand', source: 'let value = 1; const obj = { value }; function change(value) { return { value }; } export { value as renamed, obj, change };' },
  { id: 'async-generator', source: 'export async function* items(input) { for await (const value of input) { yield value; } }' },
  // eslint-disable-next-line no-template-curly-in-string -- 该源码样本必须保留被测模板表达式。
  { id: 'regexp-template', source: 'const pattern = /😀+/u; export const render = value => `😀${pattern.test(value)}`;' },
]

export const rejectedPrinterCases = [
  { id: 'typescript', source: 'const value: number = 1', filename: 'inline.ts', status: 'unsupported-source-type' },
  { id: 'jsx', source: 'const view = <view/>', filename: 'inline.jsx', status: 'unsupported-source-type' },
  { id: 'typescript-disguised', source: 'const value: number = 1', filename: 'inline.js', status: 'parse-error' },
  { id: 'parse-error', source: 'const = ;', filename: 'inline.js', status: 'parse-error' },
  { id: 'invalid-regexp', source: 'const pattern = /[/;', filename: 'inline.js', status: 'parse-error' },
  { id: 'semantic-error', source: 'let value; let value;', filename: 'inline.js', status: 'semantic-error' },
] as const
