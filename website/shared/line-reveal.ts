// His line arrives the way he says it: a few words for each breath, with a pause where the sentence turns.

const breath = 5
const sentenceEnd = /[.!?…]["'”’)\]]*$/
const clauseEnd = /[,;:—–]["'”’)\]]*$/

/** A word ends its clause at punctuation or at a line break. */
const endsClause = (word: string) => { const said = word.trimEnd(); return sentenceEnd.test(said) || clauseEnd.test(said) || word.includes('\n') }

/**
 * Splits a line into breath-sized groups. Joined in order, the groups are the line, with every space kept.
 * A group ends at punctuation. A clause longer than one breath splits into even parts, so no word trails alone.
 */
export function breathGroups(text: string): string[] {
  const words = text.match(/^\s*\S*\s*|\S+\s*/g)?.filter(Boolean) ?? []
  const clauses: string[][] = [[]]
  for (const word of words) {
    clauses.at(-1)!.push(word)
    if (endsClause(word)) clauses.push([])
  }
  return clauses.filter(clause => clause.length).flatMap((clause) => {
    const parts = Math.ceil(clause.length / breath)
    const size = Math.ceil(clause.length / parts)
    return Array.from({ length: parts }, (_, part) => clause.slice(part * size, (part + 1) * size).join(''))
  })
}

/** How long a group holds before the next one, in letters. A pause counts as letters he does not say. */
function hold(group: string) {
  const said = group.trimEnd()
  return said.length + (sentenceEnd.test(said) ? 7 : clauseEnd.test(said) ? 3 : 0)
}

/**
 * The second each group appears at, from the start of the line. The first group appears at once.
 * The groups share `duration`, the length of his voice, by their length and their pauses.
 */
export function revealTimes(groups: readonly string[], duration: number): number[] {
  const holds = groups.map(hold)
  const total = holds.reduce((sum, value) => sum + value, 0) || 1
  let before = 0
  return holds.map((value) => { const time = duration * before / total; before += value; return time })
}

/** How many groups he has said `elapsed` seconds into the line. */
export const groupsSaid = (times: readonly number[], elapsed: number) => times.filter(time => time <= elapsed).length
