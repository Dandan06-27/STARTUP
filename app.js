/* ============================================================
   app.js — UI Logic & Auth Flow
   ============================================================ */

/* ── DOM references ── */
const loginView     = () => document.getElementById('viewLogin');
const registerView  = () => document.getElementById('viewRegister');
const resetView     = () => document.getElementById('viewReset');
const dashView      = () => document.getElementById('viewDashboard');

/* ── View switcher ── */
function showView(id) {
  ['viewLogin','viewRegister','viewReset','viewDashboard'].forEach(v => {
    const el = document.getElementById(v);
    if (el) el.classList.toggle('active', v === id);
  });
  clearAllErrors();
}

/* ── Toast ── */
function showToast(msg, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent  = msg;
  toast.className    = `toast toast--${type} show`;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 3500);
}

/* ── Error helpers ── */
function setError(fieldId, msg) {
  const el = document.getElementById(fieldId);
  if (!el) return;
  el.textContent = msg;
  el.classList.toggle('visible', !!msg);
}

function clearAllErrors() {
  document.querySelectorAll('.field-error').forEach(e => {
    e.textContent = '';
    e.classList.remove('visible');
  });
}

/* ── Loader on button ── */
function setLoading(btnId, loading) {
  const btn  = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled  = loading;
  const span    = btn.querySelector('.btn-label');
  const spinner = btn.querySelector('.spinner');
  if (span)    span.style.opacity  = loading ? '0' : '1';
  if (spinner) spinner.style.display = loading ? 'block' : 'none';
}

/* ── Password strength ── */
function checkStrength(pw) {
  let score = 0;
  if (pw.length >= 8)          score++;
  if (/[A-Z]/.test(pw))        score++;
  if (/[0-9]/.test(pw))        score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score; // 0–4
}

function updateStrengthBar(pw) {
  const bar    = document.getElementById('strengthBar');
  const label  = document.getElementById('strengthLabel');
  if (!bar || !label) return;
  const score  = checkStrength(pw);
  const levels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const colors = ['', '#ef4444', '#f97316', '#eab308', '#22c55e'];
  bar.style.width      = `${(score / 4) * 100}%`;
  bar.style.background = colors[score] || '#334155';
  label.textContent    = pw.length ? levels[score] || 'Too short' : '';
  label.style.color    = colors[score] || '#94a3b8';
}

/* ── Avatar initials ── */
function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
}

/* ── Render dashboard ── */
function renderDashboard(session) {
  if (!session) return;
  const meta  = session.user.user_metadata || {};
  const name  = meta.full_name || session.user.email.split('@')[0];
  const email = session.user.email;
  const date  = new Date(session.user.created_at).toLocaleDateString('en-PH', {
    year: 'numeric', month: 'long', day: 'numeric'
  });

  document.getElementById('dashName').textContent    = name;
  document.getElementById('dashEmail').textContent   = email;
  document.getElementById('dashJoined').textContent  = date;
  document.getElementById('dashAvatar').textContent  = getInitials(name);
  document.getElementById('dashId').textContent      = session.user.id.slice(0,8) + '…';
  showView('viewDashboard');
}

/* ============================================================
   REGISTER
   ============================================================ */
document.getElementById('formRegister').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearAllErrors();

  const name  = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const pw    = document.getElementById('regPassword').value;
  const pw2   = document.getElementById('regPassword2').value;
  let valid   = true;

  if (!name)  { setError('errRegName',  'Full name is required.');  valid = false; }
  if (!email) { setError('errRegEmail', 'Email is required.');       valid = false; }
  if (pw.length < 6) { setError('errRegPw', 'Minimum 6 characters.'); valid = false; }
  if (pw !== pw2) { setError('errRegPw2', 'Passwords do not match.'); valid = false; }
  if (!valid) return;

  setLoading('btnRegister', true);
  const { data, error } = await signUp(email, pw, name);
  setLoading('btnRegister', false);

  if (error) {
    setError('errRegEmail', error.message);
    return;
  }

  // If email confirmation is OFF the session is returned immediately
  if (data.session) {
    showToast('🎉 Account created! Welcome.', 'success');
    renderDashboard(data.session);
  } else {
    showToast('✉️ Check your email to confirm your account.', 'info');
    showView('viewLogin');
  }
});

/* ============================================================
   LOGIN
   ============================================================ */
document.getElementById('formLogin').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearAllErrors();

  const email = document.getElementById('loginEmail').value.trim();
  const pw    = document.getElementById('loginPassword').value;
  let valid   = true;

  if (!email) { setError('errLoginEmail', 'Email is required.'); valid = false; }
  if (!pw)    { setError('errLoginPw',    'Password is required.'); valid = false; }
  if (!valid) return;

  setLoading('btnLogin', true);
  const { data, error } = await signIn(email, pw);
  setLoading('btnLogin', false);

  if (error) {
    setError('errLoginPw', error.message);
    return;
  }

  showToast('👋 Welcome back!', 'success');
  setTimeout(() => redirectAfterLogin(), 800); // brief pause so toast is visible
});

/* ============================================================
   FORGOT PASSWORD
   ============================================================ */
document.getElementById('formReset').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearAllErrors();

  const email = document.getElementById('resetEmail').value.trim();
  if (!email) { setError('errResetEmail', 'Email is required.'); return; }

  setLoading('btnReset', true);
  const { error } = await resetPassword(email);
  setLoading('btnReset', false);

  if (error) {
    setError('errResetEmail', error.message);
    return;
  }

  showToast('📬 Password reset email sent!', 'success');
  showView('viewLogin');
});

/* ============================================================
   SIGN OUT
   ============================================================ */
document.getElementById('btnSignOut').addEventListener('click', async () => {
  await signOut();
  showToast('You have been signed out.', 'info');
  showView('viewLogin');
});

/* ============================================================
   TOGGLE PASSWORD VISIBILITY
   ============================================================ */
document.querySelectorAll('.toggle-pw').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = document.getElementById(btn.dataset.target);
    if (!target) return;
    const isText = target.type === 'text';
    target.type = isText ? 'password' : 'text';
    btn.innerHTML = isText ? eyeIcon() : eyeOffIcon();
  });
});

function eyeIcon() {
  return `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"
    viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/></svg>`;
}
function eyeOffIcon() {
  return `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"
    viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8
    a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8
    a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/></svg>`;
}

/* ── Real-time password strength on register ── */
document.getElementById('regPassword').addEventListener('input', (e) => {
  updateStrengthBar(e.target.value);
});

/* ============================================================
   INIT — Check for existing session on page load
   ============================================================ */
(async () => {
  const session = await getSession();
  if (session) {
    renderDashboard(session);
  } else {
    showView('viewLogin');
  }

  // React to auth state changes (e.g. token expiry)
  onAuthChange((event, session) => {
    if (event === 'SIGNED_OUT' || !session) {
      showView('viewLogin');
    }
  });
})();