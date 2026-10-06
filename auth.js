// Real NUNA accounts with Supabase Auth: email and password, Google when it is enabled in Supabase, and password recovery.
// Signed in, chats and projects are kept in the person's account (Row Level Security limits each row to its owner).
// Signed out, they stay in this browser as before.
var authUser = null, authClient = null, authUsage = null, authDailyLimit = 30
let authSettings = { google: false, autoconfirm: false }, authMode = 'login', authNotice = '', authBusy = false
let accountReady = false, accountLoading = false, syncedChats = new Map(), syncedState = '', syncTimer = null, syncChain = Promise.resolve(), syncProblem = false
try { localStorage.removeItem('nuna-demo-session') } catch {}
const authDialog = document.createElement('dialog')
authDialog.id = 'auth-dialog'
document.body.append(authDialog)

const authText = (es, en) => lang === 'es' ? es : en
function cloudMode() { return Boolean(authUser && accountReady) }
// Today's messages reset at 00:00 UTC; show that moment in the person's own time.
function usageResetTime() {
  const d = new Date()
  d.setUTCHours(24, 0, 0, 0)
  return d.toLocaleTimeString(lang === 'es' ? 'es' : 'en', { hour: 'numeric', minute: '2-digit' })
}
function usageLine() {
  if (!authUsage) return ''
  const left = Math.max(authUsage.limit - authUsage.used, 0)
  return authText(`Has usado ${authUsage.used} de ${authUsage.limit} mensajes de hoy (te quedan ${left}). Se renuevan a las ${usageResetTime()}.`,
    `You have used ${authUsage.used} of today's ${authUsage.limit} messages (${left} left). They reset at ${usageResetTime()}.`)
}
async function refreshUsage() {
  if (!authClient || !authUser) return
  const { data, error } = await authClient.rpc('ai_usage_today')
  if (!error && Number.isInteger(data)) authUsage = { used: data, limit: authDailyLimit }
}
async function authAccessToken() {
  if (!authClient) return ''
  const { data } = await authClient.auth.getSession()
  return data.session?.access_token || ''
}

function authErrorText(error) {
  const m = String(error?.message || ''), c = String(error?.code || '')
  if (c === 'invalid_credentials' || /invalid login credentials/i.test(m)) return authText('Correo o contraseña incorrectos.', 'Incorrect email or password.')
  if (c === 'email_not_confirmed' || /email not confirmed/i.test(m)) return authText('Primero confirma tu correo con el enlace que te enviamos. Si no lo encuentras, revisa el correo no deseado.', 'Confirm your email first with the link we sent you. If you cannot find it, check your spam folder.')
  if (c === 'user_already_exists' || /already (been )?registered/i.test(m)) return authText('Ya existe una cuenta con este correo. Inicia sesión.', 'An account with this email already exists. Log in.')
  if (c === 'weak_password' || /password should|weak password/i.test(m)) return authText('La contraseña es demasiado débil. Usa al menos 8 caracteres y combina letras y números.', 'The password is too weak. Use at least 8 characters with letters and numbers.')
  if (c === 'same_password') return authText('La nueva contraseña debe ser distinta de la anterior.', 'The new password must differ from the old one.')
  if (/rate limit/i.test(c + m)) return authText('Demasiados intentos seguidos. Espera unos minutos y vuelve a probar.', 'Too many attempts. Wait a few minutes and try again.')
  if (c === 'email_address_not_authorized' || /error sending|sending (confirmation|recovery|magic)|not authorized/i.test(m)) return authText('No se pudo enviar el correo: el envío de correos de NUNA todavía se está configurando. Inténtalo más tarde.', 'The email could not be sent: NUNA email delivery is still being set up. Try again later.')
  if (c === 'email_address_invalid' || /invalid.*email|email.*invalid/i.test(m)) return authText('Revisa el correo electrónico: no parece válido.', 'Check the email address: it does not look valid.')
  if (c === 'signup_disabled' || /signups? not allowed/i.test(m)) return authText('El registro de cuentas nuevas está desactivado por ahora.', 'New sign-ups are disabled for now.')
  if (c === 'validation_failed' && /provider is not enabled/i.test(m)) return authText('El acceso con Google aún no está activado.', 'Google sign-in is not enabled yet.')
  if (error?.name === 'AuthRetryableFetchError' || /fetch|network/i.test(m)) return authText('No se pudo conectar con el servicio de cuentas. Comprueba tu conexión.', 'Could not reach the account service. Check your connection.')
  return authText('No se pudo completar la operación. Inténtalo de nuevo.', 'That did not work. Please try again.')
}

