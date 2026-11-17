# CalendAction demo script (about 3 minutes)

Use this for a live walkthrough. Sign-in credentials are in the private demo
doc, not the public README. If the wifi dies, the pictures in
[demo-backup/](demo-backup/) cover every step.

This script assumes CA-32's demo seed has been run on the database you're
showing (production after CA-33, or your local MongoDB). If a previous demo
already placed "Study for CS 3510", run `npm run seed` in `my-app/backend/`
again to reset the week.

## 0:00 Sign in

1. Open the production URL from the README, or http://localhost:5173 for a
   local run.
2. Log in with the demo email and password from the private demo doc.
3. You land on the current week.

Backup: [demo-backup/demo-signed-in.png](demo-backup/demo-signed-in.png)

## 0:20 Show classes

1. Point out **CS 3510** on Tuesday and Thursday, 9:30–10:45 AM.
2. Point out **Team meeting** on Wednesday, 3:00–4:00 PM.
3. Optionally open **Rules** and show **Gym before 18:00** (nothing after 18:00).

Backup: [demo-backup/demo-classes.png](demo-backup/demo-classes.png)

## 0:50 Place a task

1. In **Needs a slot**, find **Study for CS 3510**.
2. Press **Place**.
3. The task appears in the first free hole on the grid and in **Scheduled**.

Backup: [demo-backup/demo-placed.png](demo-backup/demo-placed.png)

## 1:20 Skip it

1. On the **Study for CS 3510** card under Scheduled, press **Skip**.
2. It moves to a later hole (or returns to Needs a slot if nothing later fits).

Backup: [demo-backup/demo-skipped.png](demo-backup/demo-skipped.png)

## 1:40 Tap a block

1. Click **Lab writeup** (Monday 2:00–3:00 PM) on the grid.
2. The panel opens with its to-do list (Write the introduction, Paste the
   graphs, Proofread).
3. Close the panel.

Backup: [demo-backup/demo-panel.png](demo-backup/demo-panel.png)

## 2:10 Show the bird

1. Click the bird in the bottom-right corner.
2. It says one canned line about what's next and offers a button to open that
   block (or to add a task if the week is empty).

Backup: [demo-backup/demo-bird.png](demo-backup/demo-bird.png)

## 2:40 Optional, if time remains

Open a block that falls today and press **Start**. The streak badge should
count the first Start of the day.

## If wifi dies

Walk through the backup screenshots in order: signed in, classes, placed,
skipped, panel, bird. There is no separate 60-second clip; these stills cover
the same path.
