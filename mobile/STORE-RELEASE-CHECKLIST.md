# SEC Pick’em — Google Play / App Store release preparation

**Status: NOT SUBMITTED.** The public GitHub Pages site is a PWA. This branch adds
a Capacitor 8 preparation path; it does NOT claim app-store approval, release,
developer-account access, or a signed Android App Bundle / iOS IPA.

## Development builds

1. Use Node.js 22+, install `npm install`, run `npm run mobile:prepare`
   and `npm run mobile:check`.
2. **Before** `cap add`, obtain approval for the permanent application identifier
   and store name. The default `com.example.secpickem` is for local testing ONLY.
   Set `SEC_MOBILE_APP_ID` and `SEC_MOBILE_APP_NAME` in the local build
   environment (never commit signing credentials).
3. Android: `npm run mobile:add:android`, open in Android Studio, check
   **target API 36+**, install and test on actual phones.
4. iOS: on **macOS with Xcode 26+**, `npm run mobile:add:ios`,
   open in Xcode, configure an Apple Team, sign, test on iPhone and iPad.
5. Later code changes: `npm run mobile:sync`, then rebuild in Android Studio
   and Xcode. Native builds are separate from auto-updating GitHub Pages.
6. For any release attempt, pass `SEC_RELEASE_CHECK=1` with confirmed
   `SEC_MOBILE_APP_ID`, `SEC_MOBILE_APP_NAME`, `SEC_PRIVACY_POLICY_URL`
   and `SEC_ACCOUNT_DELETION_URL` while running `npm run mobile:check`.
   These are **preflight checks**, not permission to bypass store review.

## Store readiness blockers to resolve BEFORE shipping

- [ ] **Developer accounts:** Google Play Console; Apple Developer Program and
      App Store Connect team, legal seller information, fees and verification.
- [ ] **App identity:** unique, non-misleading title and icon; permanent Android
      package ID and iOS bundle ID; ensure no trademark or affiliation confusion.
      This is an independent fan-made product, **not the SEC or NCAA**.
- [ ] **Privacy policy:** genuine, public HTTPS policy detailing Supabase login,
      user emails, display names, saved picks, league chats, retention, third-party
      score/news sources, and developer contact. Do not publish boilerplate
      claiming data is not collected.
- [ ] **Account deletion:** app has sign-up, but there is currently no verified
      in-app deletion implementation or public external deletion request URL.
      Google Play requires both a discoverable in-app deletion path and a web
      request path; Apple requires in-app account deletion for account-based apps.
      Implement and test secure per-user deletion with appropriate database
      authorization; don't casually drop leagues or other users' picks.
- [ ] **Native user experience:** test navigation, keyboard, safe areas, app
      resuming, login persistence, backgrounding, notifications (if offered),
      external article links, accessibility, offline states, and 3D trophies on
      both Android and iPhone. Apple's 4.2 guideline may reject a simple web wrapper.
- [ ] **App safety & listing:** truthful privacy/Data safety declarations,
      age/content rating, support URL, genuine screenshots from devices, app
      icon, marketing description, independent-fan disclaimer, and review notes.
      This is free sports picking; **do not add gambling or paid wagering flows**
      without a separate legal/platform assessment.
- [ ] **Build/sign/upload:** Android release-signed AAB via Play App Signing;
      iOS archive/signing via Xcode and TestFlight/App Store Connect.
      Keep private signing keys and credentials outside GitHub.
- [ ] **Testing:** Google Play's 12 opted-in testers / 14 days requirement applies
      to qualifying recently created *personal* developer accounts. TestFlight
      and Apple review remain separate steps.

## Data/update architecture

Capacitor bundles the *existing* site in `mobile-dist` and uses the same
production Supabase project; accounts and saved leagues are NOT reset. Dynamic
public `*.json` feed files are fetched first from the trusted GitHub Pages site
and fall back to packaged copies without executing remote JavaScript. Native code
and UI changes require a signed store update. The PWA service worker is disabled
inside the native container to avoid double caching.

This first scaffold does NOT itself generate production-ready APK/AAB/IPA files.
Do not submit until developer account access, permanent IDs, signing, policy
requirements, native device testing, and review materials are complete.
