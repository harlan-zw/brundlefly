import type { SetName } from '../layers/brand/shared/scene-set.ts'

// The address of each set. The cave is the homepage.
const paths: Record<SetName, string> = { lair: '/', office: '/office' }

// The address a phone opens from the join code. It shows the office, with the visitor at the computer.
const joinPath = '/join'
const pageOf = (path: string) => path.replace(/\/+$/, '') || '/'
/** The visitor came by the join code. */
export const joinedByPath = (path: string) => pageOf(path) === joinPath

/** The set an address shows. A trailing slash names the same page. An address that belongs to no set gives nothing. */
export const setForPath = (path: string): SetName | undefined => {
  const page = pageOf(path)
  return page === joinPath ? 'office' : (Object.keys(paths) as SetName[]).find(name => paths[name] === page)
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
 * `caveOpen` says the visitor has been through the office experiment to its end. Until then the office offers no way to the cave:
 * the critical scene of the experiment is the only way there.
 */
export const travelAction = (shown: SetName, caveOpen: boolean): TravelAction | undefined =>
  shown === 'office' ? caveOpen ? { _tag: 'Travel', to: 'lair', label: labels.office } : undefined : { _tag: 'Travel', to: 'office', label: labels.lair }
