---
title: "Weapp Intrinsic Base Attributes"
date: "2026-01-13"
status: "approved"
---

# Overview

Add common WXML attributes to the generated base type that all intrinsic
components inherit, so JSX/TS hints include shared attributes consistently.

# Goals

- Provide `id`, `class`, `style`, and `hidden` on every intrinsic element.
- Keep all four attributes optional to match existing platform behavior.
- Preserve extensibility for element-specific attributes and unknown fields.

# Implementation

- Update the generator to emit a base type with the four attributes.
- Keep the base type intersected with `Record<string, unknown>`.
- Regenerate the intrinsic element types so outputs stay in sync.

# Testing

- No runtime tests required; rely on type-checking and IDE hints.

# Out of Scope

- Changing element-specific attribute lists.
- Adding new runtime behavior.
