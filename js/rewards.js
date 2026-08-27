import { supabase, requireAuth, getMyProfile, spendPoints, refreshPointsBadge, renderSidebarUser, signOut, highlightActiveNav } from './supabase.js'

let currentUser = null
let currentPoints = 0
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
    refreshPointsBadge(currentPoints)
    renderSidebarUser(profile)
    pointsBannerEl.innerHTML = `<span class="icon icon-flame"></span>${currentPoints.toLocaleString()} CUNY Points available`
  }

  await loadOwned()
  await loadRewards()
}

async function loadOwned() {
  const { data, error } = await supabase.from('redemptions').select('reward_id').eq('user_id', currentUser.id)
  if (error) {
    console.warn('[rewards.js] could not load redemptions (table may not exist yet), falling back to localStorage:', error.message)
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
    .map(
      (r) => `
      <div class="reward-card">
        <div class="reward-icon">${r.icon}</div>
        <div>${escapeHtml(r.name)}</div>
        <div class="reward-cost">${r.cost} pts</div>
        <button class="btn ${ownedIds.has(r.id) ? 'btn-secondary' : 'btn-primary'}" data-id="${r.id}" data-cost="${r.cost}" data-name="${escapeHtml(r.name)}" ${ownedIds.has(r.id) ? 'disabled' : ''}>
          ${ownedIds.has(r.id) ? 'Owned' : 'Redeem'}
        </button>
      </div>
    `
    )
    .join('')

  gridEl.querySelectorAll('button[data-id]').forEach((btn) => {
    btn.addEventListener('click', () => handleRedeem(btn.dataset.id, Number(btn.dataset.cost), btn.dataset.name))
  })
}

async function handleRedeem(rewardId, cost, name) {
  const success = await spendPoints(currentUser.id, cost)
  if (!success) {
    showToast('Not enough points yet — keep earning!')
    return
  }

  currentPoints -= cost
  pointsBannerEl.innerHTML = `<span class="icon icon-flame"></span>${currentPoints.toLocaleString()} CUNY Points available`

  const { error } = await supabase.from('redemptions').insert({ user_id: currentUser.id, reward_id: rewardId })
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