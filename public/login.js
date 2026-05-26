const form     = document.getElementById('loginForm');
const emailIn  = document.getElementById('emailInput');
const passIn   = document.getElementById('passwordInput');
const errorBox = document.getElementById('loginError');
const submitBtn = document.getElementById('submitBtn');
const btnText  = submitBtn.querySelector('.btn-text');
const spinner  = submitBtn.querySelector('.btn-spinner');

const existing = localStorage.getItem('aegis_token');
if (existing) {
  fetch('/api/auth/me', { headers: { Authorization: `Bearer ${existing}` } })
    .then((r) => { if (r.ok) window.location.href = '/'; });
}

const showError = (msg) => {
  errorBox.textContent = msg;
  errorBox.hidden = false;
};

const setLoading = (loading) => {
  submitBtn.disabled = loading;
  spinner.hidden = !loading;
  btnText.textContent = loading ? 'Verifying...' : 'Authenticate';
};

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorBox.hidden = true;
  setLoading(true);

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: emailIn.value.trim(),
        password: passIn.value,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Login failed (${res.status})`);
    }

    const data = await res.json();
    localStorage.setItem('aegis_token', data.token);
    localStorage.setItem('aegis_user', JSON.stringify(data.user));
    window.location.href = '/';
  } catch (err) {
    showError(err.message);
    setLoading(false);
  }
});
