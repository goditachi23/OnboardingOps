// A single, shared definition of what counts as "the same track" everywhere
// tracks are written or compared. This is what actually fixes the bug where
// an SOP added under a slightly different-cased or padded track string
// (e.g. "Linux " vs "linux") silently never matched a trainee's assignment.
function normalizeTrack(t) {
  return String(t || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

module.exports = { normalizeTrack };
