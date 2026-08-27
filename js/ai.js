import { requireAuth, getMyProfile, addPoints, refreshPointsBadge, renderSidebarUser, signOut, highlightActiveNav } from './supabase.js'

const MAX_NOTES_LENGTH = 1800

const MODES = [
  { id: 'summarize', label: 'Summarize', points: 15, instruction: 'Summarize these lecture notes in clear, student-friendly language. Use short paragraphs and bullet points where they help.' },
  { id: 'flashcards', label: 'Make Flashcards', points: 25, instruction: 'Turn these notes into study flashcards. Format each card as "Q: ..." on one line and "A: ..." on the next, with a blank line between cards.' },
  { id: 'quiz', label: 'Generate Quiz', points: 25, instruction: 'Write a short practice quiz from these notes. Number each question, give 4 multiple-choice options (A–D), then list the answers at the end with a one-sentence explanation each.' },
  { id: 'eli5', label: "Explain Like I'm 5", points: 15, instruction: "Explain these notes like I'm 5 — simple words, a concrete example, and no jargon unless you immediately define it." },
  { id: 'plan', label: 'Create Study Plan', points: 20, instruction: 'Build a realistic study plan from these notes. Break the material into sessions with goals, estimated time, and what to review first.' },
]

let currentUser = null
let selectedMode = 'summarize'

const notesEl = document.getElementById('notes-text')
const modeRowEl = document.getElementById('mode-row')
const runBtn = document.getElementById('run-btn')
const resultEl = document.getElementById('ai-result')

function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

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
  runBtn.innerHTML = `<span class="icon icon-sparkles" style="width:14px;height:14px;background:currentColor;"></span> Run CUNY AI (+${mode.points} pts)`
}

async function requestAssistantReply(message) {
  let response
  try {
    response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    })
  } catch {
    throw new Error('Could not reach the CUNY Connect server. Start it with "npm start", then open the site at http://localhost:3000/ai.html.')
  }

  const data = await response.json().catch(() => null)
  if (!response.ok || typeof data?.reply !== 'string') {
    throw new Error(data?.error || 'Something went wrong on the server. Please try again.')
  }
  return data.reply
}

runBtn.addEventListener('click', async () => {
  const notesText = notesEl.value.trim()
  if (!notesText || !currentUser) return

  if (notesText.length > MAX_NOTES_LENGTH) {
    resultEl.innerHTML = `<p class="page-subheading">Notes are too long (${MAX_NOTES_LENGTH} characters max). Trim them a bit and try again.</p>`
    return
  }

  const mode = MODES.find((m) => m.id === selectedMode)
  runBtn.disabled = true
  runBtn.textContent = 'Thinking…'
  resultEl.innerHTML = ''

  try {
    const reply = await requestAssistantReply(`${mode.instruction}\n\n${notesText}`)
    resultEl.innerHTML = `<div class="ai-result">${escapeHtml(reply)}</div>`
    await addPoints(currentUser.id, mode.points)
  } catch (err) {
    resultEl.innerHTML = `<p class="page-subheading">${escapeHtml(err.message)}</p>`
  } finally {
    runBtn.disabled = false
    updateRunLabel()
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
