# Push seed data to your Firestore DB (Resource Library)

---

## Option 1 – Browser script (API calls, no Node)

Use a small HTML page that signs you in and pushes data via the Firebase JS API (same as your app).

1. **Open the script in your browser**  
   Double‑click or open in Chrome/Edge:
   ```
   FemCare Community/scripts/seed-via-api.html
   ```
2. **Sign in** with the same email/password you use for your FemCare app (must be a user in Firebase Auth).
3. **Click “Push seed data to Firestore”**  
   The script will add the 8 sample resources to the `resources` collection.

**Note:** Firestore rules must allow writes for signed-in users. In Firebase Console → Firestore → Rules, you need something like:
```
allow read, write: if request.auth != null;
```
(or a rule that allows write on `resources` for authenticated users).

---

## Option 2 – npm + cmd (Node script)

### Option A – Use your Google login (recommended)

**One-time setup:** install Google Cloud SDK and log in.

1. **Install Google Cloud SDK**  
   https://cloud.google.com/sdk/docs/install  
   (Or with Chocolatey: `choco install gcloudsdk`)

2. **Log in with your Google account** (the one that owns the Firebase project):

   ```cmd
   gcloud auth application-default login
   ```

   A browser window opens; sign in. No key file needed.

**Push data to your DB (run from the folder that contains `scripts`):**

```cmd
cd scripts
npm install
npm run seed
```

That’s it. Data is written to your Firestore `resources` collection.

---

## Option B – Use a service account key file

1. **Get the key**  
   Firebase Console → your project → **Project settings** (gear) → **Service accounts** → **Generate new private key** → save the JSON.

2. **Put it in the project**  
   Rename the file to `serviceAccountKey.json` and place it inside the `scripts` folder.

3. **Push data:**

   ```cmd
   cd scripts
   npm install
   npm run seed
   ```

---

## Single copy-paste (after Option A or B is done once)

From the **FemCare Community** folder (the one that contains `scripts`):

```cmd
cd scripts
npm run seed
```

(If you haven’t run `npm install` in `scripts` before, use: `npm install` then `npm run seed`.)

---

After running, open your app → **Resources** to see the new articles in your DB.
