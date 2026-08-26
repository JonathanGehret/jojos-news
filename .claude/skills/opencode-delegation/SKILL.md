---
description: Delegate self-contained subtasks to the opencode CLI coding agent. Covers when to delegate vs. do it yourself, how to compose fully self-contained prompts (statelessness contract), advisory vs. autonomous-edit modes (including the opencode.json permission config needed for autonomous edits), verification of delegated results, and timeout/parallelism guidance. Use whenever you consider running `opencode run`, when the user asks to delegate work to opencode or a second/another AI agent, or wants a second-opinion review of a diff or design.
---

# OpenCode Delegation Protocol

You have access to a second AI coding agent, `opencode`, as a CLI tool.
Use it to delegate **self-contained subtasks**. This file defines when and
how.

## When to delegate

Good candidates:

- Heavy codebase exploration where you only need a report back
- Independent, well-specified implementation chunks (a module, a test suite,
  a migration of specific files)
- Second-opinion review of a diff or design
- Drafts with clear specs (docs, fixtures, boilerplate)

Do NOT delegate:

- Anything requiring interaction with the user or follow-up questions
- Trivial one-liners (invocation overhead isn't worth it)
- Work whose context lives in this conversation and can't be fully written
  down in a prompt

## Basic invocation

```powershell
opencode run "<task>"
```

Pin a model explicitly when you care which one runs:

```powershell
opencode run --model <provider/model> "<task>"
```

Check what is available with `opencode models`, and `opencode auth list` to see whether
you are logged in — without credentials only the anonymous free models are offered, and
the better hosted models will not appear in the list.

- Run it from the repo root so project context files load automatically.
- Each call starts a **fresh session** and prints the result to stdout,
  then exits. Exit code is non-zero on failure.
- Optionally pin a model: `opencode run --model <provider/model> "<task>"`.

## Statelessness contract (critical)

The delegate has **no memory** of this conversation or previous calls. Every
prompt must be fully self-contained. Before delegating, compose a prompt that
includes:

1. The goal and why it matters (one or two sentences)
2. Relevant files with exact paths (and key symbols/line refs)
3. Constraints (language/version, style, what NOT to touch)
4. The expected deliverable and its format
5. An instruction to report concisely (e.g. "end with a short summary and
   list every file you changed")

Avoid `opencode run -c` (continue last session): it silently mixes context
across unrelated tasks. Only use it for deliberate multi-step delegation you
yourself initiated back-to-back on purpose.

For long prompts in PowerShell use a here-string to avoid quoting hell:

```powershell
$task = @'
Implement X in src/foo.ts ...
Constraints: ...
Report: ...
'@
opencode run $task
```

## Two delegation modes

### Advisory / read-only (default — use this unless told otherwise)

Ask for analysis or a *proposed* patch in the response text; you apply the
changes yourself. Safe everywhere, no configuration needed.

```powershell
opencode run "Review the diff in ... Propose a minimal patch as unified diff text. Do not modify files."
```

### Autonomous-edit

The delegate edits files directly. Headless runs **cannot answer permission
prompts**, so this requires pre-approved permissions in the project's
`opencode.json` (or global config):

```json
{
  "permission": {
    "edit": "allow",
    "bash": {
      "*": "allow",
      "git push": "deny"
    }
  }
}
```

Caveats:

- This applies to interactive opencode sessions in that repo too — scope it
  narrowly and remove it afterwards if appropriate.
- Prefer advisory mode except for mechanical, low-risk tasks.
- For risky work, point the delegate at a scratch worktree copy instead.

## Verification contract (critical)

Treat all delegated output as a **proposal**, never as done work:

- Re-read any files it claims to have changed; apply proposed patches yourself
  if it was an advisory run
- Run lint/typecheck/tests before accepting the result
- Never commit delegated work without your own review
- If the output looks truncated or the task was complex, re-run with a more
  decomposed prompt rather than accepting partial work

## Practicalities

- **Timeouts**: implementation tasks can take minutes. Use a generous timeout
  (5–10 min) on the shell call; ask for concise final reports so stdout stays
  manageable.
- **Parallelism**: independent read-only/advisory tasks may run concurrently;
  never run two autonomous-edit delegates over the same files at once.
- **Decompose**: prefer several small self-contained delegations over one
  giant one.
