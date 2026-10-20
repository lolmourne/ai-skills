# ai-skills

Agent skills for [Claude Code](https://claude.com/claude-code) and other tools that read the `SKILL.md` format.
Each folder is one self-contained skill.

| Skill | What it does |
|---|---|
| [`bytecanvas`](bytecanvas/) | Turns an app's design code — or a brand brief — into ByteCanvas (`.bcanvas`) design guidelines, brand books, logos, UI kits and mock screens, plus flowcharts, use case diagrams, swimlanes and architecture diagrams of its logic, with editable vector layers, named component groups, attached connectors and PNG exports. [Install guide](bytecanvas/README.md#install). |

## Install

Clone once, then link the skills you want into `~/.claude/skills/`:

```bash
git clone https://github.com/lolmourne/ai-skills.git ~/ai-skills   # or your fork
mkdir -p ~/.claude/skills
ln -s ~/ai-skills/bytecanvas ~/.claude/skills/bytecanvas
```

A `git pull` in `~/ai-skills` updates every linked skill. Most skills can also be linked into a single project's
`.claude/skills/`; `bytecanvas` can't, because its scripts import from `~/.claude/skills/bytecanvas`. Each skill's
README lists its requirements and how to check the install (for example, [bytecanvas](bytecanvas/README.md#install)).

## Adding a skill

Create `<name>/SKILL.md` with `name` and `description` frontmatter, put its scripts and references next to it, and add a row to the table above.
