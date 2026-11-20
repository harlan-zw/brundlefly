import type { SetName } from '../layers/brand/shared/scene-set.ts'

// The address of each set. The cave is the homepage.
const paths: Record<SetName, string> = { lair: '/', office: '/office' }

/** The set an address shows. A trailing slash names the same page. An address that belongs to no set gives nothing. */
export const setForPath = (path: string): SetName | undefined => {
  const page = path.replace(/\/+$/, '') || '/'
  return (Object.keys(paths) as SetName[]).find(name => paths[name] === page)
}
export const pathForSet = (set: SetName) => paths[set]

// The approved labels from COPY.md, by the set that shows them.
const labels: Record<SetName, string> = { office: 'Follow him to the cave', lair: 'Follow him to the office' }
/**
 * The dialog's travel action. The app owns it: it changes the place and nothing else.
 * It carries no text for him, so the dialog has nothing to send and no chat turn is taken.
 */
export type TravelAction = { _tag: 'Travel', to: SetName, label: string }
export const travelAction = (shown: SetName): TravelAction => ({ _tag: 'Travel', to: shown === 'office' ? 'lair' : 'office', label: labels[shown] })
