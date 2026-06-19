const STORAGE_PREFIX = 'earmark:earned-badges:'

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

export function loadEarnedBadges(userId) {
  if (!userId || typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(storageKey(userId))
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveEarnedBadges(userId, earned) {
  if (!userId || typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(earned))
  } catch {
    /* quota / private mode */
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

/** Merge live criteria with permanently earned badges; persist new unlocks. */
export function finalizeBadgeState(badges, userId) {
  if (!badges.length) return badges

  const earned = loadEarnedBadges(userId)
  let dirty = false
  const now = new Date().toISOString()

  const merged = badges.map((badge) => {
    const stored = earned[badge.id]
    const newlyEarned = badge.unlocked && !stored
    if (newlyEarned) {
      earned[badge.id] = { earnedAt: now }
      dirty = true
    }
    const isEarned = Boolean(stored) || badge.unlocked
    return {
      ...badge,
      unlocked: isEarned,
      earnedAt: stored?.earnedAt ?? (badge.unlocked ? now : null),
      currentlyMet: badge.unlocked,
    }
  })

  if (dirty) saveEarnedBadges(userId, earned)
  return merged
}

export function finalizeGamification(game, userId) {
  if (!game) return game
  const badges = finalizeBadgeState(game.badges || [], userId)
  return {
    ...game,
    badges,
    unlockedBadgeCount: badges.filter((b) => b.unlocked).length,
  }
}
