const tabLogin = document.getElementById('tabLogin');
const tabRegister = document.getElementById('tabRegister');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const err = document.getElementById('err');

tabLogin.onclick = () => {
  tabLogin.classList.add('on'); tabRegister.classList.remove('on');
  loginForm.hidden = false; registerForm.hidden = true; err.hidden = true;
};
tabRegister.onclick = () => {
  tabRegister.classList.add('on'); tabLogin.classList.remove('on');
  registerForm.hidden = false; loginForm.hidden = true; err.hidden = true;
};

function showErr(e) { err.textContent = e.message || String(e); err.hidden = false; }

function afterAuth(data) {
  setToken(data.token);
  setUser(data.user);
  location.href = data.user.role === 'admin' ? 'admin.html' : 'trainee.html';
}

loginForm.onsubmit = async (e) => {
  e.preventDefault();
  try {
    const data = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        username: document.getElementById('loginUser').value,
        password: document.getElementById('loginPass').value
      })
    });
    afterAuth(data);
  } catch (ex) { showErr(ex); }
};

registerForm.onsubmit = async (e) => {
  e.preventDefault();
  try {
    const data = await api('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        username: document.getElementById('regUser').value,
        password: document.getElementById('regPass').value
      })
    });
    afterAuth(data);
  } catch (ex) { showErr(ex); }
};

if (getToken() && getUser()) location.href = getUser().role === 'admin' ? 'admin.html' : 'trainee.html';
