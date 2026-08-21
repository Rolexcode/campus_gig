# CampusGig Firebase setup

The app uses Firebase Authentication, Cloud Firestore, Firebase Admin, and Resend. Browser credentials belong in `NEXT_PUBLIC_FIREBASE_*`; Resend and Admin credentials must remain server-only.

## 1. Create the Firebase project

1. Open the [Firebase Console](https://console.firebase.google.com/).
2. Create or select the project that will own CampusGig's authentication data.
3. In **Project settings → Your apps**, add a **Web app**.
4. Keep the web configuration shown by Firebase open for step 4 below.

## 2. Enable email/password authentication

1. Open **Build → Authentication → Get started**.
2. Under **Sign-in method**, enable **Email/Password**.
3. Leave email-link/passwordless sign-in disabled unless it is intentionally added later.

## 3. Create Cloud Firestore

1. Open **Build → Firestore Database → Create database**.
2. Choose the production location closest to the primary users.
3. Start in production mode; the repository's `firestore.rules` file defines the intended access.

## 4. Add the local environment file

From the `campus-gig` folder, copy `.env.example` to `.env.local`, then fill it with the Firebase web-app values:

```powershell
Copy-Item .env.example .env.local
```

Do not add quotes unless a value itself requires them. `.env.local` is ignored by Git.

## 5. Configure email codes and Firebase Admin

Email codes and the real admin user list run on the Next.js server. They cannot safely run with browser credentials alone.

1. In Firebase, open **Project settings → Service accounts**.
2. Select **Generate new private key** and download the JSON file.
3. Store that file outside the CampusGig project folder. Never upload or commit it.
4. Add its absolute path, the admin email, and the Resend sender to `.env.local`:

```env
GOOGLE_APPLICATION_CREDENTIALS=C:\Users\YOUR_NAME\secure\campus-gig-service-account.json
ADMIN_EMAILS=your-admin-login@example.com
RESEND_FROM_EMAIL=CampusGig <onboarding@resend.dev>
```

`onboarding@resend.dev` can send only to the email associated with your Resend account. To send codes to other people, verify a domain in Resend and use an address such as `CampusGig <verify@yourdomain.com>`.

In Firebase Authentication, open **Settings → Authorized domains** and add `localhost` for local testing.

## 6. Deploy the Firestore rules

After installing or invoking the Firebase CLI, connect this folder to the Firebase project and deploy only the rules:

```powershell
npx firebase-tools login
npx firebase-tools use --add
npx firebase-tools deploy --only firestore:rules
```

The rules allow users to read and edit only their own permitted profile fields. Browser clients cannot change `emailVerified`, `studentVerified`, `verificationStatus`, `uid`, `email`, or `createdAt`.

## 7. Start CampusGig

Restart the development server after changing environment variables:

```powershell
npm run dev
```

Then test this order:

1. Create an account at `/signup`.
2. Confirm Firebase Authentication contains the new user.
3. Confirm the app redirects to `/verify-email` and the Resend code arrives.
4. Enter the code and confirm Firebase Authentication marks the email verified.
5. Save the onboarding profile and confirm the app redirects to `/gigs`.
6. Log out, log in again, and confirm the persistent session/profile returns.
7. Sign in with an email listed in `ADMIN_EMAILS`, open `/admin`, and confirm the registered account appears.
8. Open `/profile` while logged out and confirm it redirects to `/login`.

When deploying to Vercel later, add the browser and server variables in **Project settings → Environment Variables**. Use a server environment variable for the service-account JSON rather than relying on a local file path. Never add Firebase Admin service-account credentials to browser code.
