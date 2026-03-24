# Deploy FemCare Community to Firebase via GitHub

## 1. One-time: Get a Firebase CI token

Do this in a **terminal** (PowerShell, Command Prompt, or VS Code terminal).

1. **Install Firebase CLI** (if you don’t have it):
   ```bash
   npm install -g firebase-tools
   ```

2. **Log in to Firebase** (opens a browser; sign in with your Google account):
   ```bash
   firebase login
   ```

3. **Get a token for GitHub Actions** (same login; no browser this time):
   ```bash
   firebase login:ci
   ```
   - A browser window may open to confirm.
   - When it finishes, the terminal will print a **long token** (starts with something like `1//...`).
   - **Copy the entire token** — you’ll paste it as a GitHub secret in the next section.
   - Keep it private; don’t share it or commit it to the repo.

## 2. Push your code to GitHub

- Create a new repo on GitHub (e.g. `femcare-community`).
- Push this folder. Use the **main** branch for auto-deploy:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

## 3. Add the secret in GitHub

1. Open your repo on GitHub → **Settings** → **Secrets and variables** → **Actions**.
2. **New repository secret**:
   - Name: `FIREBASE_TOKEN`
   - Value: the token from step 1.

## 4. Deploy

- **Automatic:** Every push to `main` will run the workflow and deploy to Firebase Hosting.
- **Manual:** In the repo go to **Actions** → **Deploy to Firebase Hosting** → **Run workflow**.

Your site will be at: **https://femcare-community.web.app** (or the URL shown in Firebase Console → Hosting).

## If your project ID is different

Edit `.firebaserc` and set `"default"` to your Firebase project ID. The workflow uses the project from this file.
