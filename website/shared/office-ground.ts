import type { OfficePlan } from '../layers/brand/shared/office-layout.ts'

/** A flat top that a specimen can land on: a rectangle of the plan at a height. */
export type Platform = { minX: number, maxX: number, minZ: number, maxZ: number, top: number }
const landable = new Set(['Desk', 'Monitor', 'JarShelf', 'FilingCabinet', 'StorageBox', 'Locker', 'VendingMachine'])
/** The furniture a specimen can land on, from the floor plan. */
export const platformsOf = (plan: OfficePlan): Platform[] => plan.props.filter(prop => landable.has(prop._tag)).map(({ position: [x, y, z], size: [w, h, d] }) =>
  ({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, top: y + h / 2 }))
/** The height of the highest surface under a point of the room. */
export const groundAt = (platforms: readonly Platform[], floor: number, x: number, z: number) =>
  platforms.reduce((top, p) => x >= p.minX && x <= p.maxX && z >= p.minZ && z <= p.maxZ && p.top > top ? p.top : top, floor)
