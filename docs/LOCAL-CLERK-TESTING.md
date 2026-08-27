# Local Clerk login testing

Clerk production keys cannot be used at `http://localhost:3000`. They are restricted to the configured production domain, so Clerk will not mount the login widget and the page can appear blank.

For local testing:

1. In the Clerk Dashboard, select the development instance and copy its `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` beginning with `pk_test_`.
2. Put that development key in `C:\Users\HP\Desktop\dashboard-revamp\.env.local`.
3. Use local routes:

   ```env
   NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
   NEXT_PUBLIC_CLERK_SIGN_UP_URL=/register
   ```

4. Stop and restart the Next.js server; environment changes are not hot-reloaded.
5. Open `http://localhost:3000/login` in a fresh/private window.

The dashboard’s production key should only be used on the configured Worldstreet production domain. Never commit either key or any Clerk secret.
