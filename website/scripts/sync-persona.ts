import { readFile, writeFile } from 'node:fs/promises'

const document = await readFile(new URL('../../docs/brand/mascot-dialogue.md', import.meta.url), 'utf8')
const prompt = document.match(/```text\n([\s\S]*?)\n```/)?.[1]
if (!prompt) throw new Error('Missing Brundlefly system prompt')
await writeFile(new URL('../worker/persona.generated.ts', import.meta.url), `// Generated from docs/brand/mascot-dialogue.md. Server only.\nexport const persona = ${JSON.stringify(prompt)}\n`)
