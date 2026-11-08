patch-social-notif-settings  (SOCIAL_TODO B8: Notification settings)   rules: ACCOUNT_RULES.md 3.20, PROVISIONAL

What it does:
 - Settings now links to a new page /settings/notifications: one checkbox for each kind: follow, like, repost/quote, reply, mention.
   Everything is ON until you switch it off. "Save settings" saves the whole list.
 - A switched-off kind is hidden on /notifications and not counted by the bell. Nothing is deleted: switch it on again and those
   notifications come back.
 - NO EMAIL switch on purpose: the site does not send emails for notifications, so it would do nothing (the page says that).
 - "Download my data" has notificationsOff. Final erasure deletes the settings. Limits: 20/min, 200/day (server memory).
 - DATABASE CHANGE: 1 new table (NotificationOptOut). The migration is in the zip.

1. Back up the project and web/dev.db.
2. In the project folder (where PROJECT.md is):   unzip -o patch-social-notif-settings.zip
3. In web/:   npx prisma migrate dev        <-- do NOT add --name (the migration is in the zip)
              npx prisma generate
   (If it asks to reset the database or says there is drift, stop and do not answer yes.)
4. In web/:   npm run test:notification-settings   npm run test:purge-social   npm run test:export-social   npm run check:i18n   npm run lint   npm run build
5. Manual test (accounts A and B):
   a. As A open Settings: a new "Notifications" link. Open it: 5 checkboxes, all ticked.
   b. As B like A's post and follow A: A's bell shows 2 and /notifications lists both.
   c. As A untick "Someone likes your post", Save ("Saved."). Reload /notifications: the like is gone, the follow stays; the bell shows 1.
   d. As B unlike and like again: A gets nothing new in the list (the like kind is off).
   e. As A tick it again and Save: the like notifications are back.
   f. Untick everything, Save: /notifications is empty, bell 0. Tick all again: they return.
   g. Open /settings/notifications logged out: you are sent to /login.
   h. "Download my data" (Settings) contains "notificationsOff" (the kinds you switched off).
