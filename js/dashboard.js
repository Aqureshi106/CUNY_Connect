import { supabase, requireAuth, getMyProfile, addPoints, refreshPointsBadge, renderSidebarUser, signOut, highlightActiveNav } from './supabase.js'
import { categorizePost } from './gemini.js'

const POST_POINTS = 10

const feedEl = document.getElementById('feed')
const formEl = document.getElementById('post-form')
const inputEl = document.getElementById('post-text')
const submitBtn = document.getElementById('post-submit')

let currentUser = null

async function init() {
  highlightActiveNav()
  currentUser = await requireAuth()
  if (!currentUser) return // requireAuth already redirected

  const profile = await getMyProfile(currentUser.id)
  if (profile) {
    refreshPointsBadge(profile.points)
    renderSidebarUser(profile)
  }

  await loadFeed()
}

async function loadFeed() {
  feedEl.innerHTML = '<p class="page-subheading">Loading feed…</p>'
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    feedEl.innerHTML = `<p class="page-subheading">Couldn't load the feed: ${error.message}</p>`
    return
  }

  renderFeed(data)
}

function renderFeed(posts) {
  if (!posts.length) {
    feedEl.innerHTML = '<p class="page-subheading">No posts yet — be the first!</p>'
    return
  }

  feedEl.innerHTML = posts
    .map(
      (post) => `
      <div class="feed-item">
        <div class="feed-item-head">
          <div class="avatar avatar-sm">${escapeHtml(initials(post.author_name))}</div>
          <div class="feed-item-who">
            <span class="feed-item-name">${escapeHtml(post.author_name)}</span>
            <span class="feed-item-meta">
              ${timeAgo(post.created_at)}
              <span class="dot"></span>
              <span class="badge badge-tint">${escapeHtml(post.category)}</span>
            </span>
          </div>
        </div>
        <p class="feed-item-body">${escapeHtml(post.text)}</p>
        <div class="feed-item-actions">
          <span class="reaction"><span class="reaction-icon"><span class="icon icon-thumbs-up" style="width:12px;height:12px;"></span></span>Like</span>
        </div>
      </div>
    `
    )
    .join('')
}

formEl.addEventListener('submit', async (e) => {
  e.preventDefault()
  const text = inputEl.value.trim()
  if (!text || !currentUser) return

  submitBtn.disabled = true
  submitBtn.innerHTML = 'Posting…'

  try {
    const profile = await getMyProfile(currentUser.id)
    const { category, tags } = await categorizePost(text)

    const { error } = await supabase.from('posts').insert({
      author_id: currentUser.id,
      author_name: profile?.display_name || 'CUNY Student',
      text,
      category,
      tags,
    })

    if (error) throw error

    await addPoints(currentUser.id, POST_POINTS)
    inputEl.value = ''
    await loadFeed()
  } catch (err) {
    alert(`Couldn't post: ${err.message}`)
  } finally {
    submitBtn.disabled = false
    submitBtn.innerHTML = `<span class="icon icon-send" style="width:14px;height:14px;background:currentColor;"></span>Post (+${POST_POINTS} pts)`
  }
})

document.getElementById('signout-link')?.addEventListener('click', (e) => {
  e.preventDefault()
  signOut()
})

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

function timeAgo(isoDate) {
  const seconds = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

init()