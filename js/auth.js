import { supabase } from './supabase.js'

const CAMPUSES = [
  // Senior colleges
  'Baruch College',
  'Brooklyn College',
  'City College of New York',
  'College of Staten Island',
  'Hunter College',
  'John Jay College of Criminal Justice',
  'Lehman College',
  'Medgar Evers College',
  'New York City College of Technology',
  'Queens College',
  'York College',
  // Comprehensive / honors college
  'Macaulay Honors College',
  // Community colleges
  'Borough of Manhattan Community College',
  'Bronx Community College',
  'Guttman Community College',
  'Hostos Community College',
  'Kingsborough Community College',
  'LaGuardia Community College',
  'Queensborough Community College',
  // Graduate & professional schools
  'CUNY Graduate Center',
  'CUNY School of Law',
  'CUNY School of Medicine',
  'CUNY Graduate School of Journalism',
  'CUNY School of Labor and Urban Studies',
  'CUNY School of Professional Studies',
  'CUNY School of Public Health',
  // Fallback
  'Other CUNY',
]

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

// "Sign in" and "Get started" on the landing page link here with a #signin
// or #signup hash so this page can highlight and focus the right form
// instead of showing two identical-looking cards.
const wantsSignup = window.location.hash === '#signup'
document.getElementById(wantsSignup ? 'signup-card' : 'signin-card')?.classList.add('auth-card-active')
document.getElementById(wantsSignup ? 'signup-first-name' : 'signin-email')?.focus()

function setStatus(message, isError = false) {
  statusEl.textContent = message
  statusEl.style.color = isError ? '#c0392b' : 'var(--text-muted)'
}

signUpForm.addEventListener('submit', async (e) => {
  e.preventDefault()
  const email = document.getElementById('signup-email').value.trim()
  const password = document.getElementById('signup-password').value
  const firstName = document.getElementById('signup-first-name').value.trim() || 'CUNY'
  const lastName = document.getElementById('signup-last-name').value.trim() || 'Student'
  const major = document.getElementById('signup-major').value.trim() || null
  const college = campusSelect.value

  setStatus('Creating your account…')
  const { data, error } = await supabase.auth.signUp({ email, password })

  if (error) {
    setStatus(error.message, true)
    return
  }

  // There's no database trigger that auto-creates a profiles row on signup
  // (unlike a typical Supabase starter), so we insert it ourselves here,
  // right after the auth user is created. data.user exists even if email
  // confirmation is required and there's no session yet.
  if (data.user) {
    const { error: profileError } = await supabase.from('profiles').insert({
      id: data.user.id,
      first_name: firstName,
      last_name: lastName,
      email,
      college,
      major,
      points: 100, // small welcome bonus so the Rewards page isn't a dead end on day one
    })
    if (profileError) {
      console.error('[auth.js] account was created but the profile row failed to insert:', profileError.message)
    }
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