import { requireAuth, getMyProfile, addPoints, refreshPointsBadge, renderSidebarUser, signOut, highlightActiveNav } from './supabase.js'
import { runStudyAssistant } from './gemini.js'

const MODES = [
  { id: 'summarize', label: 'Summarize', points: 15 },
  { id: 'flashcards', label: 'Make Flashcards', points: 25 },
  { id: 'quiz', label: 'Generate Quiz', points: 25 },
  { id: 'eli5', label: "Explain Like I'm 5", points: 15 },
  { id: 'plan', label: 'Create Study Plan', points: 20 },
]

let currentUser = null
let selectedMode = 'summarize'

const notesEl = document.getElementById('notes-text')
const modeRowEl = document.getElementById('mode-row')
const runBtn = document.getElementById('run-btn')
const resultEl = document.getElementById('ai-result')

function renderModes() {
  modeRowEl.innerHTML = MODES.map(
    (m) => `<button type="button" class="mode-btn${m.id === selectedMode ? ' selected' : ''}" data-mode="${m.id}">${m.label}</button>`
  ).join('')

  modeRowEl.querySelectorAll('.mode-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedMode = btn.dataset.mode
      renderModes()
      updateRunLabel()
    })
  })
}

function updateRunLabel() {
  const mode = MODES.find((m) => m.id === selectedMode)
  runBtn.textContent = `Run CUNY AI (+${mode.points} pts)`
}

function renderResult(result) {
  if (result.type === 'flashcards' || result.type === 'quiz') {
    resultEl.innerHTML = `<div class="flashcard-list">${result.content
      .map((item) => `<div class="flashcard"><div class="q">${escapeHtml(item.q)}</div><div class="a">${escapeHtml(item.a)}</div></div>`)
      .join('')}</div>`
  } else {
    resultEl.innerHTML = `<div class="ai-result">${escapeHtml(result.content)}</div>`
  }
}

function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

runBtn.addEventListener('click', async () => {
  const notesText = notesEl.value.trim()
  if (!notesText || !currentUser) return

  runBtn.disabled = true
  const originalLabel = runBtn.textContent
  runBtn.textContent = 'Thinking…'
  resultEl.innerHTML = ''

  try {
    const result = await runStudyAssistant(notesText, selectedMode)
    renderResult(result)
    const mode = MODES.find((m) => m.id === selectedMode)
    await addPoints(currentUser.id, mode.points)
  } catch (err) {
    resultEl.innerHTML = `<p class="page-subheading">Something went wrong: ${err.message}</p>`
  } finally {
    runBtn.disabled = false
    runBtn.textContent = originalLabel
  }
})

document.getElementById('signout-link')?.addEventListener('click', (e) => {
  e.preventDefault()
  signOut()
})

async function init() {
  highlightActiveNav()
  currentUser = await requireAuth()
  if (!currentUser) return

  const profile = await getMyProfile(currentUser.id)
  if (profile) {
    refreshPointsBadge(profile.points)
    renderSidebarUser(profile)
  }

  renderModes()
  updateRunLabel()
}

init()