---
author: est-ai
profile: generic
version: "0.1.0"
generatedBy: "0.1.0"
---

# Init protocol — adapt the skeleton to a project

Tool-agnostic. Runs **once**, right after the Quick Start has copied the skeleton into a repository. It inspects the project and fills in the `<!-- ADAPT: ... -->` markers and `<placeholders>` so that the agents and the reviews work from real facts. The question this protocol answers: **what does this project actually use?**

Principle: fill in only what you can **verify in the repository**. Anything you cannot verify, ask; never invent a command, a path or a convention.

## Inputs

- The repository: build and dependency files (`package.json`, `build.gradle(.kts)`, `pom.xml`, …), lint/format/test config, CI workflows, the source tree, and the existing `README.md`.
- The skeleton files that carry markers: `git grep -n "ADAPT"` (skip `.est_ai/reference/README.md` and `README.md` — they are for skeleton maintainers).

## Steps

1. **Detect the stack.** From the build files and the source tree: language and version, framework, test framework, linter and formatter, build tool, runtime. Note the evidence (file + line) for each.

2. **Declare the protocol** — [`../project.md`](../project.md):
   - **Language**: the `.est_ai/rules/lang/` file that matches. None matches → say so; leave it as "none".
   - **Profile**: the `.est_ai/rules/<profile>/` folder that matches the stack. None or more than one could match → **stop and ask**.
   - **Reference**: the one the table in [`../reference/README.md`](../reference/README.md) gives for that profile, or "none".

3. **Fill in `DEVELOPMENT.md`** section by section: what it is, tech stack, canonical commands, architecture and directory layout, code conventions, verification, testing strategy, git workflow.
   - **Commands** must exist: take them from the project's scripts (e.g. `package.json` → `scripts`) or its docs, and run the harmless ones (lint, typecheck, tests) to confirm they work. Report any that fail — do not fix the project.
   - **All-checks command**: if the project has a script that runs every check, use it. If not, propose one (e.g. `"check": "<typecheck> && <lint> && <test>"`) and **ask before editing** the project's build file.
   - **Architecture**: describe the layout that exists, not the template's example. If the project does not follow Clean Architecture, say so rather than forcing the template.

4. **Walk the other markers**: `AGENTS.md` (tracker link format, UI section, after-change artifacts), the agents and skills under `.claude/` (styling, design system, tracker, roles), `openspec/config.yaml`. For each marker: fill it in from what you found, remove the section if it does not apply (e.g. no UI → no UI design workflow), or ask.

5. **Check the `.gitignore`** — the project keeps its own; confirm it excludes `.claude/settings.local.json`, `.est_ai/reference/*` (with `!.est_ai/reference/README.md`) and `openspec/**/tasks.md` (see `AGENTS.md` → *Git workflow*). If any entry is missing, propose adding it and **ask before editing**. If `tasks.md` files are already tracked, list them and propose `git rm --cached` — do not run it without approval.

6. **Project rules** — ask the developer whether the project has rules of its own (generated code not to edit, exceptions to est-ai rules such as "Promise until refactor X") and write them in `.est_ai/rules/project/` as the README there describes. Do not guess them.

7. **Clean up**: remove each `<!-- ADAPT: ... -->` marker once its section is done, and the *Template* note at the top of `DEVELOPMENT.md` once no `<placeholder>` remains. Leave a marker in place only if the section is still pending, and list it in the report.

## Outcome

Do not commit. Report:
- what was detected, with its evidence;
- what was filled in, file by file;
- what was removed as not applicable;
- the `.gitignore` entries added or still missing;
- the questions asked and their answers;
- what is still pending (markers left, commands that failed, rules not provided).

Then the developer reviews the diff (see the **Human review** section of [`../review/checklist.md`](../review/checklist.md)) before committing it.
