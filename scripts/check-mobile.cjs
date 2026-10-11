/* Offline build sanity — never queries store accounts or mutates player data. */
"use strict";
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const root=path.resolve(__dirname,".."),dir=path.join(root,"mobile-dist");
assert(fs.existsSync(path.join(dir,"index.html")),"Run npm run mobile:prepare first");
const html=fs.readFileSync(path.join(dir,"index.html"),"utf8");
const web=fs.readFileSync(path.join(root,"index.html"),"utf8");
const filenames=["config.js","trophy-museum.js","sec-champion-3d.js","trophy-case.js",
  "sec-trophy-legacy.js","multi-sport.js","multiplayer.js","league-social.js",
  "news.json","sports-schedules.json","manifest.webmanifest","icon.svg","mobile-bridge.js"];
for(const p of filenames)assert(fs.statSync(path.join(dir,p)).isFile(),"Missing mobile asset: "+p);
assert(fs.statSync(path.join(dir,"trophies")).isDirectory(),"Existing 3D rivalry trophies must ship with mobile");
assert(html.includes("./mobile-bridge.js"),"Mobile-only native behavior script must be available");
assert(!web.includes("./mobile-bridge.js"),"Do not change website behavior with mobile-only bridge");
assert(html.includes("!window.Capacitor?.isNativePlatform?.()"),"Disable PWA service worker within native app");
const checks=["picks","league","trophies","news","teams","settings"];
for(const view of checks)assert(html.includes(view),"Missing app screen: "+view);
assert(!html.includes("YOUR_GOOGLE_API_KEY"),"Do not embed store credentials");
if(process.env.SEC_RELEASE_CHECK==="1"){
 const id=process.env.SEC_MOBILE_APP_ID||"";
 assert(/^[a-z][a-z\d]*(?:\.[a-z][a-z\d]*){2,}$/.test(id)&&!id.startsWith("com.example."),
  "Release blocked: approve and set a permanent SEC_MOBILE_APP_ID first.");
 assert(process.env.SEC_MOBILE_APP_NAME?.trim(),"Release blocked: approve store title first.");
 assert(process.env.SEC_PRIVACY_POLICY_URL?.startsWith("https://"),"Release blocked: public privacy policy URL needed.");
 assert(process.env.SEC_ACCOUNT_DELETION_URL?.startsWith("https://"),"Release blocked: public account deletion URL needed.");
}
console.log("Mobile assets verified; store signing and policy gates still require developer review.");