// ---- Dialog ----
function openAuth(mode, notice) {
  authMode = mode || (authUser ? 'account' : 'login')
  authNotice = notice || ''
  showAuth()
  if (!authDialog.open) authDialog.showModal()
}
function showAuth() {
  const es = lang === 'es'
  authDialog.replaceChildren()
  const head = document.createElement('div')
  head.className = 'settings-head'
  const h = document.createElement('h2')
  h.id = 'auth-title'
  h.textContent = { account: authText('Tu cuenta', 'Your account'), signup: authText('Crear cuenta', 'Sign up'), forgot: authText('Recuperar contraseña', 'Reset password'), recovery: authText('Nueva contraseña', 'New password'), sent: authText('Revisa tu correo', 'Check your email') }[authMode] || authText('Bienvenido a NUNA', 'Welcome to NUNA')
  authDialog.setAttribute('aria-labelledby', 'auth-title')
  const close = document.createElement('button')
  close.type = 'button'
  close.className = 'icon'
  close.textContent = '×'
  close.setAttribute('aria-label', authText('Cerrar', 'Close'))
  close.onclick = () => authDialog.close()
  head.append(h, close)
  authDialog.append(head)
  const message = document.createElement('p')
  message.className = 'auth-message'
  message.setAttribute('role', 'status')
  message.textContent = authNotice
  const say = text => { message.textContent = text }
  const link = (text, onclick) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'auth-switch'
    b.textContent = text
    b.onclick = onclick
    authDialog.append(b)
    return b
  }

  if (!authClient) {
    message.textContent = authText('Las cuentas no están disponibles en este momento. Recarga la página para volver a intentarlo.', 'Accounts are not available right now. Reload the page to try again.')
    authDialog.append(message)
    link(authText('Tengo un código de acceso de administrador', 'I have an admin access code'), useAdminCode)
    return
  }

  if (authMode === 'account' && authUser) {
    const who = document.createElement('p')
    who.className = 'auth-who'
    who.textContent = authUser.email || ''
    const via = document.createElement('p')
    via.className = 'settings-note'
    via.textContent = (authUser.app_metadata?.provider === 'google' ? authText('Acceso con Google.', 'Signed in with Google.') : authText('Acceso con correo y contraseña.', 'Signed in with email and password.')) + ' ' + authText('Tus conversaciones y proyectos se guardan en tu cuenta.', 'Your conversations and projects are saved to your account.')
    const usage = document.createElement('p')
    usage.className = 'settings-note'
    usage.textContent = usageLine() || authText('Cada cuenta puede enviar ' + authDailyLimit + ' mensajes a la IA al día.', 'Each account can send ' + authDailyLimit + ' AI messages a day.')
    const out = document.createElement('button')
    out.type = 'button'
    out.className = 'auth-primary'
    out.textContent = authText('Cerrar sesión', 'Log out')
    out.onclick = () => signOutAccount(say, out)
    authDialog.append(who, via, usage, message, out)
    if (authUser.app_metadata?.provider !== 'google') link(authText('Cambiar contraseña', 'Change password'), () => { authMode = 'recovery'; authNotice = ''; showAuth() })
    refreshUsage().then(() => { if (authDialog.open && authMode === 'account' && authUsage) usage.textContent = usageLine() })
    close.focus()
    return
  }

  if (authMode === 'sent') {
    authDialog.append(message)
    link(authText('Volver a iniciar sesión', 'Back to log in'), () => { authMode = 'login'; authNotice = ''; showAuth() }).focus()
    return
  }

  if ((authMode === 'login' || authMode === 'signup') && authSettings.google) {
    const google = document.createElement('button')
    google.type = 'button'
    google.className = 'auth-google'
    google.textContent = authText('G  Continuar con Google', 'G  Continue with Google')
    google.onclick = async () => {
      google.disabled = true
      say(authText('Abriendo Google…', 'Opening Google…'))
      const { error } = await authClient.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } })
      if (error) { google.disabled = false; say(authErrorText(error)) }
    }
    const divider = document.createElement('p')
    divider.className = 'auth-divider'
    divider.textContent = authText('o con tu correo', 'or with your email')
    authDialog.append(google, divider)
  }

  const form = document.createElement('form')
  form.className = 'auth-form'
  function field(label, type, name, autocomplete) {
    const l = document.createElement('label')
    l.className = 'settings-field'
    const span = document.createElement('span')
    span.textContent = label
    const input = document.createElement('input')
    input.type = type
    input.name = name
    input.required = true
    if (autocomplete) input.autocomplete = autocomplete
    l.append(span, input)
    form.append(l)
    return input
  }
  const name = authMode === 'signup' ? field(authText('Nombre', 'Name'), 'text', 'name', 'name') : null
  if (name) { name.maxLength = 60; name.required = false; name.value = profileName || '' }
  const email = authMode === 'recovery' ? null : field(authText('Correo electrónico', 'Email'), 'email', 'email', 'email')
  if (email) { email.maxLength = 254; email.setAttribute('autocapitalize', 'off'); email.spellcheck = false }
  const password = authMode === 'forgot' ? null : field(authMode === 'recovery' ? authText('Nueva contraseña', 'New password') : authText('Contraseña', 'Password'), 'password', 'password', authMode === 'login' ? 'current-password' : 'new-password')
  if (password && authMode !== 'login') { password.minLength = 8; password.maxLength = 72 }
  if (password && authMode !== 'login') {
    const hint = document.createElement('small')
    hint.className = 'auth-hint'
    hint.textContent = authText('Mínimo 8 caracteres.', 'At least 8 characters.')
    password.after(hint)
  }
  const submit = document.createElement('button')
  submit.type = 'submit'
  submit.className = 'auth-primary'
  submit.textContent = { signup: authText('Crear cuenta', 'Create account'), forgot: authText('Enviar enlace', 'Send link'), recovery: authText('Guardar contraseña', 'Save password') }[authMode] || authText('Iniciar sesión', 'Log in')
  form.append(message, submit)
  form.onsubmit = async e => {
    e.preventDefault()
    if (authBusy) return
    authBusy = true
    submit.disabled = true
    say(authText('Un momento…', 'One moment…'))
    try {
      const redirectTo = location.origin + location.pathname
      if (authMode === 'login') {
        const { error } = await authClient.auth.signInWithPassword({ email: email.value.trim(), password: password.value })
        if (error) throw error
        authDialog.close()
      } else if (authMode === 'signup') {
        const fullName = name.value.trim()
        const { data, error } = await authClient.auth.signUp({ email: email.value.trim(), password: password.value, options: { emailRedirectTo: redirectTo, data: fullName ? { full_name: fullName } : {} } })
        if (error) throw error
        if (fullName && !profileName) { profileName = fullName; try { localStorage.setItem('nuna-profile', profileName) } catch {} updateProfile() }
        if (data.session) authDialog.close()
        else { authMode = 'sent'; authNotice = authText(`Te enviamos un enlace a ${email.value.trim()} para confirmar tu cuenta. Ábrelo en este dispositivo y volverás a NUNA con la sesión iniciada.`, `We sent a link to ${email.value.trim()} to confirm your account. Open it on this device to come back to NUNA signed in.`); showAuth() }
      } else if (authMode === 'forgot') {
        const { error } = await authClient.auth.resetPasswordForEmail(email.value.trim(), { redirectTo })
        if (error) throw error
        authMode = 'sent'
        authNotice = authText('Si existe una cuenta con ese correo, recibirás un enlace para crear una contraseña nueva.', 'If an account exists for that email, you will receive a link to set a new password.')
        showAuth()
      } else if (authMode === 'recovery') {
        const { error } = await authClient.auth.updateUser({ password: password.value })
        if (error) throw error
        authMode = 'account'
        authNotice = ''
        showAuth()
        const done = authDialog.querySelector('.auth-message')
        if (done) done.textContent = authText('Contraseña actualizada.', 'Password updated.')
      }
    } catch (error) {
      say(authErrorText(error))
      if (/email not confirmed/i.test(String(error?.message)) && email) {
        const resend = document.createElement('button')
        resend.type = 'button'
        resend.className = 'auth-switch'
        resend.textContent = authText('Reenviar correo de confirmación', 'Resend confirmation email')
        resend.onclick = async () => {
          resend.disabled = true
          const { error: e2 } = await authClient.auth.resend({ type: 'signup', email: email.value.trim(), options: { emailRedirectTo: location.origin + location.pathname } })
          say(e2 ? authErrorText(e2) : authText('Correo reenviado.', 'Email sent again.'))
        }
        form.append(resend)
      }
    } finally {
      authBusy = false
      submit.disabled = false
    }
  }
  authDialog.append(form)
  if (authMode === 'login') {
    link(authText('¿Olvidaste tu contraseña?', 'Forgot your password?'), () => { authMode = 'forgot'; authNotice = ''; showAuth() })
    link(authText('¿No tienes cuenta? Regístrate', 'No account? Sign up'), () => { authMode = 'signup'; authNotice = ''; showAuth() })
  } else if (authMode !== 'recovery') {
    link(authText('¿Ya tienes cuenta? Inicia sesión', 'Already have an account? Log in'), () => { authMode = 'login'; authNotice = ''; showAuth() })
  }
  if (authMode === 'login' || authMode === 'signup') {
    const terms = document.createElement('p')
    terms.className = 'settings-note auth-terms'
    terms.textContent = authText('Con una cuenta puedes enviar ' + authDailyLimit + ' mensajes a la IA cada día. Tus conversaciones se guardan en tu cuenta y se envían al proveedor del modelo elegido para responder.', 'An account can send ' + authDailyLimit + ' AI messages a day. Your conversations are saved to your account and sent to the chosen model provider to answer.')
    authDialog.append(terms)
    link(authText('Tengo un código de acceso de administrador', 'I have an admin access code'), useAdminCode).classList.add('auth-admin')
  }
  ;(authDialog.querySelector('form input') || close).focus()
}
function useAdminCode() {
  authDialog.close()
  askAICode(() => { refreshOpenAITest(); openAIStatus.textContent = authText('Código guardado. Ya puedes enviar tu mensaje.', 'Code saved. You can send your message now.') })
}
async function signOutAccount(say, button) {
  if (button) button.disabled = true
  say?.(authText('Guardando cambios…', 'Saving changes…'))
  const saved = await flushSync()
  if (!saved && !confirm(authText('Algunos cambios todavía no se han guardado en tu cuenta. ¿Cerrar sesión de todos modos?', 'Some changes are not saved to your account yet. Log out anyway?'))) {
    if (button) button.disabled = false
    say?.('')
    return
  }
  const { error } = await authClient.auth.signOut({ scope: 'local' })
  if (error) { say?.(authErrorText(error)); if (button) button.disabled = false; return }
  if (authDialog.open) authDialog.close()
}

