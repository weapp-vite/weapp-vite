import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const cwd = fileURLToPath(new URL("./", import.meta.url));
const realComponent = new URL("./shared/components/ReproLabel.vue", import.meta.url);
const wrongComponent = new URL("./src/components/ReproLabel.vue", import.meta.url);
assert.ok(existsSync(realComponent), "共享组件文件必须真实存在");
assert.ok(!existsSync(wrongComponent), "宿主目录不能存在同名组件，以免掩盖错误路径");

function build(script) {
  const result = spawnSync("pnpm", ["run", script], { cwd, encoding: "utf8", timeout: 120000 });
  if (result.error) throw result.error;
  assert.equal(result.signal, null, "构建不能因信号中断");
  const log = result.stdout + result.stderr;
  writeFileSync(new URL("./" + script.replace(":", "-") + ".log", import.meta.url), log);
  return { status: result.status, log: log.replaceAll("\\", "/") };
}

const raw = build("build");
assert.notEqual(raw.status, 0, "7.10.0 的无规避构建应触发路径错误；若已修复请更新此验证");
assert.match(raw.log, /ENOENT/);
assert.ok(raw.log.includes(fileURLToPath(wrongComponent).replaceAll("\\", "/")), raw.log);
console.log("已复现：构建误读 src/components/ReproLabel.vue，而非真实 shared/components/ReproLabel.vue。");

const workaround = build("build:workaround");
assert.equal(workaround.status, 0, workaround.log);
const output = new URL("./dist/workaround/", import.meta.url);
const page = JSON.parse(readFileSync(new URL("pages/index/index.json", output), "utf8"));
assert.equal(page.usingComponents["repro-label"], "/shared/components/ReproLabel");
assert.equal(readFileSync(new URL("pages/index/index.wxml", output), "utf8").trim(), "<repro-label />");
assert.ok(existsSync(new URL("shared/components/ReproLabel.js", output)));
assert.match(readFileSync(new URL("shared/components/ReproLabel.wxml", output), "utf8"), /来自共享目录的组件/);
console.log("对照通过：只纠正组件路径后构建成功，页面注册和组件产物均指向 shared 目录。");
