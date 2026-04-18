# Installation Guide — LINK'DUP for Mac

**Estimated time: 20 to 30 minutes**  
**Technical level required: none**  
**System: macOS 12 (Monterey) or later**

---

## Before You Start — What You're About to Do

LINK'DUP is an application that runs on your Mac and opens in your browser. It needs two keys to work:

- An **OpenRouter key** → so the AI can generate your posts
- A **LinkedIn key** → to publish directly to your LinkedIn profile (optional but recommended)

This guide walks you through getting both keys, one step at a time.

---

## PART 1 — Prepare Your Mac

### 1.1 — Open Terminal

Terminal is the tool that lets you install software and run LINK'DUP. It's a black window where you type commands.

To open it:
1. Press `⌘ + Space` (Command key + Space bar)
2. Type `Terminal`
3. Press Enter

Keep this window open throughout the entire installation.

---

### 1.2 — Install Homebrew

Homebrew is a tool that makes installing software on Mac simple. Copy and paste this command exactly into Terminal, then press Enter:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

It will ask for your **Mac password** (the same one you use to unlock your screen). Characters don't appear as you type — this is normal. Type your password and press Enter.

> ⏳ This takes 3 to 5 minutes. Wait until Terminal shows a new prompt line (`%` or `$`).

If at the end Terminal shows instructions like "Run these two commands...", run them one by one.

**Check — type this to confirm Homebrew is installed:**
```bash
brew --version
```
→ You should see `Homebrew 4.x.x`

---

### 1.3 — Install Node.js

Node.js is the engine that runs LINK'DUP:

```bash
brew install node@20
```

> ⏳ 2 to 4 minutes.

**Check:**
```bash
node --version
```
→ You should see `v20.x.x` (or higher than 18)

---

### 1.4 — Install Git

Git is the tool that downloads LINK'DUP from GitHub:

```bash
brew install git
```

**Check:**
```bash
git --version
```
→ You should see `git version 2.x.x`

---

## PART 2 — Create Your OpenRouter Key

OpenRouter is the AI service that generates your LinkedIn posts. Without it, the app cannot create any content.

### 2.1 — Create an Account

