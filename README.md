# ai-skills

Agent skills for [Claude Code](https://claude.com/claude-code) and other tools that read the `SKILL.md` format.
Each folder is one self-contained skill.

| Skill | What it does |
|---|---|
| [`bytecanvas`](bytecanvas/) | Turns an app's design code into ByteCanvas (`.bcanvas`) design guidelines, UI kits and mock screens, with editable layers and PNG exports. |

## Install

Clone once, then link the skills you want into `~/.claude/skills/`:

```bash
git clone https://github.com/<you>/ai-skills ~/ai-skills
ln -s ~/ai-skills/bytecanvas ~/.claude/skills/bytecanvas
```

A `git pull` in `~/ai-skills` updates every linked skill. To keep a skill for one project only, link it into that project's `.claude/skills/` instead.

## Adding a skill

Create `<name>/SKILL.md` with `name` and `description` frontmatter, put its scripts and references next to it, and add a row to the table above.
