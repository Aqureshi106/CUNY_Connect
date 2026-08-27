// ---------------------------------------------------------------------------
// Shared Supabase client + helpers used by every page. Loaded via CDN ESM
// import, so there's no npm install step — just serve the site over http(s)
// (e.g. VS Code's "Live Server" extension) since ES modules don't work when
// you open an html file directly with file://.
// ---------------------------------------------------------------------------
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

/**
 * Call at the top of every protected page (dashboard/ai/rewards/profile).
 * Redirects to index.html if nobody's signed in, otherwise returns the
 * current session's user.
 */
export async function requireAuth() {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    window.location.href = 'index.html'
    return null
  }
  return session.user
}

/** Fetches the signed-in user's profile row (display_name, campus, points). */
export async function getMyProfile(userId) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
  if (error) {
    console.error('[supabase.js] failed to load profile:', error.message)
    return null
  }
  return data
}

/**
 * Adds `amount` points to a user's balance and returns the new total.
 * Not atomic (read-then-write) — fine for a one-day demo with a handful of
 * concurrent users; if this becomes a real product, replace with a Postgres
 * RPC function that does the increment server-side.
 */
export async function addPoints(userId, amount) {
  const profile = await getMyProfile(userId)
  if (!profile) return null
  const newTotal = profile.points + amount
  const { error } = await supabase.from('profiles').update({ points: newTotal }).eq('id', userId)
  if (error) {
    console.error('[supabase.js] failed to add points:', error.message)
    return profile.points
  }
  refreshPointsBadge(newTotal)
  return newTotal
}

/** Attempts to spend points; returns true if the user had enough, false otherwise. */
export async function spendPoints(userId, amount) {
  const profile = await getMyProfile(userId)
  if (!profile || profile.points < amount) return false
  const newTotal = profile.points - amount
  const { error } = await supabase.from('profiles').update({ points: newTotal }).eq('id', userId)
  if (error) {
    console.error('[supabase.js] failed to spend points:', error.message)
    return false
  }
  refreshPointsBadge(newTotal)
  return true
}

/** Updates the "🔥 N CUNY Points" badge in the top bar, present on every page. */
export function refreshPointsBadge(points) {
  const el = document.getElementById('points-badge')
  if (el) el.textContent = `🔥 ${points.toLocaleString()} CUNY Points`
}

export async function signOut() {
  await supabase.auth.signOut()
  window.location.href = 'index.html'
}

/** Highlights the current page's link in the sidebar nav. Call after DOM load. */
export function highlightActiveNav() {
  const current = window.location.pathname.split('/').pop() || 'dashboard.html'
  document.querySelectorAll('.sidebar-link').forEach((link) => {
    if (link.getAttribute('href') === current) link.classList.add('active')
  })
}