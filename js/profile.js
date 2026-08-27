import { supabase, requireAuth, getMyProfile, refreshPointsBadge, renderSidebarUser, signOut, highlightActiveNav } from './supabase.js'

async function init() {
  highlightActiveNav()
  const user = await requireAuth()
  if (!user) return

  const profile = await getMyProfile(user.id)
  if (!profile) return

  refreshPointsBadge(profile.points)
  renderSidebarUser(profile)
  document.getElementById('profile-avatar').textContent = initials(profile.display_name)
  document.getElementById('profile-name').textContent = profile.display_name
  document.getElementById('profile-campus').textContent = profile.campus
  document.getElementById('profile-points').textContent = profile.points.toLocaleString()
  document.getElementById('profile-email').textContent = user.email

  await loadStats(user.id)
  await loadOwnedRewards(user.id)
}

async function loadStats(userId) {
  const { count, error } = await supabase.from('posts').select('*', { count: 'exact', head: true }).eq('author_id', userId)
  document.getElementById('profile-post-count').textContent = error ? '—' : count
}

async function loadOwnedRewards(userId) {
  const ownedListEl = document.getElementById('owned-rewards')

  const { data, error } = await supabase
    .from('redemptions')
    .select('reward_id, rewards ( name, icon )')
    .eq('user_id', userId)

  let ownedRewards = []
  if (error) {
    // Table might not exist yet, or the join failed — fall back to whatever
    // rewards.js stashed in localStorage so the page still shows something.
    console.warn('[profile.js] could not load redemptions from Supabase:', error.message)
    const savedIds = JSON.parse(window.localStorage.getItem('cuny-connect-owned') || '[]')
    ownedRewards = savedIds.map((id) => ({ name: id, icon: '🎁' }))
  } else {
    ownedRewards = data.map((row) => ({ name: row.rewards?.name || row.reward_id, icon: row.rewards?.icon || '🎁' }))
  }

  ownedListEl.innerHTML = ownedRewards.length
    ? ownedRewards.map((r) => `<span class="badge badge-tint" style="margin: 0 6px 6px 0;">${r.icon} ${escapeHtml(r.name)}</span>`).join('')
    : '<p class="page-subheading">No rewards redeemed yet — head to the Rewards page!</p>'
}

function initials(name) {
  return (name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

document.getElementById('signout-link')?.addEventListener('click', (e) => {
  e.preventDefault()
  signOut()
})

init()