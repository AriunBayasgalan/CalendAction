import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Event from '../models/Event.js';
import Task from '../models/Task.js';
import Rule from '../models/rule.model.js';
import { defaultTimeZone, zonedDateTime, zonedParts } from '../services/timeZone.js';

export const DEMO_EMAIL_DEFAULT = 'demo@calendaction.app';

const WEEKDAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function weekdayInZone(date, timeZone) {
  const label = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(date);
  return WEEKDAYS[label];
}

function addCalendarDays(year, month, day, delta) {
  const utc = new Date(Date.UTC(year, month - 1, day + delta));
  return { year: utc.getUTCFullYear(), month: utc.getUTCMonth() + 1, day: utc.getUTCDate() };
}

// Monday of the week containing `now` in `timeZone`.
export function mondayOf(now, timeZone) {
  const parts = zonedParts(now, timeZone);
  const back = -((weekdayInZone(now, timeZone) + 6) % 7);
  return addCalendarDays(parts.year, parts.month, parts.day, back);
}

export function atWall(monday, plusDays, hour, minute, timeZone) {
  const day = addCalendarDays(monday.year, monday.month, monday.day, plusDays);
  const instant = zonedDateTime(day.year, day.month, day.day, hour, minute, 0, 0, timeZone);
  if (!instant) {
    throw new Error(`Could not build ${hour}:${String(minute).padStart(2, '0')} on day ${plusDays}`);
  }
  return instant;
}

// Rebuilds the demo user's week. Assumes mongoose is already connected.
// Safe to run more than once: it replaces that user's events, tasks and rules.
export async function seedDemoAccount({
  email = DEMO_EMAIL_DEFAULT,
  password,
  timeZone = defaultTimeZone(),
  now = new Date(),
} = {}) {
  if (!email || typeof email !== 'string') throw new Error('DEMO_EMAIL is required');
  if (!password || typeof password !== 'string') throw new Error('DEMO_PASSWORD is required');

  const normalized = email.toLowerCase().trim();
  const hash = await bcrypt.hash(password, 10);
  let user = await User.findOne({ email: normalized });
  if (user) {
    user.password = hash;
    await user.save();
  } else {
    user = await User.create({ email: normalized, password: hash });
  }

  await Promise.all([
    Event.deleteMany({ owner: user._id }),
    Task.deleteMany({ owner: user._id }),
    Rule.deleteMany({ owner: user._id }),
  ]);

  const monday = mondayOf(now, timeZone);

  const events = await Event.create([
    {
      title: 'CS 3510',
      start: atWall(monday, 1, 9, 30, timeZone),
      end: atWall(monday, 1, 10, 45, timeZone),
      location: 'Klaus 1443',
      notes: 'Design and Analysis of Algorithms',
      owner: user._id,
    },
    {
      title: 'CS 3510',
      start: atWall(monday, 3, 9, 30, timeZone),
      end: atWall(monday, 3, 10, 45, timeZone),
      location: 'Klaus 1443',
      notes: 'Design and Analysis of Algorithms',
      owner: user._id,
    },
    {
      title: 'Team meeting',
      start: atWall(monday, 2, 15, 0, timeZone),
      end: atWall(monday, 2, 16, 0, timeZone),
      location: 'Klaus 2447',
      notes: 'Weekly project sync',
      owner: user._id,
    },
  ]);

  const rules = await Rule.create({
    owner: user._id,
    notBefore: '07:00',
    notAfter: '18:00',
    label: 'Gym before 18:00',
  });

  const study = await Task.create({
    owner: user._id,
    title: 'Study for CS 3510',
    durationMinutes: 90,
    status: 'unscheduled',
  });

  const lab = await Task.create({
    owner: user._id,
    title: 'Lab writeup',
    durationMinutes: 60,
    status: 'scheduled',
    start: atWall(monday, 0, 14, 0, timeZone),
    end: atWall(monday, 0, 15, 0, timeZone),
    todoText: 'Write the introduction\nPaste the graphs\nProofread',
  });

  return {
    userId: user._id.toString(),
    email: normalized,
    timeZone,
    monday,
    events,
    rules: [rules],
    tasks: { unscheduled: study, placed: lab },
  };
}

export async function writeCredentialsFile(filePath, { email, password, timeZone }) {
  const body = `# Private demo account (do not commit this file)

Email: ${email}
Password: ${password}
Timezone: ${timeZone}

Sign in at the deployed site or at http://localhost:5173/login.
`;
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, body, { mode: 0o600 });
}

async function runCli() {
  const { default: dotenv } = await import('dotenv');
  const envPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.env');
  dotenv.config({ path: envPath });

  const uri = process.env.MONGODB_URI;
  const email = process.env.DEMO_EMAIL || DEMO_EMAIL_DEFAULT;
  const password = process.env.DEMO_PASSWORD;
  const timeZone = process.env.DEMO_TIMEZONE || defaultTimeZone();
  const credentialsPath =
    process.env.DEMO_CREDENTIALS_PATH ||
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../docs/demo-credentials.md');

  if (!uri) {
    console.error('MONGODB_URI is required. Set it in my-app/backend/.env');
    process.exit(1);
  }
  if (!password) {
    console.error('DEMO_PASSWORD is required. Keep it in the private demo doc, not the README.');
    process.exit(1);
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  try {
    const result = await seedDemoAccount({ email, password, timeZone });
    await writeCredentialsFile(credentialsPath, { email: result.email, password, timeZone });
    console.log(`Seeded demo week for ${result.email}`);
    console.log(`CS 3510 Tue/Thu 9:30–10:45, Team meeting Wed 3:00–4:00, gym rule before 18:00`);
    console.log(`Unscheduled: Study for CS 3510. Placed: Lab writeup (Mon 2:00–3:00) with a to-do.`);
    console.log(`Credentials written to ${credentialsPath} (gitignored).`);
  } finally {
    await mongoose.disconnect();
  }
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
