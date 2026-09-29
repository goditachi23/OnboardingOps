// Thin fetch wrapper shared by every page. The JWT is cached in localStorage
// purely so the browser doesn't have to log in again on every reload -- it
// carries no authority by itself. Every request re-sends it to the server,
// which re-verifies the signature and re-reads role/tracks from the token's
// signed payload, so nothing in localStorage can be edited to gain access.
const API_BASE = '/api';

function getToken() { return localStorage.getItem('oo_token'); }
function setToken(t) { localStorage.setItem('oo_token', t); }
function clearSession() { localStorage.removeItem('oo_token'); localStorage.removeItem('oo_user'); }
function getUser() { try { return JSON.parse(localStorage.getItem('oo_user')); } catch (e) { return null; } }
function setUser(u) { localStorage.setItem('oo_user', JSON.stringify(u)); }

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = getToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(API_BASE + path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// Redirects to login if there's no session, or to the correct home page if
// the cached role doesn't match what this page requires.
function requireAuth(role) {
  const user = getUser();
  if (!getToken() || !user) { location.href = 'login.html'; return null; }
  if (role && user.role !== role) {
    location.href = user.role === 'admin' ? 'admin.html' : 'trainee.html';
    return null;
  }
  return user;
}

function logout() { clearSession(); location.href = 'login.html'; }
