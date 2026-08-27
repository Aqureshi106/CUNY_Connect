import { supabase, requireAuth, getMyProfile, spendPoints, refreshPointsBadge, renderSidebarUser, signOut, highlightActiveNav } from './supabase.js'

let currentUser = null
let currentPoints = 0
let currentAvatar = null
let ownedIds = new Set()

const gridEl = document.getElementById('rewards-grid')
const pointsBannerEl = document.getElementById('points-available')

async function init() {
  highlightActiveNav()
  currentUser = await requireAuth()
  if (!currentUser) return

  const profile = await getMyProfile(currentUser.id)
  if (profile) {
    currentPoints = profile.points
    currentAvatar = profile.avatar
    refreshPointsBadge(currentPoints)
    renderSidebarUser(profile)
    pointsBannerEl.innerHTML = `<span class="icon icon-flame"></span>${currentPoints.toLocaleString()} CUNY Points available`
  }

  await loadOwned()
  await loadRewards()
}

async function loadOwned() {
  const { data, error } = await supabase.from('purchases').select('reward_id').eq('user_id', currentUser.id)
  if (error) {
    console.warn('[rewards.js] could not load purchases (table may not exist yet), falling back to localStorage:', error.message)
    const saved = JSON.parse(window.localStorage.getItem('cuny-connect-owned') || '[]')
    ownedIds = new Set(saved)
    return
  }
  ownedIds = new Set(data.map((row) => row.reward_id))
}

async function loadRewards() {
  const { data, error } = await supabase.from('rewards').select('*').order('cost', { ascending: true })
  if (error) {
    gridEl.innerHTML = `<p class="page-subheading">Couldn't load rewards: ${error.message}</p>`
    return
  }
  renderRewards(data)
}

function renderRewards(rewards) {
  gridEl.innerHTML = rewards
    .map((r) => {
      const owned = ownedIds.has(r.id)
      const isAvatar = r.type === 'avatar'
      const isApplied = isAvatar && r.image === currentAvatar

      let button
      if (!owned) {
        button = `<button class="btn btn-primary" data-action="redeem" data-id="${r.id}" data-cost="${r.cost}" data-name="${escapeHtml(r.name)}">Redeem</button>`
      } else if (isAvatar) {
        button = `<button class="btn ${isApplied ? 'btn-secondary' : 'btn-primary'}" data-action="apply" data-avatar="${escapeHtml(r.image)}" ${isApplied ? 'disabled' : ''}>${isApplied ? 'Applied' : 'Apply'}</button>`
      } else {
        button = `<button class="btn btn-secondary" disabled>Owned</button>`
      }

      return `
      <div class="reward-card">
        <div class="reward-icon">${r.image || '🎁'}</div>
        <div>${escapeHtml(r.name)}</div>
        ${r.description ? `<div class="page-subheading" style="margin: 0 0 var(--space-2);">${escapeHtml(r.description)}</div>` : ''}
        <div class="reward-cost">${r.cost} pts</div>
        ${button}
      </div>
    `
    })
    .join('')

  gridEl.querySelectorAll('button[data-action="redeem"]').forEach((btn) => {
    btn.addEventListener('click', () => handleRedeem(btn.dataset.id, Number(btn.dataset.cost), btn.dataset.name))
  })
  gridEl.querySelectorAll('button[data-action="apply"]').forEach((btn) => {
    btn.addEventListener('click', () => handleApply(btn.dataset.avatar))
  })
}

async function handleApply(avatarEmoji) {
  const { error } = await supabase.from('profiles').update({ avatar: avatarEmoji }).eq('id', currentUser.id)
  if (error) {
    showToast(`Couldn't apply avatar: ${error.message}`)
    return
  }
  currentAvatar = avatarEmoji
  document.getElementById('sidebar-avatar').textContent = avatarEmoji
  showToast('Avatar applied!')
  await loadRewards()
}

async function handleRedeem(rewardId, cost, name) {
  const success = await spendPoints(currentUser.id, cost)
  if (!success) {
    showToast('Not enough points yet — keep earning!')
    return
  }

  currentPoints -= cost
  pointsBannerEl.innerHTML = `<span class="icon icon-flame"></span>${currentPoints.toLocaleString()} CUNY Points available`

  const { error } = await supabase.from('purchases').insert({ user_id: currentUser.id, reward_id: rewardId })
  if (error) {
    console.warn('[rewards.js] could not save redemption to Supabase, using localStorage fallback:', error.message)
    const saved = JSON.parse(window.localStorage.getItem('cuny-connect-owned') || '[]')
    saved.push(rewardId)
    window.localStorage.setItem('cuny-connect-owned', JSON.stringify(saved))
  }

  ownedIds.add(rewardId)
  showToast(`Unlocked ${name}!`)
  await loadRewards()
}

function showToast(message) {
  const el = document.createElement('div')
  el.className = 'toast'
  el.textContent = message
  document.body.appendChild(el)
  setTimeout(() => el.remove(), 2200)
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