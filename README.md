# Football Match Prediction

Simple static site to pick a winner/draw and a goal prediction for a match between Brazil and Japan.

How to use
- Open `index.html` in your browser and sign in with Google.
- Enter your name and the predicted goals for Brazil and Japan (the winner/draw is derived from the goals automatically).
- Click "Submit prediction". Your entry is locked after that — one prediction per account.
- Only the admin account can see the official result and the winners list; everyone else just sees their own locked-in prediction.

Firebase
- The site is linked to a Firebase project using the configuration embedded in `script.js`.
- Each prediction is saved to Firestore at `predictions/{uid}`, keyed by the user's own UID, so a user can only ever have one entry.
- Only the admin account `fadilfadu90@gmail.com` can set the official match result and view the predictions collection / winners list.

Google Sign-in (required)
- In the Firebase Console go to **Authentication → Sign-in method** and enable **Google**.
- Under **Authentication → Settings** add `localhost` and `127.0.0.1` to **Authorized domains** so local testing works.
- The admin account must also sign in with Google using `fadilfadu90@gmail.com`.

Firestore rules (example)
Each prediction is stored at `predictions/{uid}` (the user's own Firebase UID as the document ID), which makes one entry per user a database-level rule, not just a UI check. A separate `config/settings` document holds the predictions-open/closed flag, since regular users need to read that (but nothing else admin-only). Use these rules in **Firestore → Rules**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /predictions/{uid} {
      allow read: if request.auth != null
                  && (request.auth.uid == uid || request.auth.token.email == 'fadilfadu90@gmail.com');
      allow create: if request.auth != null
                    && request.auth.uid == uid
                    && request.resource.data.userId == request.auth.uid
                    && request.resource.data.userEmail == request.auth.token.email
                    && request.resource.data.userName is string
                    && request.resource.data.userName.size() > 0
                    && !(exists(/databases/$(database)/documents/config/settings)
                         && get(/databases/$(database)/documents/config/settings).data.predictionsClosed == true);
      allow update: if false;
      allow delete: if request.auth != null && request.auth.token.email == 'fadilfadu90@gmail.com';
    }

    match /config/match {
      allow read, write: if request.auth != null
                          && request.auth.token.email == 'fadilfadu90@gmail.com';
    }

    match /config/settings {
      allow read: if request.auth != null;
      allow write: if request.auth != null
                   && request.auth.token.email == 'fadilfadu90@gmail.com';
    }
  }
}
```

- `allow create` only matches when the document does not already exist, and `allow update: if false` rejects any resubmission attempt — this is the one-entry-per-user enforcement. It also re-checks `config/settings.predictionsClosed` server-side, so closing predictions can't be bypassed by an old cached page.
- Each user can only read their own prediction document (to know whether they've already submitted) and the `config/settings` flag (to know if predictions are closed); only the admin can read the full `predictions` collection or `config/match`.
- Only the admin can delete a prediction document — used to remove an entry so its owner could resubmit, or to clean up bad data.

Admin behavior
- Once signed in as the admin email, the official-result card and the "Leaderboard" card become visible — they are hidden from everyone else.
- **Official result** starts in a read-only view with a "Set official result" / "Edit official result" button. Clicking it reveals the Brazil/Japan goal inputs (pre-filled with the current value when editing) plus "Save official result" and "Cancel". Saving returns to the read-only view.
- **Predictions status** toggle ("Close predictions" / "Reopen predictions") lets the admin stop new submissions once the match starts — signed-in users who haven't yet submitted see "Predictions are closed" instead of the form; anyone who already submitted keeps seeing their own locked entry.
- **Leaderboard** has two tabs: **Winners** (default) shows only entries whose predicted score is an *exact* match to the official score; **All predictions** shows every submitted entry. Both tabs have a "Delete" button per entry for admin cleanup.
- **Random winner picker** at the bottom of the Leaderboard card draws N random entries from the Winners pool (not all predictions) — enter how many to pick and click "Pick random winner(s)". The count is clamped to however many winners actually exist.

Code changes
- The app shows `Sign in with Google` and `Sign out` buttons; users must sign in to submit a prediction.
- Each prediction requires a name (free text, not just the Google account name) alongside the goal counts; there's no separate "pick winner" control.
- Predictions are stored as `predictions/{uid}`, so each user can submit exactly once; the form is replaced with a locked summary after submission.
- "Winner" is now an exact score match (predicted goals == official goals), not just guessing the correct win/lose/draw outcome.
- The official-result card and the predictions list are admin-only and hidden from regular users entirely; the admin can edit the official result, close/reopen predictions, and delete any individual prediction.

Files
- [index.html](index.html)
- [styles.css](styles.css)
- [script.js](script.js)
