import { skills } from './content.ts'

export type ConversationLink = { label: string; href: string; download?: true }
export type ConversationReply = { text: string; links: ConversationLink[] }
export type ConversationResult =
  | { _tag: 'Ok'; reply: ConversationReply }
  | { _tag: 'Err'; message: string }

export type ConversationMessage =
  | { _tag: 'User'; text: string }
  | { _tag: 'Reply'; reply: ConversationReply }

// A synchronous, browser-local provider. No text leaves the page.
export const replyToConversation = (input: string): ConversationResult => {
  if (input.length > 1000) return { _tag: 'Err', message: 'Keep your text under 1,001 characters.' }
  const text = input.trim()
  if (!text) return { _tag: 'Err', message: 'Add some text first.' }
  const ok = (reply: ConversationReply): ConversationResult => ({ _tag: 'Ok', reply })

  if (/brand|design|kit|artwork|3d|mascot/i.test(text)) {
    return ok({ text: 'Brand kit', links: [{ label: 'Brand kit', href: '/brand-kit/' }] })
  }
  if (/install|download|copy|use a skill|setup|set up/i.test(text)) {
    return ok({
      text: 'Copy the complete skill directory into your agent’s supported skills directory.',
      links: skills.map(skill => ({ label: `Download ${skill.name}`, href: `/skills/${skill.name}.zip`, download: true })),
    })
  }
  const skill = skills.find(candidate => {
    if (candidate.name === 'write-human') return /write-human|writing|wording|rewrite/i.test(text)
    if (candidate.name === 'technical-guide') return /technical-guide|guide|tutorial|research/i.test(text)
    return /\bpr\b|pull request/i.test(text)
  })
  if (skill) {
    return ok({
      text: skill.description,
      links: [
        { label: `Read the full ${skill.name} skill`, href: `/skills/${skill.name}.md` },
        { label: `Download ${skill.name}`, href: `/skills/${skill.name}.zip`, download: true },
      ],
    })
  }
  if (/brundlefly|collection|skills|what|hello|\bhi\b/i.test(text)) {
    return ok({ text: 'A collection of self-contained Agent Skills.', links: skills.map(skill => ({ label: skill.name, href: `/skills/${skill.name}.md` })) })
  }
  return ok({
    text: 'Local replies cover the skills, installation, and brand kit. Ask about one of these.',
    links: [{ label: 'Brand kit', href: '/brand-kit/' }],
  })
}
