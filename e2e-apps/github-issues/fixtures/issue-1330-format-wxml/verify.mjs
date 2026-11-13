import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function textContent(mode) {
  const wxml = readFileSync(new URL("./dist/" + mode + "/pages/index/index.wxml", import.meta.url), "utf8");
  const match = wxml.match(/<text id="actual">([\s\S]*?)<\/text>\s*<\/view>/);
  assert.ok(match, "构建产物必须包含实际场景的 text 节点");
  return match[1].replace(/<[^>]+>/g, "");
}

const formatted = textContent("formatted");
const compact = textContent("compact");
assert.match(formatted, /[\r\n]/, "7.10.0 开启格式化后向 text 内容插入换行");
assert.doesNotMatch(compact, /[\r\n]/, "关闭格式化后 text 内容不含换行");
assert.equal(formatted.replace(/\s/g, ""), compact.replace(/\s/g, ""));
assert.notEqual(formatted, compact);
console.log("已复现：仅切换 formatWxml 就改变了文本空白。");
console.log("formatted:", JSON.stringify(formatted));
console.log("compact:  ", JSON.stringify(compact));
