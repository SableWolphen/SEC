/* Curated SEC football rivalry archive; includes currently active, historic, and nonconference series.
 * Single entry per pair; original 15 trophy IDs remain stable for permanent history.
 * Cited overview: https://en.wikipedia.org/wiki/Southeastern_Conference#Intra-conference_football_rivalries
 * and https://en.wikipedia.org/wiki/Southeastern_Conference#Interconference_football_rivalries
 * Battle for Highway 82 = Alabama/Mississippi State, NOT "Highway 85".
 * Rivalry does not necessarily imply an official physical trophy.
 */
(function(){
"use strict";
const all=[
 {
  "id": "iron-bowl",
  "name": "The Iron Bowl",
  "codes": [
   "ALA",
   "AUB"
  ],
  "symbol": "🏈",
  "kind": "trophy",
  "physical": "Foy–ODK Sportsmanship Trophy",
  "category": "SEC",
  "legacy": true,
  "teams": "Alabama vs Auburn",
  "model": "trophies/iron-bowl.glb",
  "short": "THE IRON BOWL",
  "tone": "#d7fa65",
  "nonconference": false
 },
 {
  "id": "third-saturday",
  "name": "Third Saturday in October",
  "codes": [
   "ALA",
   "TENN"
  ],
  "symbol": "🍂",
  "kind": "named",
  "physical": "",
  "category": "SEC",
  "legacy": true,
  "teams": "Alabama vs Tennessee",
  "model": "trophies/third-saturday.glb",
  "short": "THIRD SATURDAY IN OCTOBER",
  "tone": "#dfab61",
  "nonconference": false
 },
 {
  "id": "golden-boot",
  "name": "Battle for the Golden Boot",
  "codes": [
   "ARK",
   "LSU"
  ],
  "symbol": "🥾",
  "kind": "trophy",
  "physical": "The Golden Boot",
  "category": "SEC",
  "legacy": true,
  "teams": "Arkansas vs LSU",
  "model": "trophies/golden-boot.glb",
  "short": "BATTLE FOR THE GOLDEN BOOT",
  "tone": "#6dbdd0",
  "nonconference": false
 },
 {
  "id": "southwest-classic",
  "name": "The Southwest Classic",
  "codes": [
   "ARK",
   "TAMU"
  ],
  "symbol": "⭐",
  "kind": "trophy",
  "physical": "Southwest Classic Trophy",
  "category": "SEC",
  "legacy": true,
  "teams": "Arkansas vs Texas A&M",
  "model": "trophies/southwest-classic.glb",
  "short": "THE SOUTHWEST CLASSIC",
  "tone": "#d77c8b",
  "nonconference": false
 },
 {
  "id": "deep-south",
  "name": "Deep South’s Oldest Rivalry",
  "codes": [
   "AUB",
   "UGA"
  ],
  "symbol": "🏛️",
  "kind": "named",
  "physical": "",
  "category": "SEC",
  "legacy": true,
  "teams": "Auburn vs Georgia",
  "model": "trophies/deep-south.glb",
  "short": "DEEP SOUTH’S OLDEST ",
  "tone": "#b9a1e7",
  "nonconference": false
 },
 {
  "id": "cocktail-party",
  "name": "World’s Largest Outdoor Cocktail Party",
  "codes": [
   "FLA",
   "UGA"
  ],
  "symbol": "🍊",
  "kind": "trophy",
  "physical": "Okefenokee Oar",
  "category": "SEC",
  "legacy": true,
  "teams": "Florida vs Georgia",
  "model": "trophies/cocktail-party.glb",
  "short": "WORLD’S LARGEST OUTDOOR COC",
  "tone": "#a9cf91",
  "nonconference": false
 },
 {
  "id": "governors-cup",
  "name": "The Governor’s Cup",
  "codes": [
   "UK",
   "LOU"
  ],
  "symbol": "🏆",
  "kind": "trophy",
  "physical": "Governor’s Cup",
  "category": "Nonconference",
  "legacy": true,
  "teams": "Kentucky vs Louisville",
  "model": "trophies/governors-cup.glb",
  "short": "THE GOVERNOR’S CUP",
  "tone": "#e5ad83",
  "nonconference": true
 },
 {
  "id": "magnolia-bowl",
  "name": "The Magnolia Bowl",
  "codes": [
   "LSU",
   "MISS"
  ],
  "symbol": "🌸",
  "kind": "trophy",
  "physical": "Magnolia Bowl Trophy",
  "category": "SEC",
  "legacy": true,
  "teams": "LSU vs Ole Miss",
  "model": "trophies/magnolia-bowl.glb",
  "short": "THE MAGNOLIA BOWL",
  "tone": "#d7fa65",
  "nonconference": false
 },
 {
  "id": "golden-egg",
  "name": "The Egg Bowl",
  "codes": [
   "MISS",
   "MSST"
  ],
  "symbol": "🥚",
  "kind": "trophy",
  "physical": "Golden Egg",
  "category": "SEC",
  "legacy": true,
  "teams": "Ole Miss vs Mississippi State",
  "model": "trophies/golden-egg.glb",
  "short": "THE EGG BOWL",
  "tone": "#dfab61",
  "nonconference": false
 },
 {
  "id": "battle-line",
  "name": "Battle Line Rivalry",
  "codes": [
   "ARK",
   "MIZ"
  ],
  "symbol": "⚔️",
  "kind": "trophy",
  "physical": "Battle Line Trophy",
  "category": "SEC",
  "legacy": true,
  "teams": "Arkansas vs Missouri",
  "model": "trophies/battle-line.glb",
  "short": "BATTLE LINE ",
  "tone": "#6dbdd0",
  "nonconference": false
 },
 {
  "id": "mayors-cup",
  "name": "The Mayor’s Cup",
  "codes": [
   "MIZ",
   "SC"
  ],
  "symbol": "🏙️",
  "kind": "trophy",
  "physical": "Mayor’s Cup",
  "category": "SEC",
  "legacy": true,
  "teams": "Missouri vs South Carolina",
  "model": "trophies/mayors-cup.glb",
  "short": "THE MAYOR’S CUP",
  "tone": "#d77c8b",
  "nonconference": false
 },
 {
  "id": "red-river",
  "name": "Red River Rivalry",
  "codes": [
   "OU",
   "TEX"
  ],
  "symbol": "🌉",
  "kind": "trophy",
  "physical": "Golden Hat",
  "category": "SEC",
  "legacy": true,
  "teams": "Oklahoma vs Texas",
  "model": "trophies/red-river.glb",
  "short": "RED RIVER ",
  "tone": "#b9a1e7",
  "nonconference": false
 },
 {
  "id": "palmetto-showdown",
  "name": "Palmetto Bowl / Showdown",
  "codes": [
   "SC",
   "CLEM"
  ],
  "symbol": "🌴",
  "kind": "trophy",
  "physical": "Palmetto Trophy",
  "category": "Nonconference",
  "legacy": true,
  "teams": "South Carolina vs Clemson",
  "model": "trophies/palmetto-showdown.glb",
  "short": "PALMETTO BOWL / SHOWDOWN",
  "tone": "#a9cf91",
  "nonconference": true
 },
 {
  "id": "lone-star",
  "name": "Lone Star Showdown",
  "codes": [
   "TEX",
   "TAMU"
  ],
  "symbol": "🌟",
  "kind": "trophy",
  "physical": "Cotton Holdings Lone Star Showdown Trophy",
  "category": "SEC",
  "legacy": true,
  "teams": "Texas vs Texas A&M",
  "model": "trophies/lone-star.glb",
  "short": "LONE STAR SHOWDOWN",
  "tone": "#e5ad83",
  "nonconference": false
 },
 {
  "id": "tennessee-vanderbilt",
  "name": "Tennessee–Vanderbilt Rivalry",
  "codes": [
   "TENN",
   "VAN"
  ],
  "symbol": "🎸",
  "kind": "series",
  "physical": "",
  "category": "SEC",
  "legacy": true,
  "teams": "Tennessee vs Vanderbilt",
  "model": "trophies/tennessee-vanderbilt.glb",
  "short": "TENNESSEE–VANDERBILT ",
  "tone": "#d7fa65",
  "nonconference": false
 },
 {
  "id": "alabama-florida",
  "name": "Alabama–Florida Rivalry",
  "codes": [
   "ALA",
   "FLA"
  ],
  "symbol": "🛣️",
  "kind": "series",
  "physical": null,
  "category": "SEC",
  "legacy": false,
  "teams": "Alabama vs Florida",
  "model": null,
  "short": "ALABAMA–FLORIDA ",
  "tone": "#dfab61",
  "nonconference": false
 },
 {
  "id": "alabama-georgia",
  "name": "Alabama–Georgia Rivalry",
  "codes": [
   "ALA",
   "UGA"
  ],
  "symbol": "🐅",
  "kind": "series",
  "physical": null,
  "category": "SEC",
  "legacy": false,
  "teams": "Alabama vs Georgia",
  "model": null,
  "short": "ALABAMA–GEORGIA ",
  "tone": "#6dbdd0",
  "nonconference": false
 },
 {
  "id": "first-saturday-november",
  "name": "First Saturday in November",
  "codes": [
   "ALA",
   "LSU"
  ],
  "symbol": "🏈",
  "kind": "series",
  "physical": null,
  "category": "SEC",
  "legacy": false,
  "teams": "Alabama vs LSU",
  "model": null,
  "short": "FIRST SATURDAY IN NOVEMBER",
  "tone": "#d77c8b",
  "nonconference": false
 },
 {
  "id": "highway-82",
  "name": "Battle for Highway 82 / 90 Mile Drive",
  "codes": [
   "ALA",
   "MSST"
  ],
  "symbol": "⚡",
  "kind": "series",
  "physical": null,
  "category": "SEC",
  "legacy": false,
  "teams": "Alabama vs Mississippi State",
  "model": null,
  "short": "BATTLE FOR HIGHWAY 82 / 90 ",
  "tone": "#b9a1e7",
  "nonconference": false
 },
 {
  "id": "alabama-ole-miss",
  "name": "Alabama–Ole Miss Rivalry",
  "codes": [
   "ALA",
   "MISS"
  ],
  "symbol": "🏟️",
  "kind": "series",
  "physical": null,
  "category": "SEC",
  "legacy": false,
  "teams": "Alabama vs Ole Miss",
  "model": null,
  "short": "ALABAMA–OLE MISS ",
  "tone": "#a9cf91",
  "nonconference": false
 },
 {
  "id": "arkansas-ole-miss",
  "name": "Arkansas–Ole Miss Rivalry",
  "codes": [
   "ARK",
   "MISS"
  ],
  "symbol": "🎓",
  "kind": "series",
  "physical": null,
  "category": "SEC",
  "legacy": false,
  "teams": "Arkansas vs Ole Miss",
  "model": null,
  "short": "ARKANSAS–OLE MISS ",
  "tone": "#e5ad83",
  "nonconference": false
 },
 {
  "id": "arkansas-texas",
  "name": "Arkansas–Texas Rivalry",
  "codes": [
   "ARK",
   "TEX"
  ],
  "symbol": "🛣️",
  "kind": "series",
  "physical": null,
  "category": "SEC",
  "legacy": false,
  "teams": "Arkansas vs Texas",
  "model": null,
  "short": "ARKANSAS–TEXAS ",
  "tone": "#d7fa65",
  "nonconference": false
 },
 {
  "id": "auburn-florida",
  "name": "Auburn–Florida Rivalry",
  "codes": [
   "AUB",
   "FLA"
  ],
  "symbol": "🐅",
  "kind": "series",
  "physical": null,
  "category": "SEC",
  "legacy": false,
  "teams": "Auburn vs Florida",
  "model": null,
  "short": "AUBURN–FLORIDA ",
  "tone": "#dfab61",
  "nonconference": false
 },
 {
  "id": "tiger-bowl",
  "name": "Tiger Bowl / Auburn–LSU Rivalry",
  "codes": [
   "AUB",
   "LSU"
  ],
  "symbol": "🏈",
  "kind": "series",
  "physical": null,
  "category": "SEC",
  "legacy": false,
  "teams": "Auburn vs LSU",
  "model": null,
  "short": "TIGER BOWL / AUBURN–LSU ",
  "tone": "#6dbdd0",
  "nonconference": false
 },
 {
  "id": "auburn-ole-miss",
  "name": "Auburn–Ole Miss Rivalry",
  "codes": [
   "AUB",
   "MISS"
  ],
  "symbol": "⚡",
  "kind": "series",
  "physical": null,
  "category": "SEC",
  "legacy": false,
  "teams": "Auburn vs Ole Miss",
  "model": null,
  "short": "AUBURN–OLE MISS ",
  "tone": "#d77c8b",
  "nonconference": false
 },
 {
  "id": "auburn-tennessee",
  "name": "Auburn–Tennessee Rivalry",
  "codes": [
   "AUB",
   "TENN"
  ],
  "symbol": "🏟️",
  "kind": "series",
  "physical": null,
  "category": "SEC",
  "legacy": false,
  "teams": "Auburn vs Tennessee",
  "model": null,
  "short": "AUBURN–TENNESSEE ",
  "tone": "#b9a1e7",
  "nonconference": false
 },
 {
  "id": "florida-kentucky",
  "name": "Florida–Kentucky Rivalry",
  "codes": [
   "FLA",
   "UK"
  ],
  "symbol": "🎓",
  "kind": "series",
  "physical": null,
  "category": "SEC",
  "legacy": false,
  "teams": "Florida vs Kentucky",
  "model": null,
  "short": "FLORIDA–KENTUCKY ",
  "tone": "#a9cf91",
  "nonconference": false
 },
 {
  "id": "florida-lsu",
  "name": "Florida–LSU Rivalry",
  "codes": [
   "FLA",
   "LSU"
  ],
  "symbol": "🛣️",
  "kind": "series",
  "physical": null,
  "category": "SEC",
  "legacy": false,
  "teams": "Florida vs LSU",
  "model": null,
  "short": "FLORIDA–LSU ",
  "tone": "#e5ad83",
  "nonconference": false
 },
 {
  "id": "florida-tennessee",
  "name": "Florida–Tennessee Rivalry",
  "codes": [
   "FLA",
   "TENN"
  ],
  "symbol": "🐅",
  "kind": "series",
  "physical": null,
  "category": "SEC",
  "legacy": false,
  "teams": "Florida vs Tennessee",
  "model": null,
  "short": "FLORIDA–TENNESSEE ",
  "tone": "#d7fa65",
  "nonconference": false
 },
 {
  "id": "georgia-south-carolina",
  "name": "Georgia–South Carolina Rivalry",
  "codes": [
   "UGA",
   "SC"
  ],
  "symbol": "🏈",
  "kind": "series",
  "physical": null,
  "category": "SEC",
  "legacy": false,
  "teams": "Georgia vs South Carolina",
  "model": null,
  "short": "GEORGIA–SOUTH CAROLINA ",
  "tone": "#dfab61",
  "nonconference": false
 },
 {
  "id": "georgia-tennessee",
  "name": "Georgia–Tennessee Rivalry",
  "codes": [
   "UGA",
   "TENN"
  ],
  "symbol": "⚡",
  "kind": "series",
  "physical": null,
  "category": "SEC",
  "legacy": false,
  "teams": "Georgia vs Tennessee",
  "model": null,
  "short": "GEORGIA–TENNESSEE ",
  "tone": "#6dbdd0",
  "nonconference": false
 },
 {
  "id": "georgia-vanderbilt",
  "name": "Georgia–Vanderbilt Rivalry",
  "codes": [
   "UGA",
   "VAN"
  ],
  "symbol": "🏟️",
  "kind": "series",
  "physical": null,
  "category": "SEC",
  "legacy": false,
  "teams": "Georgia vs Vanderbilt",
  "model": null,
  "short": "GEORGIA–VANDERBILT ",
  "tone": "#d77c8b",
  "nonconference": false
 },
 {
  "id": "beer-barrel",
  "name": "Kentucky–Tennessee / Beer Barrel",
  "codes": [
   "UK",
   "TENN"
  ],
  "symbol": "🎓",
  "kind": "trophy",
  "physical": "Beer Barrel (retired)",
  "category": "SEC",
  "legacy": false,
  "teams": "Kentucky vs Tennessee",
  "model": null,
  "short": "KENTUCKY–TENNESSEE / BEER B",
  "tone": "#b9a1e7",
  "nonconference": false
 },
 {
  "id": "kentucky-vanderbilt",
  "name": "Kentucky–Vanderbilt Rivalry",
  "codes": [
   "UK",
   "VAN"
  ],
  "symbol": "🛣️",
  "kind": "series",
  "physical": null,
  "category": "SEC",
  "legacy": false,
  "teams": "Kentucky vs Vanderbilt",
  "model": null,
  "short": "KENTUCKY–VANDERBILT ",
  "tone": "#a9cf91",
  "nonconference": false
 },
 {
  "id": "lsu-mississippi-state",
  "name": "LSU–Mississippi State Rivalry",
  "codes": [
   "LSU",
   "MSST"
  ],
  "symbol": "🐅",
  "kind": "series",
  "physical": null,
  "category": "SEC",
  "legacy": false,
  "teams": "LSU vs Mississippi State",
  "model": null,
  "short": "LSU–MISSISSIPPI STATE ",
  "tone": "#e5ad83",
  "nonconference": false
 },
 {
  "id": "lsu-texas-am",
  "name": "LSU–Texas A&M Rivalry",
  "codes": [
   "LSU",
   "TAMU"
  ],
  "symbol": "🏈",
  "kind": "series",
  "physical": null,
  "category": "SEC",
  "legacy": false,
  "teams": "LSU vs Texas A&M",
  "model": null,
  "short": "LSU–TEXAS A&M ",
  "tone": "#d7fa65",
  "nonconference": false
 },
 {
  "id": "tiger-sooner",
  "name": "Missouri–Oklahoma / Tiger–Sooner Peace Pipe",
  "codes": [
   "MIZ",
   "OU"
  ],
  "symbol": "⚡",
  "kind": "trophy",
  "physical": "Tiger–Sooner Peace Pipe",
  "category": "SEC",
  "legacy": false,
  "teams": "Missouri vs Oklahoma",
  "model": null,
  "short": "MISSOURI–OKLAHOMA / TIGER–S",
  "tone": "#dfab61",
  "nonconference": false
 },
 {
  "id": "ole-miss-vanderbilt",
  "name": "Ole Miss–Vanderbilt Rivalry",
  "codes": [
   "MISS",
   "VAN"
  ],
  "symbol": "🏟️",
  "kind": "series",
  "physical": null,
  "category": "SEC",
  "legacy": false,
  "teams": "Ole Miss vs Vanderbilt",
  "model": null,
  "short": "OLE MISS–VANDERBILT ",
  "tone": "#6dbdd0",
  "nonconference": false
 },
 {
  "id": "south-carolina-tennessee",
  "name": "South Carolina–Tennessee Rivalry",
  "codes": [
   "SC",
   "TENN"
  ],
  "symbol": "🎓",
  "kind": "series",
  "physical": null,
  "category": "SEC",
  "legacy": false,
  "teams": "South Carolina vs Tennessee",
  "model": null,
  "short": "SOUTH CAROLINA–TENNESSEE ",
  "tone": "#d77c8b",
  "nonconference": false
 },
 {
  "id": "alabama-clemson",
  "name": "Alabama–Clemson Rivalry",
  "codes": [
   "ALA",
   "CLEM"
  ],
  "symbol": "🏟️",
  "kind": "series",
  "physical": null,
  "category": "Nonconference",
  "legacy": false,
  "teams": "Alabama vs Clemson",
  "model": null,
  "short": "ALABAMA–CLEMSON ",
  "tone": "#b9a1e7",
  "nonconference": true
 },
 {
  "id": "alabama-georgia-tech",
  "name": "Alabama–Georgia Tech Rivalry",
  "codes": [
   "ALA",
   "GT"
  ],
  "symbol": "🏆",
  "kind": "series",
  "physical": null,
  "category": "Nonconference",
  "legacy": false,
  "teams": "Alabama vs Georgia Tech",
  "model": null,
  "short": "ALABAMA–GEORGIA TECH ",
  "tone": "#a9cf91",
  "nonconference": true
 },
 {
  "id": "alabama-penn-state",
  "name": "Alabama–Penn State Rivalry",
  "codes": [
   "ALA",
   "PSU"
  ],
  "symbol": "⚡",
  "kind": "series",
  "physical": null,
  "category": "Nonconference",
  "legacy": false,
  "teams": "Alabama vs Penn State",
  "model": null,
  "short": "ALABAMA–PENN STATE ",
  "tone": "#e5ad83",
  "nonconference": true
 },
 {
  "id": "arkansas-texas-tech",
  "name": "Arkansas–Texas Tech Rivalry",
  "codes": [
   "ARK",
   "TTU"
  ],
  "symbol": "🎖️",
  "kind": "series",
  "physical": null,
  "category": "Nonconference",
  "legacy": false,
  "teams": "Arkansas vs Texas Tech",
  "model": null,
  "short": "ARKANSAS–TEXAS TECH ",
  "tone": "#d7fa65",
  "nonconference": true
 },
 {
  "id": "auburn-clemson",
  "name": "Auburn–Clemson Rivalry",
  "codes": [
   "AUB",
   "CLEM"
  ],
  "symbol": "🌟",
  "kind": "series",
  "physical": null,
  "category": "Nonconference",
  "legacy": false,
  "teams": "Auburn vs Clemson",
  "model": null,
  "short": "AUBURN–CLEMSON ",
  "tone": "#dfab61",
  "nonconference": true
 },
 {
  "id": "auburn-georgia-tech",
  "name": "Auburn–Georgia Tech Rivalry",
  "codes": [
   "AUB",
   "GT"
  ],
  "symbol": "🏈",
  "kind": "series",
  "physical": null,
  "category": "Nonconference",
  "legacy": false,
  "teams": "Auburn vs Georgia Tech",
  "model": null,
  "short": "AUBURN–GEORGIA TECH ",
  "tone": "#6dbdd0",
  "nonconference": true
 },
 {
  "id": "auburn-tulane",
  "name": "Auburn–Tulane Rivalry",
  "codes": [
   "AUB",
   "TULANE"
  ],
  "symbol": "🎓",
  "kind": "series",
  "physical": null,
  "category": "Nonconference",
  "legacy": false,
  "teams": "Auburn vs Tulane",
  "model": null,
  "short": "AUBURN–TULANE ",
  "tone": "#d77c8b",
  "nonconference": true
 },
 {
  "id": "sunshine-showdown",
  "name": "Sunshine Showdown",
  "codes": [
   "FLA",
   "FSU"
  ],
  "symbol": "🏛️",
  "kind": "trophy",
  "physical": "Makala Trophy / Florida Cup",
  "category": "Nonconference",
  "legacy": false,
  "teams": "Florida vs Florida State",
  "model": null,
  "short": "SUNSHINE SHOWDOWN",
  "tone": "#b9a1e7",
  "nonconference": true
 },
 {
  "id": "florida-miami",
  "name": "Florida–Miami Rivalry / Florida Cup",
  "codes": [
   "FLA",
   "MIAMI"
  ],
  "symbol": "🏟️",
  "kind": "trophy",
  "physical": "Florida Cup",
  "category": "Nonconference",
  "legacy": false,
  "teams": "Florida vs Miami",
  "model": null,
  "short": "FLORIDA–MIAMI  / FLORIDA CU",
  "tone": "#a9cf91",
  "nonconference": true
 },
 {
  "id": "georgia-clemson",
  "name": "Georgia–Clemson Rivalry",
  "codes": [
   "UGA",
   "CLEM"
  ],
  "symbol": "🏆",
  "kind": "series",
  "physical": null,
  "category": "Nonconference",
  "legacy": false,
  "teams": "Georgia vs Clemson",
  "model": null,
  "short": "GEORGIA–CLEMSON ",
  "tone": "#e5ad83",
  "nonconference": true
 },
 {
  "id": "clean-old-fashioned-hate",
  "name": "Clean, Old-Fashioned Hate",
  "codes": [
   "UGA",
   "GT"
  ],
  "symbol": "⚡",
  "kind": "trophy",
  "physical": "Governor’s Cup (Georgia)",
  "category": "Nonconference",
  "legacy": false,
  "teams": "Georgia vs Georgia Tech",
  "model": null,
  "short": "CLEAN, OLD-FASHIONED HATE",
  "tone": "#d7fa65",
  "nonconference": true
 },
 {
  "id": "kentucky-centre",
  "name": "Kentucky–Centre Historic Rivalry",
  "codes": [
   "UK",
   "CENTRE"
  ],
  "symbol": "🎖️",
  "kind": "historic",
  "physical": null,
  "category": "Historic",
  "legacy": false,
  "teams": "Kentucky vs Centre",
  "model": null,
  "short": "KENTUCKY–CENTRE HISTORIC ",
  "tone": "#dfab61",
  "nonconference": true
 },
 {
  "id": "kentucky-indiana",
  "name": "Kentucky–Indiana Rivalry",
  "codes": [
   "UK",
   "IND"
  ],
  "symbol": "🌟",
  "kind": "series",
  "physical": null,
  "category": "Nonconference",
  "legacy": false,
  "teams": "Kentucky vs Indiana",
  "model": null,
  "short": "KENTUCKY–INDIANA ",
  "tone": "#6dbdd0",
  "nonconference": true
 },
 {
  "id": "battle-on-broadway",
  "name": "Battle on Broadway",
  "codes": [
   "UK",
   "TRANS"
  ],
  "symbol": "🏈",
  "kind": "historic",
  "physical": null,
  "category": "Historic",
  "legacy": false,
  "teams": "Kentucky vs Transylvania",
  "model": null,
  "short": "BATTLE ON BROADWAY",
  "tone": "#d77c8b",
  "nonconference": true
 },
 {
  "id": "battle-for-rag",
  "name": "Battle for the Rag",
  "codes": [
   "LSU",
   "TULANE"
  ],
  "symbol": "🎓",
  "kind": "trophy",
  "physical": "Tiger Rag / Victory Rag",
  "category": "Nonconference",
  "legacy": false,
  "teams": "LSU vs Tulane",
  "model": null,
  "short": "BATTLE FOR THE RAG",
  "tone": "#b9a1e7",
  "nonconference": true
 },
 {
  "id": "arch-rivalry",
  "name": "The Arch Rivalry",
  "codes": [
   "MIZ",
   "ILL"
  ],
  "symbol": "🏛️",
  "kind": "named",
  "physical": null,
  "category": "Nonconference",
  "legacy": false,
  "teams": "Missouri vs Illinois",
  "model": null,
  "short": "THE ARCH ",
  "tone": "#a9cf91",
  "nonconference": true
 },
 {
  "id": "telephone-trophy",
  "name": "Telephone Trophy / Missouri–Iowa State",
  "codes": [
   "MIZ",
   "ISU"
  ],
  "symbol": "🏟️",
  "kind": "trophy",
  "physical": "Telephone Trophy",
  "category": "Nonconference",
  "legacy": false,
  "teams": "Missouri vs Iowa State",
  "model": null,
  "short": "TELEPHONE TROPHY / MISSOURI",
  "tone": "#e5ad83",
  "nonconference": true
 },
 {
  "id": "border-war",
  "name": "The Border War",
  "codes": [
   "MIZ",
   "KU"
  ],
  "symbol": "🏆",
  "kind": "trophy",
  "physical": "Indian War Drum",
  "category": "Nonconference",
  "legacy": false,
  "teams": "Missouri vs Kansas",
  "model": null,
  "short": "THE BORDER WAR",
  "tone": "#d7fa65",
  "nonconference": true
 },
 {
  "id": "missouri-nebraska",
  "name": "Missouri–Nebraska Rivalry",
  "codes": [
   "MIZ",
   "NEB"
  ],
  "symbol": "⚡",
  "kind": "trophy",
  "physical": "Victory Bell",
  "category": "Nonconference",
  "legacy": false,
  "teams": "Missouri vs Nebraska",
  "model": null,
  "short": "MISSOURI–NEBRASKA ",
  "tone": "#dfab61",
  "nonconference": true
 },
 {
  "id": "nebraska-oklahoma",
  "name": "Nebraska–Oklahoma Rivalry",
  "codes": [
   "OU",
   "NEB"
  ],
  "symbol": "🎖️",
  "kind": "named",
  "physical": null,
  "category": "Nonconference",
  "legacy": false,
  "teams": "Oklahoma vs Nebraska",
  "model": null,
  "short": "NEBRASKA–OKLAHOMA ",
  "tone": "#6dbdd0",
  "nonconference": true
 },
 {
  "id": "bedlam",
  "name": "Bedlam Series",
  "codes": [
   "OU",
   "OKST"
  ],
  "symbol": "🌟",
  "kind": "trophy",
  "physical": "Bedlam Bell",
  "category": "Nonconference",
  "legacy": false,
  "teams": "Oklahoma vs Oklahoma State",
  "model": null,
  "short": "BEDLAM SERIES",
  "tone": "#d77c8b",
  "nonconference": true
 },
 {
  "id": "mid-south",
  "name": "Mid-South Rivalry",
  "codes": [
   "MISS",
   "MEM"
  ],
  "symbol": "🏈",
  "kind": "named",
  "physical": null,
  "category": "Nonconference",
  "legacy": false,
  "teams": "Ole Miss vs Memphis",
  "model": null,
  "short": "MID-SOUTH ",
  "tone": "#b9a1e7",
  "nonconference": true
 },
 {
  "id": "ole-miss-tulane",
  "name": "Ole Miss–Tulane Rivalry",
  "codes": [
   "MISS",
   "TULANE"
  ],
  "symbol": "🎓",
  "kind": "series",
  "physical": null,
  "category": "Nonconference",
  "legacy": false,
  "teams": "Ole Miss vs Tulane",
  "model": null,
  "short": "OLE MISS–TULANE ",
  "tone": "#a9cf91",
  "nonconference": true
 },
 {
  "id": "south-carolina-north-carolina",
  "name": "South Carolina–North Carolina Rivalry",
  "codes": [
   "SC",
   "UNC"
  ],
  "symbol": "🏛️",
  "kind": "series",
  "physical": null,
  "category": "Nonconference",
  "legacy": false,
  "teams": "South Carolina vs North Carolina",
  "model": null,
  "short": "SOUTH CAROLINA–NORTH CAROLI",
  "tone": "#e5ad83",
  "nonconference": true
 },
 {
  "id": "tennessee-georgia-tech",
  "name": "Tennessee–Georgia Tech Rivalry",
  "codes": [
   "TENN",
   "GT"
  ],
  "symbol": "🏟️",
  "kind": "series",
  "physical": null,
  "category": "Nonconference",
  "legacy": false,
  "teams": "Tennessee vs Georgia Tech",
  "model": null,
  "short": "TENNESSEE–GEORGIA TECH ",
  "tone": "#d7fa65",
  "nonconference": true
 },
 {
  "id": "texas-baylor",
  "name": "Texas–Baylor Rivalry",
  "codes": [
   "TEX",
   "BAY"
  ],
  "symbol": "🏆",
  "kind": "series",
  "physical": null,
  "category": "Nonconference",
  "legacy": false,
  "teams": "Texas vs Baylor",
  "model": null,
  "short": "TEXAS–BAYLOR ",
  "tone": "#dfab61",
  "nonconference": true
 },
 {
  "id": "texas-rice",
  "name": "Texas–Rice Rivalry",
  "codes": [
   "TEX",
   "RICE"
  ],
  "symbol": "⚡",
  "kind": "series",
  "physical": null,
  "category": "Nonconference",
  "legacy": false,
  "teams": "Texas vs Rice",
  "model": null,
  "short": "TEXAS–RICE ",
  "tone": "#6dbdd0",
  "nonconference": true
 },
 {
  "id": "texas-tcu",
  "name": "Texas–TCU Rivalry",
  "codes": [
   "TEX",
   "TCU"
  ],
  "symbol": "🎖️",
  "kind": "series",
  "physical": null,
  "category": "Nonconference",
  "legacy": false,
  "teams": "Texas vs TCU",
  "model": null,
  "short": "TEXAS–TCU ",
  "tone": "#d77c8b",
  "nonconference": true
 },
 {
  "id": "chancellors-spurs",
  "name": "Texas–Texas Tech / Chancellor’s Spurs",
  "codes": [
   "TEX",
   "TTU"
  ],
  "symbol": "🌟",
  "kind": "trophy",
  "physical": "Chancellor’s Spurs",
  "category": "Nonconference",
  "legacy": false,
  "teams": "Texas vs Texas Tech",
  "model": null,
  "short": "TEXAS–TEXAS TECH / CHANCELL",
  "tone": "#b9a1e7",
  "nonconference": true
 },
 {
  "id": "battle-brazos",
  "name": "Battle of the Brazos",
  "codes": [
   "TAMU",
   "BAY"
  ],
  "symbol": "🏈",
  "kind": "named",
  "physical": null,
  "category": "Nonconference",
  "legacy": false,
  "teams": "Texas A&M vs Baylor",
  "model": null,
  "short": "BATTLE OF THE BRAZOS",
  "tone": "#a9cf91",
  "nonconference": true
 },
 {
  "id": "texas-am-tcu",
  "name": "Texas A&M–TCU Rivalry",
  "codes": [
   "TAMU",
   "TCU"
  ],
  "symbol": "🎓",
  "kind": "series",
  "physical": null,
  "category": "Nonconference",
  "legacy": false,
  "teams": "Texas A&M vs TCU",
  "model": null,
  "short": "TEXAS A&M–TCU ",
  "tone": "#e5ad83",
  "nonconference": true
 },
 {
  "id": "texas-am-texas-tech",
  "name": "Texas A&M–Texas Tech Rivalry",
  "codes": [
   "TAMU",
   "TTU"
  ],
  "symbol": "🏛️",
  "kind": "series",
  "physical": null,
  "category": "Nonconference",
  "legacy": false,
  "teams": "Texas A&M vs Texas Tech",
  "model": null,
  "short": "TEXAS A&M–TEXAS TECH ",
  "tone": "#d7fa65",
  "nonconference": true
 },
 {
  "id": "gold-cowbell",
  "name": "Georgia Tech–Vanderbilt / Gold Cowbell",
  "codes": [
   "VAN",
   "GT"
  ],
  "symbol": "🏟️",
  "kind": "trophy",
  "physical": "Gold Cowbell",
  "category": "Nonconference",
  "legacy": false,
  "teams": "Vanderbilt vs Georgia Tech",
  "model": null,
  "short": "GEORGIA TECH–VANDERBILT / G",
  "tone": "#dfab61",
  "nonconference": true
 },
 {
  "id": "sewanee-vanderbilt",
  "name": "Sewanee–Vanderbilt Historic Rivalry",
  "codes": [
   "VAN",
   "SEWANEE"
  ],
  "symbol": "🏆",
  "kind": "historic",
  "physical": null,
  "category": "Historic",
  "legacy": false,
  "teams": "Vanderbilt vs Sewanee",
  "model": null,
  "short": "SEWANEE–VANDERBILT HISTORIC",
  "tone": "#6dbdd0",
  "nonconference": true
 }
];
const pairs=new Set(),ids=new Set();
for(const t of all){
 const pair=[...t.codes].sort().join("|");
 if(pairs.has(pair)||ids.has(t.id))throw Error("Duplicate rivalry: "+t.id);
 pairs.add(pair);ids.add(t.id);
}
window.SDS_RIVALRIES=Object.freeze(all.map(t=>Object.freeze(t)));
})();
