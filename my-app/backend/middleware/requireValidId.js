import mongoose from 'mongoose';

// Malformed ObjectIds are 400 { error: "Invalid id" }.
// A well-formed id that isn't found or isn't the user's stays a 404 in the handler.
export function sendInvalidId(res) {
  return res.status(400).json({ error: 'Invalid id' });
}

export function hasValidId(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    sendInvalidId(res);
    return false;
  }
  return true;
}

export default function requireValidId(req, res, next) {
  if (!hasValidId(req, res)) return;
  next();
}
