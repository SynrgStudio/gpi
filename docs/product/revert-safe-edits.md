# Revert-safe edits

## Goal

`Revert-safe edits` is an optional GPi mode that biases Pi toward file-editing behavior GPi can snapshot and revert.

It does not change Pi's system prompt. When enabled, GPi prefixes the user's prompt before sending it to Pi. The chat still displays the user's original prompt.

## User-facing copy

Toggle label:

```text
Revert-safe edits
```

Short help:

```text
Prefer read/edit/write file tools and ask Pi to declare files before shell mutations, so GPi can snapshot and revert this turn. May make some edits slower.
```

Long help:

```text
When enabled, GPi adds an instruction to the prompt sent to Pi. This helps GPi capture before/after file snapshots for Revert changes. It does not guarantee every change is revertible, especially broad shell commands or external side effects.
```

## Prompt prefix

Exact prefix for MVP:

```text
[GPi Revert-Safe Editing Mode]

For this turn, optimize for safe per-message revert.

Tool priority for file changes:
1. Read existing files with the file read tool before editing.
2. Modify existing files with the structured edit tool when practical.
3. Create or replace single files with the write file tool when practical.
4. Use shell/bash/python/powershell commands that mutate files only when structured file tools are impractical.

Before using a shell command that may create, modify, delete, move, or format files, first state the exact project-relative file paths you expect it to affect.

Do not use shell commands to modify files when read/edit/write tools can accomplish the same change with similar effort.

Reason: GPi can create reliable before/after snapshots and enable Revert changes when file paths are known before modification.

User request:
```

GPi appends the raw user prompt after `User request:`.

## Policy rationale

The mode is a priority policy, not a hard ban:

- Simple edits should use read/edit/write tools.
- Commands remain valid for generated files, many-file transformations, formatters, build/check commands, package scripts, and cases where structured tools are impractical.
- If commands are necessary, declaring expected paths gives GPi a chance to capture snapshots before mutation.

## Transparency rules

- The setting must be user-controlled.
- The setting should be off by default until the user enables it.
- GPi should make clear that the prompt sent to Pi is augmented.
- User-visible chat bubbles should keep the original text.
- Revert-safe turns should be identifiable in timeline metadata or a badge.

## Limitations

- The model may still choose shell commands.
- Broad commands may affect files not declared in advance.
- External side effects are not revertible.
- Some tasks may become slower because the model reads files before editing.
