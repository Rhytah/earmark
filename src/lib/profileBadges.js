import { normalizeGamification } from './settingsDb'

const STORAGE_PREFIX = 'earmark:earned-badges:'
export const XP_PER_LEVEL = 100

export const LEVEL_TITLES = [
  'Coin Curious',
  'Pocket Padawan',
  'Budget Beginner',
  'Money Minded',
  'Cash Captain',
  'Finance Fighter',
  'Savings Sage',
  'Wealth Wizard',
  'Budget Legend',
  'Money Master',
]

export const BADGE_DEFINITIONS = [
  {
    id: 'budget_boss',
    icon: '🛡️',
    label: 'Budget Boss',
    hint: '75%+ categories on track',
    evaluate({ metrics }) {
      const score = metrics.adherenceScore ?? 0
      return { unlocked: score >= 75, progress: Math.min(100, Math.round((score / 75) * 100)) }
    },
  },
  {
    id: 'super_saver',
    icon: '🌱',
    label: 'Super Saver',
    hint: 'Retain 15%+ of salary',
    evaluate({ metrics }) {
      const rate = metrics.savingsRate ?? 0
      return { unlocked: rate >= 15, progress: Math.min(100, Math.round((rate / 15) * 100)) }
    },
  },
  {
    id: 'data_hero',
    icon: '📊',
    label: 'Data Hero',
    hint: '3+ months of solid data',
    evaluate({ metrics, confidence }) {
      const monthProgress = Math.min(100, Math.round((metrics.monthCount / 3) * 100))
      const confidenceOk = confidence.level !== 'low'
      const unlocked = metrics.monthCount >= 3 && confidenceOk
      const progress = confidenceOk ? monthProgress : Math.min(monthProgress, 66)
      return { unlocked, progress }
    },
  },
  {
    id: 'category_captain',
    icon: '🏷️',
    label: 'Tag Master',
    hint: '90%+ mapped to budget',
    evaluate({ metrics }) {
      const share = metrics.mappedShare ?? 0
      return { unlocked: share >= 90, progress: Math.min(100, Math.round((share / 90) * 100)) }
    },
  },
  {
    id: 'weekend_warrior',
    icon: '🏖️',
    label: 'Weekend Warrior',
    hint: '45%+ of spend on weekends',
    evaluate({ metrics }) {
      const share = metrics.weekendShare ?? 0
      return { unlocked: share >= 45, progress: Math.min(100, Math.round((share / 45) * 100)) }
    },
  },
  {
    id: 'receipt_rookie',
    icon: '🧾',
    label: 'Receipt Ready',
    hint: 'Attach 3+ receipt photos',
    evaluate({ metrics }) {
      const count = metrics.receiptCount ?? 0
      return { unlocked: count >= 3, progress: Math.min(100, Math.round((count / 3) * 100)) }
    },
  },
]

function storageKey(userId) {
  return `${STORAGE_PREFIX}${userId || 'anonymous'}`
}

function loadLocalEarnedBadges(userId) {
  if (!userId || typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    const out = {}
    for (const [id, val] of Object.entries(parsed)) {
      const earned_at = val?.earnedAt || val?.earned_at
      if (earned_at) out[id] = { earned_at }
    }
    return out
  } catch {
    return {}
  }
}

function clearLocalEarnedBadges(userId) {
  if (!userId || typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(storageKey(userId))
  } catch {
    /* ignore */
  }
}

export function xpToLevelProgress(xp) {
  const safeXp = Math.max(0, Math.round(Number(xp) || 0))
  const level = Math.min(10, Math.max(1, Math.floor(safeXp / XP_PER_LEVEL) + 1))
  return {
    level,
    levelTitle: LEVEL_TITLES[level - 1],
    xp: safeXp,
    xpInLevel: safeXp % XP_PER_LEVEL,
    xpToNext: XP_PER_LEVEL,
  }
}

export function evaluateBadges(profile) {
  if (!profile?.hasData) return []

  const ctx = {
    metrics: profile.metrics,
    confidence: profile.confidence,
  }

  return BADGE_DEFINITIONS.map((def) => {
    const { unlocked, progress } = def.evaluate(ctx)
    return {
      id: def.id,
      icon: def.icon,
      label: def.label,
      hint: def.hint,
      unlocked,
      progress,
      earnedAt: null,
    }
  })
}

function mergeEarnedBadges(savedBadges, computedBadges, userId) {
  const earned = { ...savedBadges }
  let dirty = false
  const now = new Date().toISOString()

  const local = loadLocalEarnedBadges(userId)
  for (const [id, val] of Object.entries(local)) {
    if (!earned[id]) {
      earned[id] = val
      dirty = true
    }
  }
  if (Object.keys(local).length) clearLocalEarnedBadges(userId)

  const merged = computedBadges.map((badge) => {
    const stored = earned[badge.id]
    const newlyEarned = badge.unlocked && !stored
    if (newlyEarned) {
      earned[badge.id] = { earned_at: now }
      dirty = true
    }
    const isEarned = Boolean(stored || earned[badge.id])
    const earnedAt = earned[badge.id]?.earned_at ?? null
    return {
      ...badge,
      unlocked: isEarned,
      earnedAt,
      currentlyMet: badge.unlocked,
    }
  })

  return { badges: merged, earned, dirty }
}

/** Merge live stats with saved peak XP and earned badges; returns state to persist. */
export function mergeGamificationProgress(game, savedGamification, userId) {
  if (!game) return { game, nextGamification: null, dirty: false }

  const saved = normalizeGamification(savedGamification)
  const computedXp = Math.max(0, Math.round(Number(game.computedXp ?? game.xp) || 0))
  const peakXp = Math.max(saved.peak_xp, computedXp)
  const xpDirty = peakXp > saved.peak_xp

  let badges = game.badges || []
  let earned = saved.earned_badges
  let badgesDirty = false

  if (badges.length) {
    const badgeMerge = mergeEarnedBadges(saved.earned_badges, badges, userId)
    badges = badgeMerge.badges
    earned = badgeMerge.earned
    badgesDirty = badgeMerge.dirty
  }

  const progress = xpToLevelProgress(peakXp)
  const dirty = xpDirty || badgesDirty

  const nextGamification = dirty
    ? {
        version: 1,
        peak_xp: peakXp,
        earned_badges: earned,
        updated_at: new Date().toISOString(),
      }
    : null

  return {
    game: {
      ...game,
      ...progress,
      computedXp,
      xpDelta: peakXp - saved.peak_xp,
      badges,
      unlockedBadgeCount: badges.filter((b) => b.unlocked).length,
      synced: true,
    },
    nextGamification,
    dirty,
  }
}

/** @deprecated Use mergeGamificationProgress via useSpendingGamification */
export function finalizeGamification(game, userId, savedGamification) {
  return mergeGamificationProgress(game, savedGamification, userId).game
}
