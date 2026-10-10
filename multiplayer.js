/* Saturdays Down South — hosted multiplayer client.
   Keep service-role credentials OUT of this file. Configure ./config.js with a PUBLIC publishable key only. */
(function () {
  "use strict";
  var app = window.SEC_BRIDGE;
  var cfg = window.SEC_ONLINE_CONFIG || {};
  var enabled = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(cfg.url || "") &&
                /^(sb_publishable_|eyJ)/.test(cfg.publishableKey || "");
  var client = enabled && window.supabase ? window.supabase.createClient(cfg.url, cfg.publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  }) : null;
  var user = null, leagues = [], active = null, standings = [], profile = null, standingsError = '';
  var working = false, lastError = "", loginEmail = "";
  var authMode = "login", draftEmail = "", recoveryMode = false;
  // A single Supabase auth session is shared across football, basketball and baseball.
  // Sport pages must not interpret the initial session restore as signed-out.
  var authReadyResolve;
  var authReady = new Promise(function(resolve){authReadyResolve=resolve;});
  var authRestored = !client, previousAuthUserId;
  var refreshVersion=0,standingsVersion=0;
  if(authRestored)authReadyResolve();
  function publishAccount(){
    if(!authRestored){authRestored=true;authReadyResolve();}
    var nextUserId=user?.id||null;
    if(previousAuthUserId!==nextUserId){
      previousAuthUserId=nextUserId;
      window.SEC_SPORTS?.authChanged?.();
      void window.SEC_FAN?.onView?.(app.view());
    }
  }
  var inviteCode = new URLSearchParams(location.search).get("league");
  if (inviteCode && !/^[A-Z0-9]{10}$/i.test(inviteCode)) inviteCode = null;
  var safe = function(s){return app.esc(String(s == null ? "" : s));};
  // Treat pasted email addresses consistently, including Android's invisible copy/paste chars.
  var cleanEmail = function(value){
    return String(value == null ? "" : value).normalize("NFKC").replace(/[\u200B-\u200D\uFEFF]/g,"").trim();
  };
  var validEmail = function(email){
    if(!email || email.length>254 || email.length<5)return false;
    var at=email.indexOf("@");
    if(at<1 || at!==email.lastIndexOf("@"))return false;
    var local=email.slice(0,at), domain=email.slice(at+1);
    if(!local || !domain || !domain.includes(".") || domain[0]==="." || domain.endsWith("."))return false;
    if(local[0]==="." || local.endsWith(".") || email.includes(".."))return false;
    for(var i=0;i<email.length;i++){
      var code=email.charCodeAt(i);
      if(code<=32 || code===127 || code===160)return false;
    }
    return true;
  };
  var status = function(message){lastError = message || ""; var el = document.getElementById("online-status"); if(el) el.textContent=lastError;};
  var button = function(label,action,extra){return '<button type="button" class="'+(extra||"ghost-btn")+'" data-online="'+action+'">'+label+'</button>';};
  var card = function(title,content){return '<div class="content-card"><div class="card-kicker">ONLINE PICK’EM</div><h2>'+title+'</h2>'+content+'</div>';};
  var busy = function(err){working=false; if(err){console.warn("SEC online operation:",err);var message=err.message||"Something went wrong. Try again.";if(/email address not authorized/i.test(message))message="Email sign-in is not enabled for outside friends yet. Ask the league owner to configure an email provider.";status(message);app.toast(message);}else status("");};
  var extract = function(obj){if(obj.error)throw obj.error;return obj.data;};
  var currentLeague = function(){return leagues.find(function(l){return l.id===active;});};
  var urlForInvite = function(code){var u=new URL(location.href);u.searchParams.set("league",code);u.hash="league";return u.toString();};
  function renderLeague(){
    var host=document.getElementById("league-content");
    if (!host) return;
    if (!client){
      host.innerHTML = '<div class="secondary-grid">'+
        card('Bring your friends online.','<p>This website can host shared leagues, accounts, invite links and real standings. The website owner must finish the separate Supabase setup before online play is available.</p><div class="help-note">The local-only pick’em preview is still available on this device. It does not synchronize between players.</div>')+
        card('What happens next?','<p>The multiplayer database and security rules are in the GitHub repository under <code>supabase/setup.sql</code>. See the README for instructions to activate it.</p>')+'</div>';
      return;
    }
    if(recoveryMode){
      host.innerHTML=card('Set your new password',
        '<p>Create a new password for your Saturdays Down South account.</p>'+
        '<label class="input-label" for="online-password">New password</label>'+
        '<input class="field" id="online-password" type="password" autocomplete="new-password" minlength="8" maxlength="72" placeholder="At least 8 characters">'+
        '<label class="input-label" for="online-password-confirm">Confirm new password</label>'+
        '<input class="field" id="online-password-confirm" type="password" autocomplete="new-password" minlength="8" maxlength="72">'+
        '<div class="auth-actions">'+button('Save new password','change-password','primary-btn')+'</div>'+
        '<p id="online-status" class="helper auth-status" role="status" aria-live="polite">'+safe(lastError)+'</p>');
      return;
    }
    if (!user){
      var registering=authMode==="signup";
      var panel='<div class="auth-tabs" role="group" aria-label="Account actions">'+
        '<button type="button" data-online="mode-signup" class="auth-tab '+(registering?'active':'')+'" aria-pressed="'+registering+'">Create account</button>'+
        '<button type="button" data-online="mode-login" class="auth-tab '+(!registering?'active':'')+'" aria-pressed="'+(!registering)+'">Log in</button></div>'+
        '<p>Use an email and password to save your picks and compete with friends across devices.</p>'+
        (inviteCode?'<div class="help-note">🏈 You have a league invite: <strong>'+safe(inviteCode)+'</strong>. Sign in or create an account to join.</div>':'')+
        (registering?'<label class="input-label" for="online-signup-name">Display name</label>'+
          '<input class="field" id="online-signup-name" type="text" autocomplete="nickname" maxlength="32" placeholder="Your pick’em name" required>':'')+
        '<label class="input-label" for="online-email">Email address</label>'+
        '<input class="field" id="online-email" type="email" autocomplete="email" maxlength="254" value="'+safe(draftEmail)+'" placeholder="you@example.com" required>'+
        '<label class="input-label" for="online-password">Password</label>'+
        '<input class="field" id="online-password" type="password" autocomplete="'+(registering?'new-password':'current-password')+'" minlength="8" maxlength="72" placeholder="At least 8 characters" required>'+
        (registering?'<label class="input-label" for="online-password-confirm">Confirm password</label>'+
          '<input class="field" id="online-password-confirm" type="password" autocomplete="new-password" minlength="8" maxlength="72" placeholder="Type it again" required>':'')+
        '<div class="auth-actions">'+button(registering?'Create my account':'Log in',registering?'register':'login','primary-btn')+'</div>'+
        (!registering?'<div class="auth-recovery">'+button('Forgot password?','reset-password','link-like')+'</div>':'')+
        '<p id="online-status" class="helper auth-status" role="status" aria-live="polite">'+safe(lastError)+'</p>'+
        '<p class="helper">After signing in, choose <strong>Create league</strong> to invite your friends. Email verification may be required by your league’s account settings.</p><p class="helper" style="opacity:.7;margin-top:10px">Account screen · version 2026.10.09.2</p>';
      host.innerHTML='<div class="secondary-grid">'+card(registering?'Join the pick’em club.':'Welcome back.',panel)+
        card('Compete with friends','<p><strong>1.</strong> Create a free player account.<br><strong>2.</strong> Make a private league and share your invitation.<br><strong>3.</strong> Pick winners before kickoff.<br><strong>4.</strong> Follow the weekly and season leaderboard.</p><div class="help-note">All SEC games count, including nonconference matchups. One correct pick earns one point.</div>')+'</div>';
      return;
    }
    var toolsOpen=Boolean(host.querySelector?.(".fan-football-tools")?.open);
    var choice = currentLeague();
    var list = leagues.map(function(l){return '<option value="'+safe(l.id)+'" '+(active===l.id?'selected':'')+'>'+safe(l.name)+'</option>';}).join('');
    var nameForm=card('Your player profile',
       '<p>Signed in as <strong>'+safe(user.email||"Member")+'</strong></p>'+
       '<label class="input-label" for="online-name">Leaderboard display name</label>'+
       '<input class="field" id="online-name" maxlength="32" autocomplete="nickname" value="'+safe(profile?.display_name||user.user_metadata?.display_name||"")+'" placeholder="Your name">'+
       '<div style="margin-top:12px">'+button('Save name','save-name','primary-btn')+' '+button('Choose favorite school','go-teams')+' '+button('Sign out','logout')+'</div>');
    var leaguesForm=card('Create or join a league',
       '<label class="input-label" for="online-new-league">Make a new league</label>'+
       '<input class="field" id="online-new-league" maxlength="50" placeholder="Saturday Crew">'+
       (window.SEC_FEATURES?.control?.()||'')+
       '<div style="margin-top:10px">'+button('Create league','create-league','primary-btn')+'</div>'+
       '<div class="divider"></div><label class="input-label" for="online-invite">Have an invite code?</label>'+
       '<input class="field" id="online-invite" maxlength="10" value="'+safe(inviteCode||"")+'" placeholder="10-character code" autocapitalize="characters">'+
       '<div style="margin-top:10px">'+button('Join league','join-league')+'</div>'+
       (leagues.length?'<label class="input-label" for="online-league-select">Your leagues</label><select class="field" id="online-league-select">'+list+'</select>':''));
    var standingsHtml = "";
    if(choice){
      var w=app.week();
      standingsHtml = '<div class="league-hero"><div><div class="label">LIVE ONLINE LEAGUE · '+safe(window.SEC_FEATURES?.MODES?.[choice.mode]?.name||'Straight Picks')+'</div><h2>'+safe(choice.name)+'</h2><p>'+(standingsError?'Standings unavailable':standings.length+' players')+' · Week '+w.num+'</p></div></div>'+
       card('League scoreboard',
        '<p>Scores update as confirmed results are posted. Everyone in this league shares these standings.</p>'+
        '<div class="sec-scoreboard-current-league">🔒 Private league standings and chat</div>'+
        (standingsError?'<div class="help-note" role="alert">Scoreboard could not load: '+safe(standingsError)+'. Try Refresh standings.</div>':'')+
        '<div class="chip-line">'+button('Make my picks','go-picks','primary-btn')+' '+button('Share invite link','copy-invite')+' '+button('Refresh standings','refresh')+'</div>'+
        '<div style="margin:14px 0"><label for="league-week" class="input-label">Week</label><select class="field" id="league-week">'+app.weeks.map(function(x){return '<option value="'+x.num+'" '+(x.num===w.num?'selected':'')+'>Week '+x.num+'</option>';}).join('')+'</select></div>'+
        '<div class="leaderboard"><div class="standing-row head" style="grid-template-columns:26px minmax(0,1fr) 48px 52px 58px"><span>#</span><span>PLAYER</span><span>PICKS</span><span>WEEK</span><span>SEASON</span></div>'+
        (standings.length?standings.map(function(row,i){return '<div class="standing-row" style="grid-template-columns:26px minmax(0,1fr) 48px 52px 58px"><span class="rank">'+(i+1)+'</span><span class="name" data-player-id="'+safe(row.user_id)+'"><span class="sec-avatar" aria-hidden="true">'+safe((row.display_name||'P').slice(0,1).toUpperCase())+'</span>'+safe(row.display_name)+(window.SEC_PRIDE?.badge?.(row.user_id)||'')+(row.user_id===user.id?' ★':'')+'</span><span class="muted">'+safe(row.picked)+'</span><span class="score">'+safe(row.week_points)+'</span><span>'+safe(row.season_points)+'</span></div>';}).join(''):'<p class="helper" style="padding:15px">No standings available yet.</p>')+
        '</div><p class="helper">Picks are stored securely online. Only league members can see this scoreboard.</p>'+
        '<div class="sec-scoreboard-chat" aria-label="Chat for '+safe(choice.name)+'">'+
        (window.SEC_SOCIAL?.render?.()||'<p class="helper">Loading private league chat…</p>')+'</div>');
    } else standingsHtml=card('Start the competition','<p>Create a league or join one with an invitation code. Invite your friends by sending the link.</p>');
    // The selected league and its chat should be the main content. Rarely
    // edited commissioner rules and profile fields sit beneath one disclosure.
    var secondary=choice?
      '<details class="fan-fold fan-football-tools" '+(toolsOpen?'open ':'')+
       '><summary>⚙ Football account settings <span>Profile and other leagues</span></summary>'+
       nameForm+'</details>':nameForm;
    host.innerHTML='<div class="fan-football-scoreboard">'+
      (choice?standingsHtml+'<details class="fan-fold fan-football-management"><summary>⚙ Football rules &amp; commissioner tools</summary>'+
         (window.SEC_FEATURES?.leagueDetails?.()||'')+'</details>':
         (window.SEC_LEAGUE_SETTINGS?standingsHtml:leaguesForm+standingsHtml))+
      '</div><div class="fan-football-advanced">'+secondary+'</div>'+
      '<p id="online-status" class="helper" role="status" aria-live="polite">'+safe(lastError)+'</p>';
  }
  function renderSettings(){
    var host=document.getElementById("settings-content");
    if(!host)return;
    host.innerHTML = '<div class="secondary-grid"><div class="setting-stack">'+
      card('Your online account',user?
        '<p>Signed in as <strong>'+safe(user.email||"Member")+'</strong>. Picks are synchronized with your account.</p>'+
        button('Edit name and leagues','go-league','primary-btn')+' '+button('Sign out','logout')
        :'<p>Sign in to save picks to the league scoreboard across devices.</p>'+button('Sign in','go-league','primary-btn'))+
      card('Install on your phone','<p>Open the website from Chrome on Android, choose the browser menu, then select <strong>Add to Home screen</strong>.</p>')+
      '</div><div class="setting-stack">'+card('Rules and privacy',
      '<p>Only authenticated players can save online picks. Kickoff deadlines are validated by the database, not just your phone clock. Each player can edit only their own picks.</p>'+
      '<p>League names and standings are visible to members. Game winners are updated by the site administrator, not by players.</p>'+
      '<div class="help-note">Times marked provisional may be updated when officially announced.</div>')+'</div></div>';
  }
  async function refresh(options){
    if(!client)return;
    var version=++refreshVersion;
    try{
      var session=extract(await client.auth.getSession()).session;
      if(version!==refreshVersion)return;
      user=session?.user||null;
      publishAccount();
      var s=app.state();
      if(!user){
        leagues=[];active=null;profile=null;standings=[];standingsError='';
        app.state().picks={};app.state().results={};
        window.SDSTrophyCase?.sync({authenticated:false,schedule:app.gameById});
        window.SEC_SOCIAL?.connect?.(client,null,null,[]);
        if(window.SEC_FEATURES?.reload)await window.SEC_FEATURES.reload(client,null,null,app);
        if(version!==refreshVersion)return;
        try{
          var publicGames=extract(await client.from("sec_games").select("id,kickoff_at,winner,provisional,game_status,status_detail,away_score,home_score,spread_home,spread_source,score_updated_at"))||[];
          if(version!==refreshVersion)return;
          window.SEC_FEATURES?.updateGames?.(publicGames,app);
          publicGames.forEach(function(g){var local=app.gameById[g.id];if(local){
            if(g.kickoff_at)local.kickoff=g.kickoff_at;
            local.onlineProvisional=g.provisional;
            if(g.winner)app.state().results[g.id]=g.winner;
          }});
        }catch(publicErr){console.warn("Public game scoreboard unavailable",publicErr);}
        show();return;
      }
      var results=await Promise.all([
        client.from("sec_profiles").select("user_id,display_name,favorite_school_code").eq("user_id",user.id).maybeSingle(),
        client.from("sec_leagues").select("id,name,invite_code,owner_id,mode").order("created_at",{ascending:true}),
        client.from("sec_picks").select("game_id,pick_code").eq("user_id",user.id),
        client.from("sec_games").select("id,kickoff_at,winner,provisional,game_status,status_detail,away_score,home_score,spread_home,spread_source,score_updated_at")
      ]);
      if(version!==refreshVersion||user?.id!==session?.user?.id)return;
      results.forEach(extract);
      profile=results[0].data;
      // The sign-up display name is untrusted cosmetic metadata, never used for access control.
      if(!profile){
        var display=String(user.user_metadata?.display_name||"").trim();
        if(display.length>=2&&display.length<=32){
          try{
            extract(await client.from("sec_profiles").upsert({user_id:user.id,display_name:display},{onConflict:"user_id"}));
            if(version!==refreshVersion||user?.id!==session?.user?.id)return;
            profile={user_id:user.id,display_name:display};
          }catch(profileErr){console.warn("SEC display name sync:",profileErr);}
        }
      }
      window.SEC_PRIDE?.setProfile?.(profile);
      if(profile?.display_name)s.name=profile.display_name;
      leagues=results[1].data||[];
      window.SEC_FEATURES?.updateGames?.(results[3].data||[],app);
      s.picks=Object.fromEntries((results[2].data||[]).filter(function(p){return app.gameById[p.game_id];}).map(function(p){return [p.game_id,p.pick_code];}));
      s.results={};
      (results[3].data||[]).forEach(function(g){
        var local=app.gameById[g.id];if(local){if(g.kickoff_at)local.kickoff=g.kickoff_at;local.onlineProvisional=g.provisional;if(g.winner)s.results[g.id]=g.winner;}
      });
      var stored=localStorage.getItem("ss-sec-league");
      active=leagues.some(function(l){return l.id===stored;})?stored:(leagues[0]?.id||null);
      if(inviteCode && !leagues.some(function(l){return l.invite_code===inviteCode.toUpperCase();})){
        // Explicitly joining an invite URL is equivalent to redeeming the invite.
        try{
          var id=extract(await client.rpc("sec_join_league",{p_code:inviteCode}));
          if(version!==refreshVersion||user?.id!==session?.user?.id)return;
          var joined=extract(await client.from("sec_leagues").select("id,name,invite_code,owner_id,mode").order("created_at",{ascending:true}))||[];
          if(version!==refreshVersion||user?.id!==session?.user?.id)return;
          inviteCode=null;leagues=joined;active=id;
          history.replaceState(null,"",location.pathname+"#league");
        }
        catch(err){status(err.message);inviteCode=null;}
      }
      if(active)localStorage.setItem("ss-sec-league",active);
      if(window.SEC_FEATURES?.reload)await window.SEC_FEATURES.reload(client,currentLeague(),user,app);
      if(version!==refreshVersion||user?.id!==session?.user?.id)return;
      window.SDSTrophyCase?.sync({
        games:results[3].data||[],picks:app.state().picks,schedule:app.gameById,
        leagueId:currentLeague()?.id||null,leagueName:currentLeague()?.name||"",
        authenticated:!!user,userId:user.id
      });
      if(currentLeague()&&window.SDSTrophyCase?.setPermanentResults){
        try{
          var historyRows=extract(await client.rpc("sec_sync_trophy_history",{p_league:active}))||[];
          if(version!==refreshVersion||user?.id!==session?.user?.id)return;
          window.SDSTrophyCase.setPermanentResults(historyRows);
        }catch(trophyErr){console.warn("Saved trophy history unavailable",trophyErr);}
      }
      await refreshStandings(false);
      if(version!==refreshVersion||user?.id!==session?.user?.id)return;
      window.SEC_SOCIAL?.connect?.(client,currentLeague(),user,standings);
      window.SEC_FEATURES?.remind?.();
      show();
    }catch(err){
      if(version!==refreshVersion)return;
      // A failed session lookup must not leave the other sports stuck on "Restoring account".
      if(!authRestored){authRestored=true;authReadyResolve();}
      busy(err);show();
    }
  }
  async function refreshStandings(shouldShow){
    var version=++standingsVersion,expectedUser=user?.id,expectedLeague=active;
    if(!client||!user||!active){standings=[];return;}
    try{
      var received=extract(await client.rpc("sec_league_standings_v3",{p_league:expectedLeague,p_week:app.week().num}))||[];
      if(version!==standingsVersion||user?.id!==expectedUser||active!==expectedLeague)return;
      standings=received;
      window.SEC_FEATURES?.setStandings?.(standings);
      window.SEC_SOCIAL?.setStandings?.(standings);
      if(shouldShow&&window.SEC_FEATURES?.reload)await window.SEC_FEATURES.reload(client,currentLeague(),user,app);
      standingsError='';if(shouldShow)show();
    }
    catch(err){
      if(version!==standingsVersion||user?.id!==expectedUser||active!==expectedLeague)return;
      standings=[];standingsError=err.message||'Server error';busy(err);if(shouldShow)show();
    }
  }
  function show(){
    if(app.view()==="picks")app.renderPicks();
    if(app.view()==="league")renderLeague();
    if(app.view()==="settings")renderSettings();
    var el=document.getElementById("online-banner");
    if(el)el.innerHTML=user?'<span class="eyebrow-dot"></span> ONLINE · '+safe(user.email||"Signed in")+' · '+safe(currentLeague()?.name||"Create or join a league"):
      '<button type="button" class="online-signin-cta" data-online="go-league">👤 Create account or log in · Make a league with friends ↗</button>';
  }
  async function choose(g,id){
    if(!client){app.toast("Online play is not configured yet.");app.setView("league");return;}
    if(!user){app.toast("Sign in to save league picks.");app.setView("league");return;}
    if(working)return;
    working=true;
    try{
      if(window.SEC_FEATURES?.save){
        await window.SEC_FEATURES.save(g,id,client,currentLeague(),user,app);
      }else{
        extract(await client.from("sec_picks").upsert({user_id:user.id,game_id:g.id,pick_code:id},{onConflict:"user_id,game_id"}));
        app.state().picks[g.id]=id;app.renderPicks();
      }
      app.toast("Pick saved online!");
    }catch(err){busy(err);return;}working=false;
  }
  async function act(action){
    if(working)return;
    if(action==="mode-signup"||action==="mode-login"){
      authMode=action==="mode-signup"?"signup":"login";
      status("");renderLeague();return;
    }
    if(action==="go-league"){app.setView("league");return;}
    if(action==="go-teams"){app.setView("teams");return;}
    if(action==="go-picks"){app.setView("picks");return;}
    if(action==="copy-invite"){return copyInvite();}
    if(action==="refresh"){await refresh();return;}
    if(action==="logout"){await client.auth.signOut();location.reload();return;}
    working=true;status("");
    try{
      if(action==="change-password"){
        if(!recoveryMode)throw Error("Open the password reset link before changing your password.");
        var password=document.getElementById("online-password")?.value||"";
        var repeated=document.getElementById("online-password-confirm")?.value||"";
        if(password.length<8)throw Error("Use a password of at least 8 characters.");
        if(password!==repeated)throw Error("Passwords don't match.");
        extract(await client.auth.updateUser({password:password}));
        recoveryMode=false;
        lastError="";
        await refresh();
        app.toast("Password updated. You're now signed in.");
      }else if(action==="register"||action==="login"){
        var email=cleanEmail(document.getElementById("online-email")?.value);
        var password=document.getElementById("online-password")?.value||"";
        draftEmail=email;
        if(!email)throw Error("Please enter an email address to continue.");
        if(password.length<8)throw Error("Use a password of at least 8 characters.");
        if(action==="register"){
          var name=document.getElementById("online-signup-name")?.value.trim()||"";
          var confirmed=document.getElementById("online-password-confirm")?.value||"";
          if(name.length<2||name.length>32)throw Error("Your display name must be 2–32 characters.");
          if(password!==confirmed)throw Error("Passwords don't match.");
          var data=extract(await client.auth.signUp({
            email:email,password:password,options:{
              emailRedirectTo:location.origin+location.pathname+location.search+"#league",
              data:{display_name:name}
            }
          }));
          if(data.session?.user){
            user=data.session.user;
            extract(await client.from("sec_profiles").upsert({user_id:user.id,display_name:name},{onConflict:"user_id"}));
            profile={user_id:user.id,display_name:name};
            app.state().name=name;
            await refresh();
            app.toast("Account created! Create a league to invite friends.");
          }else{
            // Supabase may require email confirmation. Never imply a session exists without one.
            authMode="login";
            lastError="If your account was created, check your email to confirm it, then log in here. If no email arrives, the site owner must enable confirmation email delivery.";
            renderLeague();
          }
        }else{
          var signedIn=extract(await client.auth.signInWithPassword({email:email,password:password}));
          if(!signedIn.session?.user)throw Error("Could not start a sign-in session. Check whether your email must be confirmed.");
          user=signedIn.session.user;
          await refresh();
          app.toast("Welcome back! You can create or join a league.");
        }
      }else if(action==="reset-password"){
        var email=cleanEmail(document.getElementById("online-email")?.value);
        if(!email)throw Error("Enter your email above to reset your password.");
        extract(await client.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname+"#league"}));
        status("If that account exists, a password reset email has been requested. Follow the link in your inbox.");
      }else if(action==="send-link"){
        var email=cleanEmail(document.getElementById("online-email")?.value);
        if(!email)throw Error("Enter your email address.");
        loginEmail=email;
        extract(await client.auth.signInWithOtp({email:email,options:{emailRedirectTo:location.origin+location.pathname+location.search+"#league"}}));
        app.toast("Check your email for your sign-in link.");
        status("Check "+email+" for a sign-in link. Return to this website after signing in.");
      }else if(action==="save-name"){
        if(!user)throw Error("Sign in first.");
        var name=document.getElementById("online-name")?.value.trim();
        if(!name||name.length<2||name.length>32)throw Error("Name must be 2–32 characters.");
        extract(await client.from("sec_profiles").upsert({user_id:user.id,display_name:name},{onConflict:"user_id"}));
        profile={user_id:user.id,display_name:name};app.state().name=name;app.toast("Player name updated.");
        await refreshStandings(false);
      }else if(action==="create-league"){
        if(!user)throw Error("Sign in first.");
        var n=document.getElementById("online-new-league")?.value.trim();
        if(!n||n.length<2||n.length>50)throw Error("League name must be 2–50 characters.");
        var leagueMode=document.getElementById("online-league-mode")?.value||"straight";
        var row=extract(await client.rpc("sec_create_league_mode",{p_name:n,p_mode:leagueMode}));
        active=row[0].league_id;localStorage.setItem("ss-sec-league",active);await refresh();
        app.toast("League created! Copy your invite link.");
      }else if(action==="join-league"){
        if(!user)throw Error("Sign in first.");
        var code=document.getElementById("online-invite")?.value.trim().toUpperCase();
        if(!/^[A-Z0-9]{10}$/.test(code||""))throw Error("Enter a valid 10-character invite code.");
        active=extract(await client.rpc("sec_join_league",{p_code:code}));localStorage.setItem("ss-sec-league",active);inviteCode=null;await refresh();
        app.toast("You joined the league!");
      }
      if(action==="save-name")renderLeague();
    }catch(err){busy(err);return;}
    working=false;
  }
  async function copyInvite(){
    var l=currentLeague();if(!l){app.toast("Create or join a league first.");app.setView("league");return;}
    var share=urlForInvite(l.invite_code);
    try{
      if(navigator.share){await navigator.share({title:"Join "+l.name+" on Saturdays Down South",text:"Join my SEC Pick'em league!",url:share});app.toast("League invite ready to share!");return;}
      await navigator.clipboard.writeText(share);app.toast("Invitation link copied!");
    }catch(err){
      if(err.name==="AbortError")return;
      try{await navigator.clipboard.writeText(share);app.toast("Invitation link copied!");}
      catch(copyErr){window.prompt("Copy the invitation link:",share);}
    }
  }
  function useLeague(id){
    if(!id||typeof id!=="string")return;
    if(active===id)return;
    localStorage.setItem("ss-sec-league",id);
    active=id;
    ++standingsVersion;
    standings=[];standingsError="";
    void refresh();
  }
  window.secOnline={
    configured:!!client,renderLeague:renderLeague,renderSettings:renderSettings,
    pick:choose,copyInvite:copyInvite,useLeague:useLeague,refreshStandings:refreshStandings,refresh:refresh,
    isSignedIn:function(){return !!user;},getClient:function(){return client;},getUser:function(){return user;},getLeague:function(){return currentLeague();},getStandings:function(){return standings.slice();},
    whenAuthReady:function(){return authReady;},isAuthReady:function(){return authRestored;}
  };
  document.addEventListener("click",function(ev){
    var el=ev.target.closest("[data-online]");
    if(!el)return;
    ev.preventDefault();ev.stopImmediatePropagation();void act(el.dataset.online);
  },true);
  document.addEventListener("input",function(ev){
    if(ev.target.id==="online-email")draftEmail=cleanEmail(ev.target.value);
  });
  document.addEventListener("keydown",function(ev){
    var id=ev.target&&ev.target.id;
    if(ev.key==="Enter"&&["online-email","online-password","online-password-confirm","online-signup-name"].includes(id)){
      ev.preventDefault();
      var target=document.querySelector('[data-online="'+(authMode==="signup"?"register":"login")+'"]');
      if(target)target.click();
    }
  });
  document.addEventListener("change",function(ev){
    if(["online-league-select","scoreboard-league-select"].includes(ev.target.id)){
      active=ev.target.value;localStorage.setItem("ss-sec-league",active);
      void refresh();
    }else if(ev.target.id==="league-week"&&client&&user){
      // The original app changes its active week in its own event handler.
      setTimeout(function(){void refreshStandings(true);},0);
    }
  });
  if(client){
    client.auth.onAuthStateChange(function(event){
      if(event==="PASSWORD_RECOVERY"){
        recoveryMode=true;
        setTimeout(function(){app.setView("league");renderLeague();},0);
      }else if(event==="SIGNED_IN"||event==="SIGNED_OUT"){
        if(event==="SIGNED_OUT"){
          ++refreshVersion;++standingsVersion;
          user=null;leagues=[];active=null;profile=null;standings=[];
          app.state().picks={};app.state().results={};
          publishAccount();show();
        }
        setTimeout(function(){void refresh();},0);
      }
    });
    void refresh();
    setInterval(function(){
      var editing=Boolean(document.activeElement?.matches?.("input,textarea,select"));
      if(user&&document.visibilityState==="visible"&&!editing&&!working)void refresh();
    },45000);
  }
  if(document.getElementById("picks-view")){
    var banner=document.createElement("div");
    banner.id="online-banner";banner.className="eyebrow";
    banner.style.margin="0 0 15px";
    document.getElementById("picks-view").insertBefore(banner,document.getElementById("picks-view").children[1]);
    show();
  }
})();
