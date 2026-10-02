![BRUNDLEFLY with its mascot's claws hanging below the banner](assets/brand/github-banner-overhang-gross.png)

# Brundlefly

A collection of self-contained [Agent Skills](https://agentskills.io/specification).

## Skills

| Skill | Use |
| --- | --- |
| [write-human](skills/write-human/SKILL.md) | Remove generated-sounding writing habits while preserving meaning and voice. |

## Use locally

Copy the complete skill directory into your agent's supported skills directory.
For Codex on Linux or macOS:

```sh
mkdir -p ~/.agents/skills
cp -R skills/write-human ~/.agents/skills/write-human
```

If you use skilld, load the skill without installing it:

```sh
skilld run ./skills/write-human --json
```

Example request:

```text
Use write-human to edit this draft. Preserve its facts, uncertainty, and voice.
```

## Brand assets

- [GitHub avatar](assets/brand/github-avatar.png)
- [README banner](assets/brand/github-banner-overhang-gross.png)
- [Repository social preview](assets/brand/github-social-preview.jpg)
- [Character sheet](assets/brand/character-sheet.png)
- [Brand rules](docs/arch/brand.md)

High-resolution originals live in assets/source.
Earlier concepts live in assets/archive.
Generation prompts live in assets/prompts.

## Contribute

Read [CONTRIBUTING.md](CONTRIBUTING.md).

## License

The skill instructions use the [MIT license](LICENSE.md).