1. Go to **[openrouter.ai](https://openrouter.ai)** in your browser
2. Click **Sign in** in the top right corner
3. Choose **Continue with Google** (easiest) or create an account with your email

---

### 2.2 — Add Credits

AI models use small amounts of credits on each request. Here are the real costs:

| Action | Estimated cost |
|--------|---------------|
| Generate a post (3 versions) | ~$0.03 |
| Optimize an existing post | ~$0.01 |
| **50 posts generated** | **~$1.50** |

**To add credits:**
1. Once logged in, click your **avatar** in the top right corner
2. Click **Credits**
3. Click the **Add credits** button
4. Enter an amount (recommendation: **$10** to start — around 300 posts)
5. Enter your credit card details and confirm

---

### 2.3 — Create the API Key

1. In the left menu, click **Keys**  
   *(or go directly to [openrouter.ai/keys](https://openrouter.ai/keys))*
2. Click the **Create Key** button
3. In the **Name** field, type: `LinkDup`
4. Leave the **Credit limit** field empty
5. Click **Create**

**Your key appears on screen.** It looks like this:
```
sk-or-v1-a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4
```

> ⚠️ **This key is shown only once.** Copy it immediately and save it somewhere safe (Notes, 1Password, etc.). If you lose it, you'll need to create a new one.

> 🔒 Never share this key. It is tied to your account and your credits.

---

## PART 3 — Create Your LinkedIn Application

This part allows you to publish posts directly from LINK'DUP to your LinkedIn profile.

> ℹ️ LinkedIn requires developers to create an "app" to get publishing rights. This is a standard procedure — you don't need to be a developer to do it.

### 3.1 — Access the LinkedIn Developer Portal

1. Make sure you're logged into your regular LinkedIn account in the browser
2. Go to **[linkedin.com/developers/apps](https://www.linkedin.com/developers/apps)**
3. Click the **Create app** button (top right)

---

### 3.2 — Fill Out the Creation Form

LinkedIn asks you to fill in 4 fields:

**App name**  
Type: `LinkDup` or `My LinkedIn Tool` — doesn't matter, it's just a name for you.

**LinkedIn Page** (company page to link)  
LinkedIn requires linking the app to a company page. If you already have one, select it from the list. If you don't:
- Click the **Create a new LinkedIn Page** link
- Choose **Company**, then fill in a name (e.g. your name or your business name)
- Go back to the app creation page and select this new page

**App logo**  
Upload any image (your profile photo or a logo). LinkedIn requires it but it won't be visible to your followers.

**Legal agreement**  
Check the box **"I have read and agree..."**

Click **Create app**.

---

### 3.3 — Enable Publishing Permissions

Once the app is created, you'll land on its dashboard. Follow these steps in order:

**Step A — Add the required products**

1. Click the **Products** tab (in the tabs at the top of the page)
2. Find the product **"Sign In with LinkedIn using OpenID Connect"**
3. Click **Select** next to this product
4. A pop-up appears — click **Add product** to confirm
5. Find the product **"Share on LinkedIn"**
6. Click **Select** next to it, then **Add product**

> ⏳ LinkedIn validates these products automatically within a few seconds to a few minutes. The page will show "Added" in green once validated.

---

**Step B — Set the OAuth callback URL**

1. Click the **Auth** tab (in the tabs at the top)
2. Find the section **OAuth 2.0 settings**
3. Under **Authorized redirect URLs for your app**, click **Add redirect URL** (or the pencil icon)
4. Copy and paste this URL exactly:
   ```
   http://localhost:3000/api/linkedin/callback
   ```
5. Click **Update** to save

> ⚠️ This URL must be copied and pasted **exactly** as shown — no spaces, no capital letters, no extra `/`. Any difference will prevent the connection from working.

---

### 3.4 — Retrieve Your Client ID and Client Secret

Still in the **Auth** tab, look for the **Application credentials** section (at the very top of this tab).

You'll see two values:

**Client ID**  
This is a public identifier that looks like:
```
86abcdef12345678
```
Copy it and note it down.

**Client Secret**  
This is your secret key. To reveal it, click the eye icon 👁 next to it. It looks like:
```
AbCdEfGh1234567890IjKlMnOp
```
Copy it and save it somewhere safe.

> ⚠️ Never share your Client Secret. Treat it like a password.

---

## PART 4 — Download and Install LINK'DUP

### 4.1 — Download the Code from GitHub

In Terminal, choose where you want to install the app. For example, in your Documents folder:

```bash
cd ~/Documents
```

Then download the code:

```bash
git clone https://github.com/Spielben/LinkedUp.git
```

Enter the folder:

```bash
cd LinkedUp
```

---

### 4.2 — Install Dependencies

This command installs all the components the app needs to run:

```bash
npm install
```

> ⏳ 1 to 2 minutes. You'll see text scrolling — this is normal.

---

## PART 5 — Save Your Keys in LINK'DUP

Your keys are stored securely in your **Mac Keychain**. They are never written to a text file and never sent to GitHub.

### 5.1 — Save the OpenRouter Key

Copy and paste this command into Terminal, replacing `YOUR_KEY_HERE` with your actual OpenRouter key:

```bash
security add-generic-password -s linkdup -a openrouter -w "YOUR_KEY_HERE"
```

**Example:**
```bash
security add-generic-password -s linkdup -a openrouter -w "sk-or-v1-a1b2c3..."
```

---

### 5.2 — Save the LinkedIn Client ID

Replace `YOUR_CLIENT_ID` with the value you copied in step 3.4:

```bash
security add-generic-password -s linkdup -a linkedin_client_id -w "YOUR_CLIENT_ID"
```

---

### 5.3 — Save the LinkedIn Client Secret

Replace `YOUR_CLIENT_SECRET` with the value you copied in step 3.4:

```bash
security add-generic-password -s linkdup -a linkedin_client_secret -w "YOUR_CLIENT_SECRET"
```

---

### 5.4 — Verify Everything Is Saved

This command checks the keys stored for LINK'DUP:

```bash
security find-generic-password -s linkdup -a openrouter 2>/dev/null && echo "✅ OpenRouter OK" || echo "❌ OpenRouter missing"
security find-generic-password -s linkdup -a linkedin_client_id 2>/dev/null && echo "✅ LinkedIn Client ID OK" || echo "❌ LinkedIn Client ID missing"
security find-generic-password -s linkdup -a linkedin_client_secret 2>/dev/null && echo "✅ LinkedIn Client Secret OK" || echo "❌ LinkedIn Client Secret missing"
```

You should see three `✅ ... OK` lines.

---

## PART 6 — First Launch

### 6.1 — Start the App

```bash
npm run dev
```

You'll see this appear in Terminal:
```
[api] Server running on http://localhost:3000
[ui]  ➜  Local: http://localhost:5173
```

---

### 6.2 — Open the Interface

Open your browser (Chrome or Safari) and go to:  
**[http://localhost:5173](http://localhost:5173)**

---

### 6.3 — Set Up Your Profile

1. Click **Settings** (gear icon, left menu)
2. Fill in the fields:
   - **Name**: your first and last name
   - **Email**: your email address
   - **LinkedIn URL**: your LinkedIn profile URL (e.g. `https://www.linkedin.com/in/your-name/`)
   - **Signature**: the text automatically added at the end of each post (e.g. your hashtag, slogan, or CTA)
   - **Language**: choose `en` for posts in English
3. Click **Save settings**

---

### 6.4 — Connect Your LinkedIn Account

1. Still in Settings, find the **LinkedIn** section
2. Click **Connect LinkedIn**
3. A LinkedIn window opens in your browser — log in and click **Allow**
4. The window closes automatically and you'll see your LinkedIn name appear in Settings

> If the connection fails, check that you added the URL `http://localhost:3000/api/linkedin/callback` in step 3.3 (Step B).

---

## Daily Use

To launch LINK'DUP each day:

```bash
cd ~/Documents/LinkedUp
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173) in your browser.

To close the app: go back to Terminal and press `Ctrl + C`.

**Optional shortcut** — to launch the app by just typing `linkdup` in Terminal:

```bash
echo 'alias linkdup="cd ~/Documents/LinkedUp && npm run dev"' >> ~/.zshrc && source ~/.zshrc
```

---

## Updating LINK'DUP

When a new version is available:

```bash
cd ~/Documents/LinkedUp
git pull origin main
npm install
```

Your posts, styles, and data are safe — they live in the `data/` folder which is never touched by updates.

---

## Troubleshooting

**"command not found: brew"**  
Homebrew isn't in your PATH. Open a new Terminal window, or run:
```bash
eval "$(/opt/homebrew/bin/brew shellenv)"
```

**"command not found: node"**  
Node.js isn't in your PATH:
```bash
export PATH="/opt/homebrew/opt/node@20/bin:$PATH"
```

**The app throws an "OpenRouter key not found" error**  
Make sure you ran the command in step 5.1, then restart `npm run dev`.

**LinkedIn connection fails with "redirect_uri_mismatch"**  
The callback URL in your LinkedIn app isn't exactly right. Go back to the LinkedIn Developer portal → Auth tab → copy and paste again:
```
http://localhost:3000/api/linkedin/callback
```

**Replace or delete a key from Keychain**  
If you made a mistake and need to update a key:
```bash
# Delete the old one
security delete-generic-password -s linkdup -a openrouter

# Save the new one
security add-generic-password -s linkdup -a openrouter -w "YOUR_NEW_KEY"
```

---

## Summary

| Step | What you do | Time |
|------|-------------|------|
| 1 | Install Homebrew, Node.js, Git | 5-8 min |
| 2 | Create OpenRouter account + API key | 5 min |
| 3 | Create LinkedIn app + get Client ID/Secret | 8-10 min |
| 4 | Download LINK'DUP from GitHub | 2 min |
| 5 | Save keys in Mac Keychain | 2 min |
| 6 | Launch the app + set up your profile | 3 min |

---

> For any questions, open an issue on GitHub: **[github.com/Spielben/LinkedUp/issues](https://github.com/Spielben/LinkedUp/issues)**
