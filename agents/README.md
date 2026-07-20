# The Universal 4-Agent Swarm

This directory documents the **swarm pipeline** for this repository. It is the human-readable reference; the runtime source of truth is `.zcode/agents/` (which carries the YAML frontmatter the ZCode CLI needs to dispatch each agent). The two directories are kept in sync: when you edit one, edit the other.

---

## Pipeline

```
Requirement → Planner → Reviewer → Builder → Auditor → Done
                ↑          |          |          |
                └──────────┴──────────┴──────────┘
                     Loop back on REJECT (max 2 iterations per gate)
```

| Agent | File | Role | Tools | Temp |
|---|---|---|---|---|
| **GENERAL** | `general.md` | Orchestrator — decomposes the requirement, dispatches each phase, judges output, decides pass-forward or loop-back. Writes no code. | Read, Grep, Glob, Bash, Write, TodoWrite, WebFetch | 0.15 |
| **PLANNER** | `planner.md` | Detects and locks the stack from root markers, holds the hidden five-lens deliberation, writes `spec.md` / `plan.md` / `tasks.md`. | Read, Grep, Glob, Bash, Write, WebFetch, WebSearch, TodoWrite | 0.4 |
| **REVIEWER** | `reviewer.md` | Read-only gate on the plan. Returns APPROVE or REJECT against five pillars: reuse-first, spec-driven, skill-driven, best-practice, honest blast-radius. | Read, Grep, Glob, Bash, WebFetch, WebSearch, TodoWrite | 0.1 |
| **BUILDER** | `builder.md` | The only agent with `Edit`. Implements through Serena when present (native Edit/Write fallback), runs the project's real verification after every edit. | Read, Grep, Glob, Bash, **Edit**, Write, WebFetch, WebSearch, TodoWrite | 0.2 |
| **AUDITOR** | `auditor.md` | Read-only final gate. Runs build/tests independently, checks security and test quality, returns APPROVE or REJECT. | Read, Grep, Glob, Bash, WebFetch, WebSearch, TodoWrite | 0.1 |

---

## Universality contract

The swarm serves any repository and any stack. Three properties make this work:

### 1. Stack is detected, never assumed
Every run, the Planner reads root markers (`go.mod`, `package.json`, `Cargo.toml`, `pyproject.toml`, `pom.xml`, `composer.json`, `Gemfile`, `mix.exs`, `*.csproj`, `pubspec.yaml`, `Package.swift`...) and locks the stack for the whole swarm. A monorepo with several markers is treated as several stacks, one per subtree. The project's own `AGENTS.md` / `CLAUDE.md` / `README` conventions override universal defaults wherever they conflict.

### 2. MCP servers are preferred, not required
Three MCP servers are used when present: **serena** (precise source reads and edits), **socraticode** (semantic search and impact tracing), **codebase-memory-mcp** (structural memory and graph queries). When one or all are absent, each agent falls back to native `Read` / `Grep` / `Glob` + shell `git grep` / `find` and states the fallback at the top of its output. No agent ever halts because an MCP is missing — it halts only when no tier can produce the evidence a sound phase needs. See `.zcode/MCP_SETUP.md` for registration and the confidence cost of each fallback.

### 3. The model is overridable
Agents default to GLM-5.2 but the swarm is model-agnostic. Override per-agent via the `model:` field in `.zcode/agents/*.md`, or globally via the ZCode runtime `--model` flag. Any model exposing the required tools works (Claude, GPT, GLM, local models).

---

## Slash commands

| Command | Effect |
|---|---|
| `/swarm <requirement>` | Run the full pipeline end-to-end |
| `/plan <requirement>` | Run the Planner only, produce `specs/<slug>/` |
| `/review <slug>` | Run the Reviewer only on an existing spec |
| `/build <slug>` | Run the Builder only on an approved spec |
| `/audit <slug>` | Run the Auditor only on a built spec |

---

## Spec output

All artifacts for one change-set live in one folder under `specs/<slug>/`:
- `spec.md` — the contract (what), opens with a locked-stack header and MCP-tiering note
- `plan.md` — the architecture plan (how), with the reuse map naming exact files and symbols
- `tasks.md` — the sequenced work, each task atomic with checkable acceptance criteria
- `implementation_report.md` — written by the Builder, the honest bridge between the frozen contract and the built reality
- ADRs and other artifacts as needed

The folder is the single durable record of the change from design through audit.

---

## Further reading

- `.zcode/agents/` — the runtime agent definitions (with YAML frontmatter)
- `.zcode/commands/` — the slash-command implementations
- `.zcode/SKILLS_MAP.md` — how agents pick skills by detected stack and by role
- `.zcode/MCP_SETUP.md` — how to register the preferred MCP servers and what each fallback costs
- `AGENTS.md` (repo root) — this repo's conventions, which override the swarm's universal defaults
