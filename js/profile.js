import { supabase, requireAuth, getMyProfile, refreshPointsBadge, renderSidebarUser, fullName, initials, signOut, highlightActiveNav } from './supabase.js'

async function init() {
  highlightActiveNav()
  const user = await requireAuth()
  if (!user) return

  const profile = await getMyProfile(user.id)
  if (!profile) return

  refreshPointsBadge(profile.points)
  renderSidebarUser(profile)
  document.getElementById('profile-avatar').textContent = profile.avatar || initials(fullName(profile))
  document.getElementById('profile-name').textContent = fullName(profile)
  document.getElementById('profile-campus').textContent = profile.college || '—'
  document.getElementById('profile-points').textContent = profile.points.toLocaleString()
  document.getElementById('profile-email').textContent = profile.email || user.email

  await loadStats(user.id)
  await loadOwnedRewards(user.id, profile.avatar)
}

async function loadStats(userId) {
  const { count, error } = await supabase.from('posts').select('*', { count: 'exact', head: true }).eq('user_id', userId)
  document.getElementById('profile-post-count').textContent = error ? '—' : count
}

async function loadOwnedRewards(userId, currentAvatar) {
  const ownedListEl = document.getElementById('owned-rewards')

  const { data, error } = await supabase
    .from('purchases')
    .select('reward_id, rewards ( id, name, image, type )')
    .eq('user_id', userId)

  let ownedRewards = []
  if (error) {
    // Table might not exist yet, or the join failed — fall back to whatever
    // rewards.js stashed in localStorage so the page still shows something.
    console.warn('[profile.js] could not load purchases from Supabase:', error.message)
    const savedIds = JSON.parse(window.localStorage.getItem('cuny-connect-owned') || '[]')
    ownedRewards = savedIds.map((id) => ({ id, name: id, image: '🎁', type: 'other' }))
  } else {
    ownedRewards = data.map((row) => ({
      id: row.rewards?.id || row.reward_id,
      name: row.rewards?.name || row.reward_id,
      image: row.rewards?.image || '🎁',
      type: row.rewards?.type || 'other',
    }))
  }

  if (!ownedRewards.length) {
    ownedListEl.innerHTML = '<p class="page-subheading">No rewards redeemed yet — head to the Rewards page!</p>'
    return
  }

  ownedListEl.innerHTML = ownedRewards
    .map((r) => {
      const isAvatar = r.type === 'avatar'
      const isApplied = isAvatar && r.image === currentAvatar
      const applyBtn = isAvatar
        ? `<button class="btn ${isApplied ? 'btn-secondary' : 'btn-primary'}" style="padding: 3px 10px; font-size: var(--text-xs); margin-left: 6px;" data-avatar="${escapeHtml(r.image)}" ${isApplied ? 'disabled' : ''}>${isApplied ? 'Applied' : 'Apply'}</button>`
        : ''
      return `<span class="badge badge-tint" style="margin: 0 6px 6px 0;">${r.image} ${escapeHtml(r.name)}${applyBtn}</span>`
    })
    .join('')

  ownedListEl.querySelectorAll('button[data-avatar]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const { error: updateError } = await supabase.from('profiles').update({ avatar: btn.dataset.avatar }).eq('id', userId)
      if (updateError) {
        alert(`Couldn't apply avatar: ${updateError.message}`)
        return
      }
      document.getElementById('profile-avatar').textContent = btn.dataset.avatar
      document.getElementById('sidebar-avatar').textContent = btn.dataset.avatar
      await loadOwnedRewards(userId, btn.dataset.avatar)
    })
  })
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