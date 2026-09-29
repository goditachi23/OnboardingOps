const express = require('express');
const path = require('path');
const { PORT } = require('./config/config');
const { load } = require('./db/database');
const seed = require('./db/seed');

const authRoutes = require('./routes/auth');
const sopRoutes = require('./routes/sops');
const adminRoutes = require('./routes/admin');
const progressRoutes = require('./routes/progress');
const reportRoutes = require('./routes/reports');

const app = express();
app.use(express.json());

// First run convenience: seed a default admin + the 4 sample SOPs if the
// database is empty, so `npm install && npm start` works out of the box.
const existing = load();
if (existing.users.length === 0) {
  seed();
  console.log('First run: seeded a default admin and 4 sample SOPs (see README for credentials).');
}

app.use('/api/auth', authRoutes);
app.use('/api/sops', sopRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/reports', reportRoutes);
app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => res.redirect('/login.html'));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => console.log(`OnboardOps server running on http://localhost:${PORT}`));
