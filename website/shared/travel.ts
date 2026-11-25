import type { SetName } from '../layers/brand/shared/scene-set.ts'

// The address of each set. The cave is the homepage.
const paths: Record<SetName, string> = { lair: '/', office: '/office' }

export type SceneVisit = { _tag: 'Public', set: SetName } | { _tag: 'Attendee' } | { _tag: 'Projector' }

/** A visit selects either the public sets or an entrance to the experiment. */
export function visitForPath(path: string): SceneVisit | undefined {
  const page = path.replace(/\/+$/, '') || '/'
  if (page === '/join') return { _tag: 'Attendee' }
  if (page === '/projector') return { _tag: 'Projector' }
  const set = (Object.keys(paths) as SetName[]).find(name => paths[name] === page)
  if (set) return { _tag: 'Public', set }
}
export const pathForSet = (set: SetName) => paths[set]

// The approved labels from COPY.md, by the set that shows them.
const labels: Record<SetName, string> = { office: 'Follow him to the cave', lair: 'Follow him to the office' }
/**
 * The dialog's travel action. The app owns it: it changes the place and nothing else.
 * It carries no text for him, so the dialog has nothing to send and no chat turn is taken.
 */
export type TravelAction = { _tag: 'Travel', to: SetName, label: string }
/**
 * Public visitors can always travel. During the experiment, the critical scene opens the way to the cave.
 */
export const travelAction = (shown: SetName, caveOpen = true): TravelAction | undefined =>
  shown === 'office' ? caveOpen ? { _tag: 'Travel', to: 'lair', label: labels.office } : undefined : { _tag: 'Travel', to: 'office', label: labels.lair }
