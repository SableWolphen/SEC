# SEC advanced play and push (2026)

Quick Pick, Matchup Intelligence, league pick trends, verified championship gap scenarios, current-season football career, PNG victory cards, rivalry picks, recaps and member-to-member challenges live in the advanced play layer.

Privacy: never reveal another person's pre-kickoff pick. League pick trends call the secure post-kickoff RPC only after the published kickoff. Career and shared results use only verified final outcomes. Private friend challenges require two authenticated members of the same football league and do not award extra league points.

Web Push: private subscriptions live in sec_push_subscriptions. Only subscribed user's favorite school games trigger kickoff or official final notifications. The Edge Function authenticates the existing score-job token against Supabase Vault, deduplicates notifications server-side, and uses a Vault-held VAPID private key. The public VAPID key must match both SEC_PUSH_CONFIG.publicKey in the browser and SEC_PUSH_PUBLIC_KEY in Edge secrets. Do not commit private VAPID keys. The sender is deployed but is not yet enabled: the private VAPID key and matching public key must be configured securely first. The 10-minute cron has been paused until credentials are available; do not claim background push delivery is active. Unsubscribing deletes the current user's endpoint. Device push needs browser permission.

Existing backend scores, pick locks, league membership and trophy awards remain authoritative.