// ---- Header, account menu and sidebar profile ----
function updateAuthUI() {
  const header = document.getElementById('auth-header'), account = document.getElementById('auth-account')
  const label = authUser ? (profileName || authUser.email || '').slice(0, 24) : authText('Iniciar sesión', 'Log in')
  header.textContent = label
  header.setAttribute('aria-label', authUser ? authText('Tu cuenta: ', 'Your account: ') + (authUser.email || '') : authText('Iniciar sesión o registrarse', 'Log in or sign up'))
  account.textContent = authUser ? authText('Cerrar sesión', 'Log out') : authText('Iniciar sesión / Registrarse', 'Log in / Sign up')
  header.onclick = () => openAuth(authUser ? 'account' : 'login')
  account.onclick = () => {
    closeAccountMenu()
    if (authUser) signOutAccount(text => { if (text) openAIStatus.textContent = text })
    else openAuth('login')
  }
  const small = document.querySelector('.profile small')
  if (small && authUser?.email) small.textContent = authUser.email
}
const authUiRender = render
render = function () { authUiRender(); updateAuthUI() }

// ---- Sync between this page and the account ----
const chatTitle = c => (typeof c.title === 'string' ? c.title : c.title?.[lang] || '').trim().slice(0, 200) || 'Chat'
const chatRecord = c => JSON.stringify([chatTitle(c), c.project || null, c.messages])
function setSyncProblem(problem) {
  if (problem === syncProblem) return
  syncProblem = problem
  openAIStatus.textContent = problem
    ? authText('No se pudieron guardar los últimos cambios en tu cuenta. Se volverá a intentar automáticamente.', 'Your latest changes could not be saved to your account. Retrying automatically.')
    : authText('Cambios guardados en tu cuenta.', 'Changes saved to your account.')
}
// Errors that retrying cannot fix: a conversation over the size limit, or the account's conversation limit.
const permanentSyncError = error => ['23514', '22001', 'P0001'].includes(String(error?.code || ''))
function permanentSyncText(error) {
  return /conversation_limit/.test(String(error?.message || ''))
    ? authText('Tu cuenta llegó al máximo de 2000 conversaciones guardadas. Borra algunas para guardar las nuevas.', 'Your account reached the limit of 2000 saved conversations. Delete some to save new ones.')
    : authText('Una conversación es demasiado larga para guardarla en tu cuenta. Empieza un chat nuevo.', 'A conversation is too long to save to your account. Start a new chat.')
}
function queueSync(delay = 400) {
  if (!cloudMode()) return
  clearTimeout(syncTimer)
  syncTimer = setTimeout(() => { syncTimer = null; syncChain = syncChain.then(runSync) }, delay)
}
// Wait for pending changes to reach the account; resolves with whether everything was saved.
async function flushSync() {
  if (!cloudMode()) return true
  if (syncTimer) { clearTimeout(syncTimer); syncTimer = null }
  syncChain = syncChain.then(runSync)
  return syncChain
}
async function runSync() {
  if (!cloudMode()) return true
  const owner = authUser.id
  const current = new Map(custom.filter(c => c && typeof c.id === 'string' && Array.isArray(c.messages)).map(c => [c.id, c]))
  const upserts = [], deletes = []
  current.forEach((c, id) => { const record = chatRecord(c); if (syncedChats.get(id) !== record) upserts.push({ id, c, record }) })
  syncedChats.forEach((_, id) => { if (!current.has(id)) deletes.push(id) })
  const stateRecord = JSON.stringify([projects, assignments, hiddenChats])
  try {
    // Send conversations in batches of about 1 MB so one request never gets too large.
    for (let i = 0; i < upserts.length;) {
      const batch = []
      let size = 0
      while (i < upserts.length && (batch.length === 0 || (size + upserts[i].record.length < 1000000 && batch.length < 50))) { size += upserts[i].record.length; batch.push(upserts[i++]) }
      const send = rows => authClient.from('conversations').upsert(rows.map(({ id, c }) => ({ owner, id, title: chatTitle(c), project: c.project || null, messages: c.messages, updated_at: new Date().toISOString() })), { onConflict: 'owner,id' })
      const { error } = await send(batch)
      if (!error) { batch.forEach(u => syncedChats.set(u.id, u.record)); continue }
      if (!permanentSyncError(error)) throw error
      // Save the rest one by one and set aside the ones that can never be saved until they change.
      for (const u of batch) {
        const { error: rowError } = await send([u])
        if (rowError && !permanentSyncError(rowError)) throw rowError
        syncedChats.set(u.id, u.record)
        if (rowError) openAIStatus.textContent = permanentSyncText(rowError)
      }
    }
    for (let i = 0; i < deletes.length; i += 100) {
      const ids = deletes.slice(i, i + 100)
      const { error } = await authClient.from('conversations').delete().in('id', ids)
      if (error) throw error
      ids.forEach(id => syncedChats.delete(id))
    }
    if (stateRecord !== syncedState) {
      const { error } = await authClient.from('user_state').upsert({ owner, projects, assignments, hidden: hiddenChats, updated_at: new Date().toISOString() }, { onConflict: 'owner' })
      if (error) throw error
      syncedState = stateRecord
    }
    if (syncProblem) setSyncProblem(false)
    return true
  } catch (error) {
    console.warn('nuna_sync_error', error?.code || error?.message || error)
    setSyncProblem(true)
    queueSync(8000)
    return false
  }
}

