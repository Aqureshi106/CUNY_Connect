import { supabase, requireAuth, getMyProfile, addPoints, refreshPointsBadge, renderSidebarUser, fullName, initials, signOut, highlightActiveNav } from './supabase.js'

const POST_POINTS = 10

const feedEl = document.getElementById('feed')
const formEl = document.getElementById('post-form')
const inputEl = document.getElementById('post-text')
const submitBtn = document.getElementById('post-submit')
const photoInput = document.getElementById('photo-input')
const fileInput = document.getElementById('file-input')
const previewsEl = document.getElementById('attach-previews')

let currentUser = null
let selectedPhotos = [] // File objects, image/* only
let selectedFiles = [] // File objects, any type

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
  const { data: posts, error } = await supabase
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    feedEl.innerHTML = `<p class="page-subheading">Couldn't load the feed: ${error.message}</p>`
    return
  }

  if (!posts.length) {
    feedEl.innerHTML = '<p class="page-subheading">No posts yet — be the first!</p>'
    return
  }

  // posts.user_id points at auth.users, and there's no foreign key from
  // posts straight to profiles, so Supabase can't auto-embed the author's
  // name in the posts query above. Fetch the authors in one extra query
  // instead of one query per post.
  const authorIds = [...new Set(posts.map((p) => p.user_id))]
  const { data: authors } = await supabase.from('profiles').select('id, first_name, last_name, college').in('id', authorIds)
  const authorById = new Map((authors || []).map((a) => [a.id, a]))

  renderFeed(posts, authorById)
}

function renderFeed(posts, authorById) {
  feedEl.innerHTML = posts
    .map((post) => {
      const author = authorById.get(post.user_id)
      const name = fullName(author)
      return `
      <div class="feed-item">
        <div class="feed-item-head">
          <div class="avatar avatar-sm">${escapeHtml(initials(name))}</div>
          <div class="feed-item-who">
            <span class="feed-item-name">${escapeHtml(name)}</span>
            <span class="feed-item-meta">
              ${timeAgo(post.created_at)}
              ${author?.college ? `<span class="dot"></span><span class="badge badge-tint">${escapeHtml(author.college)}</span>` : ''}
            </span>
          </div>
        </div>
        <p class="feed-item-body">${escapeHtml(post.content)}</p>
        ${renderPhotos(post.image_urls)}
        ${renderFiles(post.files)}
        <div class="feed-item-actions">
          <span class="reaction"><span class="reaction-icon"><span class="icon icon-thumbs-up" style="width:12px;height:12px;"></span></span>Like</span>
        </div>
      </div>
    `
    })
    .join('')
}

// ---------------------------------------------------------------------------
// Add Photo / Add Files buttons — just trigger the hidden file inputs.
// ---------------------------------------------------------------------------
document.getElementById('add-photo-btn').addEventListener('click', () => photoInput.click())
document.getElementById('add-file-btn').addEventListener('click', () => fileInput.click())

photoInput.addEventListener('change', () => {
  selectedPhotos = [...selectedPhotos, ...photoInput.files]
  photoInput.value = '' // so picking the same file twice still fires 'change'
  renderPreviews()
})

fileInput.addEventListener('change', () => {
  selectedFiles = [...selectedFiles, ...fileInput.files]
  fileInput.value = ''
  renderPreviews()
})

function renderPreviews() {
  const photoThumbs = selectedPhotos
    .map(
      (file, i) => `
      <div class="attach-photo-thumb">
        <img src="${URL.createObjectURL(file)}" alt="${escapeHtml(file.name)}" />
        <button type="button" class="attach-remove" data-kind="photo" data-index="${i}"><span class="icon icon-x"></span></button>
      </div>`
    )
    .join('')

  const fileChips = selectedFiles
    .map(
      (file, i) => `
      <span class="attach-file-chip">
        <span class="icon icon-file"></span>
        <span class="name">${escapeHtml(file.name)}</span>
        <button type="button" class="attach-remove" data-kind="file" data-index="${i}"><span class="icon icon-x"></span></button>
      </span>`
    )
    .join('')

  previewsEl.innerHTML = photoThumbs + fileChips

  previewsEl.querySelectorAll('.attach-remove').forEach((btn) => {
    btn.addEventListener('click', () => {
      const i = Number(btn.dataset.index)
      if (btn.dataset.kind === 'photo') selectedPhotos.splice(i, 1)
      else selectedFiles.splice(i, 1)
      renderPreviews()
    })
  })
}

/**
 * Uploads a batch of Files into a Supabase Storage bucket under the user's
 * own folder (userId/timestamp-filename, so people can't collide with each
 * other's uploads) and returns their public URLs.
 */
async function uploadAll(files, bucket) {
  const urls = []
  for (const file of files) {
    const path = `${currentUser.id}/${Date.now()}-${file.name}`
    const { error } = await supabase.storage.from(bucket).upload(path, file)
    if (error) throw new Error(`Failed to upload ${file.name}: ${error.message}`)
    const { data } = supabase.storage.from(bucket).getPublicUrl(path)
    urls.push({ name: file.name, url: data.publicUrl })
  }
  return urls
}

formEl.addEventListener('submit', async (e) => {
  e.preventDefault()
  const text = inputEl.value.trim()
  if (!text || !currentUser) return

  submitBtn.disabled = true
  submitBtn.innerHTML = 'Posting…'

  try {
    // Photos and files upload to Supabase Storage first (see README for the
    // one-time bucket setup this needs); the post row just stores the
    // resulting URLs.
    const uploadedPhotos = await uploadAll(selectedPhotos, 'post-photos')
    const uploadedFiles = await uploadAll(selectedFiles, 'post-files')

    const { error } = await supabase.from('posts').insert({
      user_id: currentUser.id,
      content: text,
      image_urls: uploadedPhotos.map((p) => p.url),
      files: uploadedFiles,
    })

    if (error) throw error

    await addPoints(currentUser.id, POST_POINTS)
    inputEl.value = ''
    selectedPhotos = []
    selectedFiles = []
    renderPreviews()
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

function renderPhotos(urls) {
  if (!urls || !urls.length) return ''
  return `<div class="feed-item-photos">${urls
    .map((url) => `<img src="${url}" alt="" onclick="window.open('${url}', '_blank')" />`)
    .join('')}</div>`
}

function renderFiles(files) {
  if (!files || !files.length) return ''
  return `<div class="feed-item-files">${files
    .map(
      (f) => `
      <a class="attach-file-chip" href="${f.url}" target="_blank" rel="noopener">
        <span class="icon icon-file"></span>
        <span class="name">${escapeHtml(f.name)}</span>
      </a>`
    )
    .join('')}</div>`
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