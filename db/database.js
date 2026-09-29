// Minimal file-backed JSON store.
// Every read re-reads the file and every write re-writes it fully, so the
// server process never trusts anything the browser sends it about scores or
// roles -- the file on disk is the single source of truth.
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'db.json');

function load() {
  if (!fs.existsSync(DB_FILE)) {
    const empty = { users: [], sops: [], attempts: [] };
    fs.writeFileSync(DB_FILE, JSON.stringify(empty, null, 2));
    return empty;
  }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
}

function save(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

module.exports = { load, save };
