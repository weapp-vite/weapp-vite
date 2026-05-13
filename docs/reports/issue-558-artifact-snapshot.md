# Issue 558 Artifact Snapshot

Generated from targeted package builds on PR #573 branch `fix/issue-558-codex`.
This file intentionally tracks a small dist fingerprint so future artifact changes show up as a normal git diff.

## Package Dist Summary

| package | files | bytes | key outputs |
| --- | ---: | ---: | --- |
| @weapp-core/constants | 2 | 20413 | `index.d.ts:10651:b647a0931ed0f8bf`<br>`index.js:9762:5a4cf2269e1bf5dc` |
| wevu | 46 | 1518363 | `compiler.d.mts:31:27f701e7193a45f0`<br>`compiler.mjs:37:5d094e8940a09118`<br>`dev/compiler.mjs:44:51b3f3676b94f073`<br>`dev/index.mjs:5784:44a09e9c673adf41`<br>`dev/router.mjs:55782:b14c29de16aff948`<br>`index.d.mts:21115:c24dcc79364e6f42`<br>`index.mjs:4438:5fae215f2fdf5dc9`<br>`router.d.mts:9564:5d5675b7e091caa2` |
| @wevu/compiler | 2 | 354077 | `index.d.mts:28404:d7a15deb10d1cd59`<br>`index.mjs:325673:cfe4b718726c99c3` |
| weapp-vite | 48 | 1365617 | `cli.d.mts:11:4f1bad288ada6326`<br>`cli.mjs:184147:4b25e67c7a13084e`<br>`config.d.mts:1115:036160a6055d4470`<br>`config.mjs:620:c84f5a1c63d911d5`<br>`index.d.mts:3050:a7867e77782cd63d`<br>`index.mjs:1194:52f9cff5cacc34c6`<br>`runtime.d.mts:244:51b84fbcab42abe1`<br>`runtime.mjs:196:71a072559ee85c95` |

## Focus Markers

- `weapp-vite/dist/cli.mjs` should include the current compiler and transform pipeline used by downstream app builds.
- `packages-runtime/wevu/dist/**` should include owner proxy support for augmented scoped slot runtime bindings.
- `packages-runtime/wevu-compiler/dist/**` should include generated owner-proxy expression support for issue #558 scoped slot cases.
- `@weapp-core/constants/dist/**` should include the shared runtime owner marker exported from source.
