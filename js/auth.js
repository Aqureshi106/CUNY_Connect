import { supabase } from './supabase.js'

const CAMPUSES = ['CSI', 'Queens College', 'Brooklyn College', 'Hunter College', 'City College', 'Baruch College', 'Other CUNY']

const signUpForm = document.getElementById('signup-form')
const signInForm = document.getElementById('signin-form')
const statusEl = document.getElementById('auth-status')
const campusSelect = document.getElementById('signup-campus')

// Populate the campus dropdown.
CAMPUSES.forEach((campus) => {
  const opt = document.createElement('option')
  opt.value = campus
  opt.textContent = campus
  campusSelect.appendChild(opt)
})

// If already signed in, skip straight to the dashboard.
supabase.auth.getSession().then(({ data: { session } }) => {
  if (session) window.location.href = 'dashboard.html'
})

function setStatus(message, isError = false) {
  statusEl.textContent = message
  statusEl.style.color = isError ? '#c0392b' : 'var(--text-muted)'
}

signUpForm.addEventListener('submit', async (e) => {
  e.preventDefault()
  const email = document.getElementById('signup-email').value.trim()
  const password = document.getElementById('signup-password').value
  const displayName = document.getElementById('signup-name').value.trim() || 'CUNY Student'
  const campus = campusSelect.value

  setStatus('Creating your account…')
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName, campus } },
  })

  if (error) {
    setStatus(error.message, true)
    return
  }

  // If email confirmation is off (recommended for demo day — see schema.sql),
  // signUp already returns a live session and we can go straight in.
  if (data.session) {
    window.location.href = 'dashboard.html'
  } else {
    setStatus('Account created — check your email to confirm, then sign in below.')
  }
})

signInForm.addEventListener('submit', async (e) => {
  e.preventDefault()
  const email = document.getElementById('signin-email').value.trim()
  const password = document.getElementById('signin-password').value

  setStatus('Signing in…')
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    setStatus(error.message, true)
    return
  }
  window.location.href = 'dashboard.html'
})