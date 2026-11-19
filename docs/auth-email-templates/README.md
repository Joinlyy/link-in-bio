# Supabase sign-in email templates (Joinlyy look)

In the Supabase dashboard open **Authentication, then Email Templates**. For each row below, open that template, paste the **subject** and replace the **body** with the file's HTML, then save.
Regenerate with `node scripts/make-auth-emails.mjs`.

| Supabase template | Subject | File |
| --- | --- | --- |
| Confirm sign up | Confirm your Joinlyy account | `confirm-signup.html` |
| Magic link | Your Joinlyy sign-in link | `magic-link.html` |
| Reset password | Reset your Joinlyy password | `reset-password.html` |
| Change email address | Confirm your new email for Joinlyy | `change-email.html` |
| Invite user | You have been invited to Joinlyy | `invite.html` |
| Reauthentication | Your Joinlyy confirmation code | `reauthentication.html` |
