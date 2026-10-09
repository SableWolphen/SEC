/* Offline smoke test of SEC create-account and private-league onboarding.
   Uses a fake auth API so this test never creates real users or stores credentials. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const handlers={},elements={};
const state={session:null,profile:null,leagues:[],picks:[],requests:[]};
const fields={
  'online-email':{value:'sample.person.middle@gmail.com\u200B '},
  'online-signup-name':{value:'Sally SEC'},
  'online-password':{value:'aStrongTestPass123!'},
  'online-password-confirm':{value:'aStrongTestPass123!'},
  'online-new-league':{value:'Saturday Friends'},
  'online-invite':{value:''},
};
const host={innerHTML:''};
elements['league-content']=host;
const document={
 getElementById(id){return fields[id]||elements[id]||null;},
 addEventListener(type,handler){handlers[type]=handler;},
};
const localCache=new Map();
const localStorage={getItem:k=>localCache.get(k)||null,setItem:(k,v)=>localCache.set(k,String(v))};
function query(table){
 const api={
   eq(){return api;},
   order(){return Promise.resolve({data:table==='sec_leagues'?state.leagues:[]});},
   async maybeSingle(){return {data:state.profile};},
   async upsert(row){
     if(table==='sec_profiles')state.profile=row;
     else if(table==='sec_picks')state.picks.push(row);
     return {data:row};
   },
   then(resolve,reject){
     let data=table==='sec_picks'?state.picks:table==='sec_games'?[]:table==='sec_profiles'?state.profile:state.leagues;
     return Promise.resolve({data}).then(resolve,reject);
   }
 };
 return api;
}
const user={id:'test-player-1',email:'sample.person.middle@gmail.com',user_metadata:{display_name:'Sally SEC'}};
const client={
 auth:{
   async getSession(){return {data:{session:state.session}};},
   onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}};},
   async signUp(credentials){
     state.requests.push({type:'signup',email:credentials.email,passwordLength:credentials.password.length});
     assert.equal(credentials.email,'sample.person.middle@gmail.com');
     state.session={user};
     return {data:{user,session:state.session}};
   },
   async signInWithPassword(credentials){
     state.requests.push({type:'login',email:credentials.email});
     state.session={user};
     return {data:{user,session:state.session}};
   },
   async resetPasswordForEmail(){return {data:{}};},
   async signOut(){state.session=null;return {error:null};}
 },
 from(table){return {select(){return query(table)},upsert(row){return query(table).upsert(row)}};},
 async rpc(name,args){
   if(name==='sec_create_league'){
     state.requests.push({type:'create-league'});
     state.leagues.push({id:'test-league-1',name:args.p_name,invite_code:'123456789A',owner_id:user.id});
     return {data:[{league_id:'test-league-1',code:'123456789A'}]};
   }
   if(name==='sec_league_standings')return {data:[{user_id:user.id,display_name:'Sally SEC',picked:0,week_points:0,season_points:0}]};
   if(name==='sec_join_league')return {data:'test-league-1'};
   throw Error('Unexpected RPC '+name);
 }
};
const env={
 console,Promise,URL,URLSearchParams,localStorage,document,
 window:{
   SEC_BRIDGE:{
     esc:s=>String(s).replaceAll('<','&lt;'),
     weeks:[{num:6}],gameById:{},state:()=>({picks:{},results:{}}),
     week:()=>({num:6}),view:()=> 'league',setView:()=>{},renderPicks:()=>{},
     toast:()=>{}
   },
   SEC_ONLINE_CONFIG:{url:'https://test-project.supabase.co',publishableKey:'sb_publishable_test_public'},
   supabase:{createClient:()=>client}
 },
 location:{href:'https://example.org/SEC/#league',search:'',origin:'https://example.org',pathname:'/SEC/',hash:'#league',reload(){}},
 history:{replaceState(){}},
 setTimeout:(fn)=>{Promise.resolve().then(fn);return 1;},
 setInterval:()=>0,
 navigator:{clipboard:{writeText:async()=>{}}},
};
vm.runInNewContext(fs.readFileSync('multiplayer.js','utf8'),env,{filename:'multiplayer.js'});
const sleep=()=>new Promise(resolve=>setTimeout(resolve,0));
function click(action){
 assert.ok(handlers.click,'click handler registered');
 handlers.click({
   target:{closest:()=>({dataset:{online:action}})},
   preventDefault(){},stopImmediatePropagation(){}
 });
}
(async()=>{
 await sleep();await sleep();
 assert.match(host.innerHTML,/Create my account/,'create account form');
 assert.match(host.innerHTML,/version 2026.10.09.2/,'fresh account screen visible');
 assert.doesNotMatch(fs.readFileSync('multiplayer.js','utf8'),/Enter a valid email address\\./,'old client-side email rejection removed');
 assert.match(host.innerHTML,/online-password-confirm/,'password confirmation form');
 click('mode-login');assert.match(host.innerHTML,/Log in/);assert.doesNotMatch(host.innerHTML,/online-password-confirm/);
 click('mode-signup');click('register');
 await sleep();await sleep();await sleep();
 assert.equal(state.requests.some(x=>x.type==='signup'),true,'signup called');
 assert.equal(state.profile?.display_name,'Sally SEC','player profile created');
 assert.match(host.innerHTML,/Create league/,'create league appears for signed-in user');
 click('create-league');
 await sleep();await sleep();await sleep();
 assert.equal(state.requests.some(x=>x.type==='create-league'),true,'server-authorized create league RPC used');
 assert.match(host.innerHTML,/Saturday Friends/,'new league on screen');
 assert.match(host.innerHTML,/Share invite link/,'friends sharing available');
 // Simulate returning to the website and logging in with the same email/password.
 click('logout');
 await sleep();await sleep();
 await env.window.secOnline.refresh();
 click('mode-login');
 assert.match(host.innerHTML,/Log in/);
 click('login');
 await sleep();await sleep();await sleep();
 assert.equal(state.requests.some(x=>x.type==='login'),true,'password sign-in called');
 assert.match(host.innerHTML,/Saturday Friends/,'existing league reloads after sign-in');
 console.log('SEC signup → account profile → create private league → invite → logout → password login smoke tests passed.');
})().catch(err=>{console.error(err);process.exitCode=1;});
