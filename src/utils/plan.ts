import type { MedicationLog, MedicationPlan, PlanInput } from '../types'
import { todayStr } from './date'

export interface PlanEditImpact {
  /** Times still scheduled today; today's logs at these times keep their status. */
  kept: string[]
  /** Old times no longer scheduled today (changed or removed, or date range moved). */
  removed: string[]
  /** New times appearing on today's schedule (shown as pending doses). */
  added: string[]
  /** Today's logs at removed times: hidden from the today list but kept in history. */
  loggedRemoved: MedicationLog[]
}

/** Times of a plan that are effective on the given date (empty when out of range). */
function effectiveTimes(
  plan: Pick<MedicationPlan, 'times' | 'startDate' | 'endDate'>,
  date: string,
): string[] {
  if (plan.startDate && date < plan.startDate) return []
  if (plan.endDate && date > plan.endDate) return []
  return plan.times
}

/**
 * Diff the current plan against an edited version for one date (today by
 * default), so the UI can explain what happens to existing dose logs.
 * Logs are never deleted by an edit: logs at removed times stay in history
 * and in compliance stats, they only stop appearing in the today list.
 */
export function planEditImpact(
  current: MedicationPlan,
  next: PlanInput,
  logs: MedicationLog[],
  date: string = todayStr(),
): PlanEditImpact {
  const oldTimes = new Set(effectiveTimes(current, date))
  const newTimes = new Set(effectiveTimes(next, date))
  const kept = [...oldTimes].filter((t) => newTimes.has(t))
  const removed = [...oldTimes].filter((t) => !newTimes.has(t))
  const added = [...newTimes].filter((t) => !oldTimes.has(t))
  const removedSet = new Set(removed)
  const loggedRemoved = logs.filter(
    (l) => l.planId === current.id && l.date === date && removedSet.has(l.time),
  )
  return { kept, removed, added, loggedRemoved }
}
