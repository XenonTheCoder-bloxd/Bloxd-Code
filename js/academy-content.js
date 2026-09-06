'use strict';

/* Academy lesson content: titles, starter code, hints. Pure data, no rendering logic. */
  const ACADEMY_UNITS = [
    {
      title: "Unit 1: JavaScript & 3D Coordinates",
      subtitle: "Vector Mathematics, Arrays, and Player Tags",
      lessons: [
        {
          id: "u1_l1",
          title: "1. 3D Coordinates in Bloxd",
          icon: "fa-cube",
          xp: 25,
          theory: `
            <h3>Coordinates in Bloxd.io</h3>
            <p>Bloxd worlds operate in a 3D coordinate space represented as an array of 3 numbers: <code>[X, Y, Z]</code>.</p>
            <ul>
              <li><strong>X</strong>: East / West position</li>
              <li><strong>Y</strong>: Height (Up / Down)</li>
              <li><strong>Z</strong>: North / South position</li>
            </ul>
            <p><strong>Your Task:</strong> Create a variable named <code>spawnLocation</code> assigned to the coordinate array <code>[10, 64, -20]</code>.</p>
          `,
          initialCode: "// Create spawnLocation below:\n",
          hint: "let spawnLocation = [10, 64, -20];",
          runTest: (code) => {
            if (!code.includes("spawnLocation")) return { pass: false, error: "Variable 'spawnLocation' was not found in code." };
            try {
              const res = new Function(code + "\nreturn spawnLocation;")();
              if (Array.isArray(res) && res[0] === 10 && res[1] === 64 && res[2] === -20) {
                return { pass: true };
              }
              return { pass: false, error: `Expected [10, 64, -20], but got ${JSON.stringify(res)}` };
            } catch (err) {
              return { pass: false, error: err.message };
            }
          }
        },
        {
          id: "u1_l2",
          title: "2. Vector Distance Calculation",
          icon: "fa-ruler-combined",
          xp: 35,
          theory: `
            <h3>3D Euclidean Distance</h3>
            <p>To detect proximity between a player and an objective, we calculate the Euclidean distance across 3D coordinates:</p>
            <pre><code>Math.hypot(p2[0]-p1[0], p2[1]-p1[1], p2[2]-p1[2])</code></pre>
            <p><strong>Your Task:</strong> Write a function <code>getDistance(posA, posB)</code> that takes two coordinate arrays and returns the Euclidean distance between them.</p>
          `,
          initialCode: "function getDistance(posA, posB) {\n  // return distance\n}\n",
          hint: "return Math.hypot(posB[0] - posA[0], posB[1] - posA[1], posB[2] - posA[2]);",
          runTest: (code) => {
            try {
              const fn = new Function(code + "\nreturn getDistance([0, 0, 0], [3, 0, 4]);")();
              if (fn === 5) return { pass: true };
              return { pass: false, error: `Expected distance 5 for [0,0,0] to [3,0,4], got ${fn}` };
            } catch (err) {
              return { pass: false, error: err.message };
            }
          }
        },
        {
          id: "u1_l3",
          title: "3. Player Rank Tag Formatting",
          icon: "fa-tag",
          xp: 30,
          theory: `
            <h3>Player Display Formatting</h3>
            <p>Bloxd allows formatting chat usernames with prefix ranks.</p>
            <p><strong>Your Task:</strong> Write a function <code>formatRank(name, rank)</code> that returns <code>'[' + rank.toUpperCase() + '] ' + name</code>.</p>
          `,
          initialCode: "function formatRank(name, rank) {\n  // return formatted tag\n}\n",
          hint: "return '[' + rank.toUpperCase() + '] ' + name;",
          runTest: (code) => {
            try {
              const fn = new Function(code + "\nreturn formatRank('Axel', 'vip');")();
              if (fn === "[VIP] Axel") return { pass: true };
              return { pass: false, error: `Expected '[VIP] Axel', got '${fn}'` };
            } catch (err) {
              return { pass: false, error: err.message };
            }
          }
        }
      ]
    },
    {
      title: "Unit 2: ES Module Imports & Library Architecture",
      subtitle: "Loading Official Modules Without File Extensions",
      lessons: [
        {
          id: "u2_l1",
          title: "1. Importing MathLib",
          icon: "fa-file-import",
          xp: 40,
          theory: `
            <h3>Importing Bloxd Libraries</h3>
            <p>Bloxd scripts use standard ES Module imports <strong>without the .js file extension</strong>.</p>
            <pre><code>import { MathLib } from "./MathLib"</code></pre>
            <p><em>Important: Never use setTimeout or setInterval in Bloxd scripts!</em></p>
            <p><strong>Your Task:</strong> Write an import statement to import <code>MathLib</code> from <code>./MathLib</code>.</p>
          `,
          initialCode: "// Write your import statement below:\n",
          hint: 'import { MathLib } from "./MathLib"',
          runTest: (code) => {
            const clean = code.replace(/\s+/g, " ").trim();
            if (clean.includes(".js")) return { pass: false, error: "Do NOT include '.js' in Bloxd import paths!" };
            if (/import\s*\{\s*MathLib\s*\}\s*from\s*["']\.\/MathLib["']/i.test(clean) ||
                /import\s+MathLib\s+from\s*["']\.\/MathLib["']/i.test(clean)) {
              return { pass: true };
            }
            return { pass: false, error: 'Expected: import { MathLib } from "./MathLib"' };
          }
        },
        {
          id: "u2_l2",
          title: "2. Multi-Module Destructuring",
          icon: "fa-cubes",
          xp: 45,
          theory: `
            <h3>Destructured Module Imports</h3>
            <p>You can destructure multiple utilities from a shared module bundle:</p>
            <pre><code>import { KVStore, Pathfinder } from "./BloxdLibs"</code></pre>
            <p><strong>Your Task:</strong> Write an import statement to import both <code>KVStore</code> and <code>Pathfinder</code> from <code>./BloxdLibs</code>.</p>
          `,
          initialCode: "// Import KVStore and Pathfinder below:\n",
          hint: 'import { KVStore, Pathfinder } from "./BloxdLibs"',
          runTest: (code) => {
            const clean = code.replace(/\s+/g, " ").trim();
            if (clean.includes(".js")) return { pass: false, error: "Do NOT include '.js' in import path!" };
            if (/import\s*\{[^}]*KVStore[^}]*Pathfinder[^}]*\}\s*from\s*["']\.\/BloxdLibs["']/i.test(clean) ||
                /import\s*\{[^}]*Pathfinder[^}]*KVStore[^}]*\}\s*from\s*["']\.\/BloxdLibs["']/i.test(clean)) {
              return { pass: true };
            }
            return { pass: false, error: 'Expected: import { KVStore, Pathfinder } from "./BloxdLibs"' };
          }
        }
      ]
    },
    {
      title: "Unit 3: Bloxd Core Scripting API",
      subtitle: "In-Game Messages, Position Querying & Block Placement",
      lessons: [
        {
          id: "u3_l1",
          title: "1. Broadcasting Messages",
          icon: "fa-bullhorn",
          xp: 40,
          theory: `
            <h3>The Global api Object</h3>
            <p>Bloxd exposes the global <code>api</code> object for world interactions. To send a server announcement, call <code>api.broadcastMessage(message, color)</code>.</p>
            <p><strong>Your Task:</strong> Write a function <code>announceWinner(playerName)</code> that calls <code>api.broadcastMessage(playerName + ' won the match!', '#ffffff')</code>.</p>
          `,
          initialCode: "function announceWinner(playerName) {\n  // Broadcast winner announcement\n}\n",
          hint: "api.broadcastMessage(playerName + ' won the match!', '#ffffff');",
          runTest: (code) => {
            let calledWith = null;
            const mockApi = {
              broadcastMessage: (msg, col) => { calledWith = { msg, col }; }
            };
            try {
              new Function("api", code + "\nannounceWinner('Axel');")(mockApi);
              if (calledWith && calledWith.msg === "Axel won the match!" && calledWith.col === "#ffffff") {
                return { pass: true };
              }
              return { pass: false, error: `Expected api.broadcastMessage('Axel won the match!', '#ffffff')` };
            } catch (err) {
              return { pass: false, error: err.message };
            }
          }
        },
        {
          id: "u3_l2",
          title: "2. Setting Voxel Blocks",
          icon: "fa-cubes-stacked",
          xp: 45,
          theory: `
            <h3>api.setBlock(x, y, z, blockType)</h3>
            <p>You can modify blocks in the world with <code>api.setBlock</code>.</p>
            <p><strong>Your Task:</strong> Write a function <code>spawnPlatform(x, y, z, blockType)</code> that places a 3x3 platform centered at <code>(x, y, z)</code> by calling <code>api.setBlock(px, y, pz, blockType)</code> for <code>px</code> from <code>x-1</code> to <code>x+1</code> and <code>pz</code> from <code>z-1</code> to <code>z+1</code>.</p>
          `,
          initialCode: "function spawnPlatform(x, y, z, blockType) {\n  // Place 3x3 platform\n}\n",
          hint: "for (let dx = -1; dx <= 1; dx++) { for (let dz = -1; dz <= 1; dz++) { api.setBlock(x + dx, y, z + dz, blockType); } }",
          runTest: (code) => {
            const blocks = [];
            const mockApi = {
              setBlock: (bx, by, bz, type) => { blocks.push({ bx, by, bz, type }); }
            };
            try {
              new Function("api", code + "\nspawnPlatform(0, 64, 0, 'Stone');")(mockApi);
              if (blocks.length === 9) return { pass: true };
              return { pass: false, error: `Expected 9 blocks placed for 3x3 platform, placed ${blocks.length}` };
            } catch (err) {
              return { pass: false, error: err.message };
            }
          }
        }
      ]
    },
    {
      title: "Unit 4: The tick() Game Loop & Physics",
      subtitle: "Real-Time Game Cycles (Strictly No Timers)",
      lessons: [
        {
          id: "u4_l1",
          title: "1. Global tick() Game Loop",
          icon: "fa-rotate",
          xp: 50,
          theory: `
            <h3>The Global tick() Loop</h3>
            <p>Because Bloxd <strong>strictly forbids setTimeout and setInterval</strong>, all timed game logic executes inside the global <code>tick()</code> function, which runs every server tick.</p>
            <p><strong>Your Task:</strong> Declare a variable <code>currentTick = 0</code> and a function <code>tick()</code> that adds 1 to <code>currentTick</code> each tick.</p>
          `,
          initialCode: "let currentTick = 0;\n\nfunction tick() {\n  // increment currentTick\n}\n",
          hint: "function tick() { currentTick++; }",
          runTest: (code) => {
            if (code.includes("setTimeout") || code.includes("setInterval")) {
              return { pass: false, error: "Bloxd forbids setTimeout and setInterval! Use tick()." };
            }
            try {
              const res = new Function(code + "\ntick(); tick(); tick(); return currentTick;")();
              if (res === 3) return { pass: true };
              return { pass: false, error: `Expected currentTick = 3 after 3 ticks, got ${res}` };
            } catch (err) {
              return { pass: false, error: err.message };
            }
          }
        },
        {
          id: "u4_l2",
          title: "2. Velocity & Gravity Simulation",
          icon: "fa-arrow-down-long",
          xp: 55,
          theory: `
            <h3>Simulating Physics inside tick()</h3>
            <p>Each tick, gravity decreases vertical velocity: <code>velocityY -= gravity</code>, and the height updates: <code>posY += velocityY</code>.</p>
            <p><strong>Your Task:</strong> Create a function <code>simulateFall(startY, startVelocity, gravity, ticks)</code> that simulates falling across the specified number of ticks and returns the final <code>posY</code>.</p>
          `,
          initialCode: "function simulateFall(startY, startVelocity, gravity, ticks) {\n  let y = startY;\n  let vy = startVelocity;\n  // Simulate loop\n  return y;\n}\n",
          hint: "for (let i = 0; i < ticks; i++) { vy -= gravity; y += vy; } return y;",
          runTest: (code) => {
            try {
              const res = new Function(code + "\nreturn simulateFall(100, 0, 9.8, 2);")();
              
              
              if (Math.abs(res - 70.6) < 0.001) return { pass: true };
              return { pass: false, error: `Expected 70.6, got ${res}` };
            } catch (err) {
              return { pass: false, error: err.message };
            }
          }
        }
      ]
    },
    {
      title: "Unit 5: Data Persistence with KVStore",
      subtitle: "Saving & Loading Stats Across Player Sessions",
      lessons: [
        {
          id: "u5_l1",
          title: "1. Storing Player Stats",
          icon: "fa-database",
          xp: 50,
          theory: `
            <h3>KVStore Data Persistence</h3>
            <p>The <code>KVStore</code> library provides persistent key-value storage for player coins, levels, and inventory.</p>
            <pre><code>KVStore.set(playerId, key, value)</code></pre>
            <p><strong>Your Task:</strong> Write a function <code>giveCoins(playerId, amount)</code> that retrieves the player's current coins using <code>KVStore.get(playerId, "coins", 0)</code>, adds <code>amount</code>, and saves it with <code>KVStore.set(playerId, "coins", newAmount)</code>.</p>
          `,
          initialCode: "function giveCoins(playerId, amount) {\n  // Load, add, and save\n}\n",
          hint: "const current = KVStore.get(playerId, 'coins', 0); KVStore.set(playerId, 'coins', current + amount);",
          runTest: (code) => {
            const memory = {};
            const mockKV = {
              get: (id, k, def) => (memory[id] && memory[id][k] !== undefined ? memory[id][k] : def),
              set: (id, k, val) => {
                if (!memory[id]) memory[id] = {};
                memory[id][k] = val;
              }
            };
            try {
              new Function("KVStore", code + "\ngiveCoins('p1', 50); giveCoins('p1', 25);")(mockKV);
              if (mockKV.get('p1', 'coins', 0) === 75) return { pass: true };
              return { pass: false, error: `Expected 75 coins stored, got ${mockKV.get('p1', 'coins', 0)}` };
            } catch (err) {
              return { pass: false, error: err.message };
            }
          }
        }
      ]
    },
    {
      title: "Unit 6: Procedural WorldGen & RoomGen",
      subtitle: "Voxel Heightmaps and Structure Placement",
      lessons: [
        {
          id: "u6_l1",
          title: "1. 2D Heightmap Generation",
          icon: "fa-mountain-sun",
          xp: 60,
          theory: `
            <h3>Generating Terrain with Math</h3>
            <p>Procedural terrain determines surface height using mathematical trigonometric waves.</p>
            <p><strong>Your Task:</strong> Write a function <code>getTerrainHeight(x, z, baseHeight, amplitude)</code> that returns <code>Math.floor(baseHeight + Math.sin(x * 0.1) * amplitude + Math.cos(z * 0.1) * amplitude)</code>.</p>
          `,
          initialCode: "function getTerrainHeight(x, z, baseHeight, amplitude) {\n  // return calculated height\n}\n",
          hint: "return Math.floor(baseHeight + Math.sin(x * 0.1) * amplitude + Math.cos(z * 0.1) * amplitude);",
          runTest: (code) => {
            try {
              const res = new Function(code + "\nreturn getTerrainHeight(0, 0, 64, 10);")();
              
              if (res === 74) return { pass: true };
              return { pass: false, error: `Expected height 74, got ${res}` };
            } catch (err) {
              return { pass: false, error: err.message };
            }
          }
        }
      ]
    },
    {
      title: "Unit 7: Mob AI & Pathfinder Integration",
      subtitle: "A* Pathfinding and Autonomous Entity Navigation",
      lessons: [
        {
          id: "u7_l1",
          title: "1. Mob Path Following in tick()",
          icon: "fa-route",
          xp: 65,
          theory: `
            <h3>Autonomous Mob AI</h3>
            <p>Mobs follow a list of waypoints step-by-step each tick cycle.</p>
            <p><strong>Your Task:</strong> Write a class <code>MobNavigator</code> with a constructor that takes <code>waypoints</code> array, and a method <code>nextStep()</code> that removes and returns the first waypoint (using <code>shift()</code>) or returns <code>null</code> if waypoints is empty.</p>
          `,
          initialCode: "class MobNavigator {\n  constructor(waypoints) {\n    this.waypoints = [...waypoints];\n  }\n  nextStep() {\n    // return next waypoint or null\n  }\n}\n",
          hint: "return this.waypoints.length > 0 ? this.waypoints.shift() : null;",
          runTest: (code) => {
            try {
              const runner = new Function(code + "\nconst m = new MobNavigator([[0,0,0], [1,0,0]]); const s1 = m.nextStep(); const s2 = m.nextStep(); const s3 = m.nextStep(); return { s1, s2, s3 };")();
              if (runner.s1 && runner.s1[0] === 0 && runner.s2 && runner.s2[0] === 1 && runner.s3 === null) {
                return { pass: true };
              }
              return { pass: false, error: "nextStep() did not return sequential waypoints and null when done." };
            } catch (err) {
              return { pass: false, error: err.message };
            }
          }
        }
      ]
    }
  ];
