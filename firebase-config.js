/* =========================================================
   FIND Audit Prompt Builder — Firebase config
   ---------------------------------------------------------
   Project: ai-audit-prompting — already configured below.

   This file powers the optional "live room results" feature:
   attendees can anonymously share their score, and you can
   project a live-updating results wall (results.html) while
   you present.

   The main app (index.html) works completely normally without
   this — it just skips the sharing step if it's ever unset.

   REMAINING STEP — Firestore security rules (do this once,
   in the Firebase console, before your first live run):

   1. In the left sidebar, go to Build > Firestore Database.
      If you haven't already, click "Create database" (choose
      a region close to your event) and "Start in production
      mode."

   2. Click the "Rules" tab and replace the default rules with
      this, then click "Publish":

      rules_version = '2';
      service cloud.firestore {
        match /databases/{database}/documents {
          match /submissions/{submissionId} {
            allow create: if request.resource.data.keys().hasOnly(
                             ['page', 'score', 'flags', 'friction', 'submittedAt']
                           )
                           && request.resource.data.score is int
                           && request.resource.data.score >= 0
                           && request.resource.data.score <= 4;
            allow read: if true;
            allow update, delete: if false;
          }
        }
      }

      This lets anyone anonymously add a properly-shaped result
      and lets anyone read the live totals (needed for the
      projector view) — but nobody can edit or delete existing
      entries from the browser.

   3. Optional cleanup between sessions: Firestore supports a
      native TTL policy (Firestore > TTL in the console) if
      you'd rather old results expire automatically than clear
      them by hand before each talk. Not required — you can
      also just delete the "submissions" collection in the
      console before each run.

   A note on the API key below: Firebase web API keys are safe
   to commit to a public repo (this one will be, on GitHub
   Pages) — they only identify the project. The actual access
   control is the Firestore rules above, which is why step 2
   above is the step that actually matters.
   ========================================================= */

window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyBqv5sjBw80q6Aq3TjJxRpxcVBcaVpM8_E",
  authDomain: "ai-audit-prompting.firebaseapp.com",
  projectId: "ai-audit-prompting",
  storageBucket: "ai-audit-prompting.firebasestorage.app",
  messagingSenderId: "235709797258",
  appId: "1:235709797258:web:25d172b45064abb0be6e73"
};

window.FIREBASE_COLLECTION = "submissions";