const guestSave = save, guestPersistProjects = persistProjects
save = function () {
  if (!cloudMode()) return guestSave()
  try { localStorage.setItem('nuna-lang', lang); localStorage.setItem('nuna-theme', dark ? 'dark' : 'light') } catch {}
  queueSync()
}
persistProjects = function () { if (cloudMode()) queueSync(); else guestPersistProjects() }
const guestKeys = ['nuna-chats', 'nuna-projects', 'nuna-hidden', 'nuna-assignments']

// After signing in, load the account's data. Chats made on this device before signing in are added to the account
// (the same objects are kept, so a reply that is still on its way lands in the right chat) and then removed from the browser.
async function loadAccountData() {
  accountLoading = true
  accountReady = false
  // Compare ids, not objects: Supabase hands over a new user object on every token refresh.
  const user = authUser, userId = user.id
  const stillSameUser = () => authUser?.id === userId
  openAIStatus.textContent = authText('Cargando tus conversaciones…', 'Loading your conversations…')
  try {
    const rows = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await authClient.from('conversations').select('id,title,project,messages').order('updated_at', { ascending: false }).range(from, from + 999)
      if (error) throw error
      rows.push(...data)
      if (data.length < 1000) break
    }
    const { data: state, error } = await authClient.from('user_state').select('projects,assignments,hidden').maybeSingle()
    if (error) throw error
    if (!stillSameUser()) return
    const ids = new Set(rows.map(r => r.id))
    const local = custom.filter(c => c && typeof c.id === 'string' && Array.isArray(c.messages) && !ids.has(c.id))
    custom = [...local, ...rows.map(r => ({ id: r.id, title: r.title, messages: Array.isArray(r.messages) ? r.messages : [], ...(r.project ? { project: r.project } : {}) }))]
    syncedChats = new Map(rows.map(r => [r.id, chatRecord({ title: r.title, project: r.project, messages: Array.isArray(r.messages) ? r.messages : [] })]))
    const cloudProjects = Array.isArray(state?.projects) ? state.projects : []
    projects = [...cloudProjects, ...projects.filter(p => p && !cloudProjects.some(q => q.id === p.id))]
    assignments = { ...assignments, ...(state?.assignments && typeof state.assignments === 'object' ? state.assignments : {}) }
    hiddenChats = [...new Set([...(Array.isArray(state?.hidden) ? state.hidden : []), ...hiddenChats])]
    syncedState = state ? JSON.stringify([state.projects, state.assignments, state.hidden]) : ''
    accountReady = true
    try { guestKeys.forEach(k => localStorage.removeItem(k)) } catch {}
    if (active && !custom.some(c => c.id === active) && !examples.some(c => c.id === active)) active = null
    if (currentProject && !projects.some(p => p.id === currentProject)) currentProject = null
    const metaName = String(user.user_metadata?.full_name || user.user_metadata?.name || '').trim().slice(0, 60)
    if (!profileName && metaName) { profileName = metaName; try { localStorage.setItem('nuna-profile', profileName) } catch {} updateProfile() }
    openAIStatus.textContent = local.length ? authText('Sesión iniciada. Se añadieron a tu cuenta los chats de este dispositivo.', 'Signed in. Chats from this device were added to your account.') : authText('Sesión iniciada.', 'Signed in.')
    render()
    queueSync(0)
    refreshUsage()
  } catch (error) {
    console.warn('nuna_load_error', error?.code || error?.message || error)
    if (stillSameUser()) {
      openAIStatus.textContent = authText('No se pudieron cargar tus conversaciones. Se volverá a intentar en unos segundos.', 'Your conversations could not be loaded. Retrying in a few seconds.')
      setTimeout(() => { if (stillSameUser() && !accountReady && !accountLoading) loadAccountData() }, 8000)
    }
  } finally {
    accountLoading = false
  }
}
function leaveAccountData() {
  clearTimeout(syncTimer)
  syncTimer = null
  accountReady = false
  syncedChats = new Map()
  syncedState = ''
  syncProblem = false
  authUsage = null
  custom = []
  projects = []
  assignments = {}
  hiddenChats = []
  active = null
  currentProject = null
  selectedChats.clear()
  guestSave()
  guestPersistProjects()
  const small = document.querySelector('.profile small')
  if (small) small.textContent = strings[lang].personal
  render()
}

