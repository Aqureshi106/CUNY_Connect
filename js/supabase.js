// ---------------------------------------------------------------------------
// Shared Supabase client + helpers used by every page. Loaded via CDN ESM
// import, so there's no npm install step — just serve the site over http(s)
// (e.g. VS Code's "Live Server" extension) since ES modules don't work when
// you open an html file directly with file://.
// ---------------------------------------------------------------------------
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js'

// If js/config.js still has the placeholder strings (Supabase isn't set up
// yet), createClient() throws immediately because the URL isn't valid. Since
// that happens at import time, it would otherwise take down every page's
// script with it — including bits that have nothing to do with Supabase,
// like populating the campus dropdown on the signup form. Catch it instead
// so the rest of the page still works; anything that actually needs a live
// Supabase connection will just fail (and log why) when it's used.
let client = null
try {
  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
} catch (err) {
  console.error(
    '[supabase.js] Could not create the Supabase client — js/config.js probably still has placeholder values. ' +
      'Fill in SUPABASE_URL and SUPABASE_ANON_KEY from your Supabase project settings.',
    err
  )
}
export const supabase = client

/**
 * Call at the top of every protected page (dashboard/ai/rewards/profile).
 * Redirects to login.html if nobody's signed in, otherwise returns the
 * current user.
 *
 * Uses getUser() instead of getSession(): getSession() only reads the token
 * cached in local storage and can return a "signed in" user even after that
 * user was deleted or the project got reset server-side (we hit exactly this
 * — a foreign key error on insert because the cached user no longer existed
 * in auth.users). getUser() asks Supabase to actually validate the token
 * against the server, so a stale/dead session gets redirected to login
 * instead of silently causing broken inserts elsewhere.
 */
export async function requireAuth() {
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    window.location.href = 'login.html'
    return null
  }
  return user
}

/** Fetches the signed-in user's profile row (first_name, last_name, college, major, points). */
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

/** Updates the CUNY Points badge present in the page header on every protected page. */
export function refreshPointsBadge(points) {
  const el = document.getElementById('points-badge')
  if (el) el.innerHTML = `<span class="icon icon-flame"></span>${points.toLocaleString()} CUNY Points`
}

/** Builds "First Last" from a profile row, falling back gracefully if a name part is missing. */
export function fullName(profile) {
  if (!profile) return 'CUNY Student'
  return [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'CUNY Student'
}

/** Fills in the sidebar's avatar + name from a profile row. Call once profile loads. */
export function renderSidebarUser(profile) {
  if (!profile) return
  const name = fullName(profile)
  const nameEl = document.getElementById('sidebar-name')
  const avatarEl = document.getElementById('sidebar-avatar')
  if (nameEl) nameEl.textContent = name
  // profile.avatar holds an emoji once the person has applied an avatar
  // reward (see rewards.js "Apply"); until then, fall back to initials.
  if (avatarEl) avatarEl.textContent = profile.avatar || initials(name)
}

export function initials(name) {
  return (name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

/** Signs out and sends the user back to the public landing page. */
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