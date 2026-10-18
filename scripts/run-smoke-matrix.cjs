/* CI preflight: execute EVERY unit smoke check, reporting every failure in one run.
 * The long validation job still independently verifies scripts, Python, builds and types.
 */
"use strict";
const {spawnSync}=require("node:child_process");
const fs=require("node:fs");
const assert=require("node:assert/strict");
const yaml=fs.readFileSync(".github/workflows/validate.yml","utf8");
const commands=[...yaml.matchAll(/^\s+node (scripts\/smoke-[\w-]+\.cjs)\s*$/gm)].map(x=>x[1]);
const tests=[...new Set(commands)];
assert.ok(tests.length>=35,"Workflow smoke suite discovery unexpectedly incomplete");
const failures=[];
for(const [index,file] of tests.entries()){
 const result=spawnSync(process.execPath,[file],{encoding:"utf8",timeout:120000,maxBuffer:2*1024*1024});
 if(result.status===0){
  process.stdout.write("PASS "+(index+1)+"/"+tests.length+" "+file+"\n");continue;
 }
 const details=(result.stderr||result.stdout||result.error?.message||"Unknown error").split("\n");
 const useful=details.findIndex(s=>/AssertionError|Error:|SyntaxError|ReferenceError|TypeError/.test(s));
 const summary=details.slice(Math.max(0,useful),Math.max(0,useful)+14).join("\n").slice(0,1600);
 failures.push({file,code:result.status,reason:summary||"No failure details"});
 process.stderr.write("FAIL "+file+"\n"+failures.at(-1).reason+"\n");
}
console.log("Smoke matrix: "+(tests.length-failures.length)+"/"+tests.length+" passed");
if(failures.length){
 console.error("Failed scripts:\n"+failures.map(x=>"- "+x.file).join("\n"));
 process.exitCode=1;
}