async function handleAuthChange(event, session) {
  if (event === 'PASSWORD_RECOVERY') openAuth('recovery', authText('Escribe tu nueva contraseña.', 'Enter your new password.'))
  const user = session?.user || null
  const changed = (user?.id || null) !== (authUser?.id || null)
  if (changed && authUser) { authUser = null; leaveAccountData() }
  authUser = user
  updateAuthUI()
  if (changed && user) {
    if (authDialog.open && authMode !== 'recovery') authDialog.close()
    await loadAccountData()
  }
  if (!user && event === 'SIGNED_OUT') openAIStatus.textContent = authText('Sesión cerrada.', 'Logged out.')
}

async function initAuth() {
  // Links from confirmation or recovery emails that expired come back with an error in the address.
  const hash = new URLSearchParams(location.hash.slice(1)), query = new URLSearchParams(location.search)
  const linkError = hash.get('error_code') || query.get('error_code') || hash.get('error') || query.get('error')
  if (linkError) {
    history.replaceState(null, '', location.pathname)
    authNotice = /expired/i.test(linkError + (hash.get('error_description') || query.get('error_description') || ''))
      ? authText('El enlace caducó o ya se usó. Inicia sesión o pide uno nuevo.', 'The link expired or was already used. Log in or request a new one.')
      : authText('No se pudo completar el acceso desde el enlace. Inténtalo de nuevo.', 'Sign-in from the link did not complete. Please try again.')
  }
  try {
    const response = await fetch('/api/config', { signal: AbortSignal.timeout(10000) })
    const config = await response.json()
    if (Number.isInteger(config.dailyLimit)) authDailyLimit = config.dailyLimit
    if (config.supabase && window.supabase?.createClient) {
      authClient = window.supabase.createClient(config.supabase.url, config.supabase.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'nuna-auth' } })
      // Offer Google only when it is actually enabled in Supabase.
      fetch(config.supabase.url + '/auth/v1/settings', { headers: { apikey: config.supabase.key }, signal: AbortSignal.timeout(10000) })
        .then(r => r.json()).then(s => {
          authSettings = { google: Boolean(s.external?.google), autoconfirm: Boolean(s.mailer_autoconfirm) }
          if (authDialog.open && (authMode === 'login' || authMode === 'signup')) showAuth()
        }).catch(() => {})
      // Supabase advises not to call its methods inside this callback, so the work runs right after it.
      authClient.auth.onAuthStateChange((event, session) => setTimeout(() => handleAuthChange(event, session), 0))
    }
  } catch {}
  updateAuthUI()
  if (authNotice) openAuth('login', authNotice)
}
const authLanguageObserver = new MutationObserver(() => { updateAuthUI(); if (authDialog.open) showAuth() })
authLanguageObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] })
updateAuthUI()
initAuth()
