import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import User from '../models/User.js';

const credentials = z.object({
  email: z.email(),
  password: z.string().min(1).max(72), 
});

const signToken = (user) =>
  jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });

export const register = async (req, res) => {
  const parsed = credentials.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: z.treeifyError(err) });
  }
  const { email, password } = parsed.data;

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ email: email, password: passwordHash });
    return res.status(201).json({ token: signToken(user), user });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
};

export const login = async (req, res) => {
  const parsed = credentials.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input' });
  }
  const { email, password } = parsed.data;

  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    const ok = user && (await bcrypt.compare(password, user.password));
    if (!ok) return res.status(401).json({ error: 'Invalid email or password' });

    return res.json({ token: signToken(user), user });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
};

