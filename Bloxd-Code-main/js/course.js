
import { showToast } from "./app.js";
import { userProfile, saveUserProfile } from "./auth.js";

export const COURSE_MODULES = [
  {
    id: "unit-1",
    title: "Unit 1: JavaScript Foundations for Bloxd",
    subtitle: "Variables, Functions, and Math",
    lessons: [
      {
        id: "lesson_1_1",
        title: "Variables & Coordinates",
        icon: "fa-cube",
        xp: 25,
        instructions: "In Bloxd scripting, 3D positions are represented as 3-element arrays `[x, y, z]`.\n\nCreate a variable named `spawnPoint` containing the coordinate array `[0, 10, 0]`.",
        initialCode: "// Define the spawnPoint variable below\n",
        solutionKeywords: ["spawnPoint", "0", "10"],
        testFn: (code) => {
          if (!code.includes("spawnPoint")) return "Variable 'spawnPoint' not defined.";
          try {
            const runner = new Function(code + "\nreturn spawnPoint;");
            const res = runner();
            if (Array.isArray(res) && res[0] === 0 && res[1] === 10 && res[2] === 0) {
              return true;
            }
            return "spawnPoint should equal [0, 10, 0]";
          } catch (e) {
            return "Syntax error in code: " + e.message;
          }
        },
        hint: "let spawnPoint = [0, 10, 0];"
      },
      {
        id: "lesson_1_2",
        title: "Functions & Player Greeting",
        icon: "fa-terminal",
        xp: 30,
        instructions: "Write a function named `formatWelcome` that takes a `playerName` parameter and returns `'Welcome to Bloxd, ' + playerName + '!'`.",
        initialCode: "function formatWelcome(playerName) {\n  // return welcome string\n}\n",
        solutionKeywords: ["function", "formatWelcome", "return"],
        testFn: (code) => {
          try {
            const runner = new Function(code + "\nreturn formatWelcome('Mango');");
            const res = runner();
            if (res === "Welcome to Bloxd, Mango!") return true;
            return `Expected "Welcome to Bloxd, Mango!", got "${res}"`;
          } catch(e) {
            return "Error executing function: " + e.message;
          }
        },
        hint: "return `Welcome to Bloxd, ${playerName}!`;"
      }
    ]
  },
  {
    id: "unit-2",
    title: "Unit 2: ES Module Imports & Libraries",
    subtitle: "Importing Bloxd-Libs without setTimeout/setInterval",
    lessons: [
      {
        id: "lesson_2_1",
        title: "Importing MathLib",
        icon: "fa-file-import",
        xp: 40,
        instructions: "In Bloxd.io, libraries are imported using ES module syntax without the `.js` extension.\n\nWrite an import statement to import `MathLib` from `./MathLib`.",
        initialCode: "// Write your import statement below\n",
        solutionKeywords: ["import", "MathLib", "from", "./MathLib"],
        testFn: (code) => {
          const clean = code.replace(/\s+/g, " ").trim();
          if (clean.includes(".js")) return "Do NOT include '.js' in the import path in Bloxd!";
          if (/import\s*\{\s*MathLib\s*\}\s*from\s*["']\.\/MathLib["']/i.test(clean) ||
              /import\s+MathLib\s+from\s*["']\.\/MathLib["']/i.test(clean)) {
            return true;
          }
          return "Code must be: import { MathLib } from \"./MathLib\"";
        },
        hint: 'import { MathLib } from "./MathLib"'
      },
      {
        id: "lesson_2_2",
        title: "Multi-Library Imports",
        icon: "fa-layer-group",
        xp: 45,
        instructions: "Import both `WorldGen` from `./WorldGen` and `Pathfinder` from `./Pathfinder`.",
        initialCode: "// Import WorldGen and Pathfinder below\n",
        solutionKeywords: ["WorldGen", "Pathfinder", "import"],
        testFn: (code) => {
          if (code.includes(".js")) return "Remember not to use '.js' in Bloxd import paths!";
          const hasWorldGen = /import\s*\{\s*WorldGen\s*\}\s*from\s*["']\.\/WorldGen["']/i.test(code);
          const hasPathfinder = /import\s*\{\s*Pathfinder\s*\}\s*from\s*["']\.\/Pathfinder["']/i.test(code);
          if (hasWorldGen && hasPathfinder) return true;
          return "Make sure both WorldGen and Pathfinder are imported correctly.";
        },
        hint: 'import { WorldGen } from "./WorldGen"\nimport { Pathfinder } from "./Pathfinder"'
      }
    ]
  },
  {
    id: "unit-3",
    title: "Unit 3: Bloxd Core API (bloxd.io/docs)",
    subtitle: "Broadcasting, Entity Positions & Block Manipulation",
    lessons: [
      {
        id: "lesson_3_1",
        title: "Broadcasting Messages",
        icon: "fa-bullhorn",
        xp: 50,
        instructions: "The Bloxd API exposes `api.broadcastMessage(message)` to send announcements to all players in the world.\n\nCall `api.broadcastMessage` with `'Game Starting in 5 Seconds!'`.",
        initialCode: "// Simulated api object provided\napi.broadcastMessage = (msg) => { window.__lastMsg = msg; };\n\n// Call api.broadcastMessage below:\n",
        solutionKeywords: ["api.broadcastMessage"],
        testFn: (code) => {
          if (code.includes("setTimeout") || code.includes("setInterval")) {
            return "Do not use setTimeout or setInterval in Bloxd scripts!";
          }
          try {
            window.__lastMsg = null;
            const runner = new Function(code);
            runner();
            if (window.__lastMsg === "Game Starting in 5 Seconds!") return true;
            return `Expected message 'Game Starting in 5 Seconds!', got '${window.__lastMsg}'`;
          } catch(e) {
            return "Execution error: " + e.message;
          }
        },
        hint: 'api.broadcastMessage("Game Starting in 5 Seconds!");'
      },
      {
        id: "lesson_3_2",
        title: "Getting Entity Position & math",
        icon: "fa-location-crosshairs",
        xp: 50,
        instructions: "Write a function `isPlayerHigh(entityId)` that retrieves the player's 3D position using `api.getPosition(entityId)` and returns `true` if the Y coordinate (index 1) is greater than 100, otherwise `false`.",
        initialCode: "function isPlayerHigh(entityId) {\n  // api.getPosition(id) returns [x, y, z]\n}\n",
        solutionKeywords: ["api.getPosition"],
        testFn: (code) => {
          try {
            const mockApi = `
              const api = {
                getPosition: (id) => id === 1 ? [10, 150, 20] : [10, 50, 20]
              };
            `;
            const runner = new Function(mockApi + code + "\nreturn [isPlayerHigh(1), isPlayerHigh(2)];");
            const res = runner();
            if (res[0] === true && res[1] === false) return true;
            return "Function failed test with Y=150 (expected true) or Y=50 (expected false).";
          } catch (e) {
            return "Error: " + e.message;
          }
        },
        hint: "let pos = api.getPosition(entityId);\nreturn pos[1] > 100;"
      }
    ]
  },
  {
    id: "unit-4",
    title: "Unit 4: The Game Loop (tick())",
    subtitle: "Game Loop Timing & State Without setTimeout",
    lessons: [
      {
        id: "lesson_4_1",
        title: "The tick() Execution Loop",
        icon: "fa-rotate",
        xp: 60,
        instructions: "Bloxd executes the global `tick()` function every single frame/server tick instead of timers.\n\nCreate a global counter `tickCount = 0` and a `tick()` function that increments `tickCount` by 1 each time it runs.",
        initialCode: "let tickCount = 0;\n\nfunction tick() {\n  // increment tickCount\n}\n",
        solutionKeywords: ["tick", "tickCount"],
        testFn: (code) => {
          if (code.includes("setTimeout") || code.includes("setInterval")) {
            return "Bloxd scripts rely on tick() instead of setTimeout/setInterval!";
          }
          try {
            const runner = new Function(code + "\ntick(); tick(); tick(); return tickCount;");
            const res = runner();
            if (res === 3) return true;
            return `Expected tickCount to be 3 after 3 ticks, got ${res}`;
          } catch(e) {
            return "Error: " + e.message;
          }
        },
        hint: "function tick() { tickCount++; }"
      }
    ]
  }
];

let activeLesson = null;
let completedLessons = JSON.parse(localStorage.getItem("bloxd_completed_lessons") || "[]");

 
export function initAcademy() {
  updateAcademyStats();
  renderCoursePath();
  setupChallengeModalEvents();
}

 
function updateAcademyStats() {
  const xpEl = document.getElementById("academy-xp-count");
  const streakEl = document.getElementById("academy-streak-count");
  const completedCount = completedLessons.length;

  const totalXp = (userProfile?.stats?.xp || 50) + (completedCount * 30);
  if (xpEl) xpEl.textContent = `${totalXp} XP`;
  if (streakEl) streakEl.textContent = `${Math.max(1, completedCount)} Days`;
}

 
export function renderCoursePath() {
  const container = document.getElementById("academy-path");
  if (!container) return;

  container.innerHTML = COURSE_MODULES.map(unit => {
    const lessonsHtml = unit.lessons.map((lesson, idx) => {
      const isCompleted = completedLessons.includes(lesson.id);
      const isUnlocked = isCompleted || idx === 0 || completedLessons.includes(unit.lessons[idx - 1]?.id);
      
      let stateClass = "locked";
      if (isCompleted) stateClass = "completed";
      else if (isUnlocked) stateClass = "active";

      return `
        <div class="lesson-node-wrapper">
          <div class="lesson-node ${stateClass}" onclick="openLesson('${lesson.id}')">
            <i class="fa-solid ${lesson.icon}"></i>
            ${isCompleted ? '<span class="crown-badge"><i class="fa-solid fa-check"></i></span>' : ''}
          </div>
          <span class="lesson-tooltip">${escapeHtml(lesson.title)}</span>
        </div>
      `;
    }).join("");

    return `
      <div style="width: 100%;">
        <div class="unit-banner">
          <div>
            <div class="unit-title">${escapeHtml(unit.title)}</div>
            <div class="unit-subtitle">${escapeHtml(unit.subtitle)}</div>
          </div>
          <i class="fa-solid fa-graduation-cap" style="font-size: 28px; opacity: 0.8;"></i>
        </div>
        <div style="display: flex; flex-direction: column; align-items: center; gap: 24px; margin: 24px 0;">
          ${lessonsHtml}
        </div>
      </div>
    `;
  }).join("");
}

 
window.openLesson = function(lessonId) {
  let found = null;
  for (const unit of COURSE_MODULES) {
    for (const l of unit.lessons) {
      if (l.id === lessonId) {
        found = l;
        break;
      }
    }
  }

  if (!found) return;
  activeLesson = found;

  const modal = document.getElementById("course-challenge-modal");
  const title = document.getElementById("challenge-title");
  const instructions = document.getElementById("challenge-instructions");
  const editor = document.getElementById("challenge-code-input");
  const feedback = document.getElementById("challenge-feedback");

  if (title) title.textContent = found.title;
  if (instructions) instructions.innerHTML = found.instructions.replace(/\n/g, "<br>").replace(/`([^`]+)`/g, "<code style='background: rgba(255,255,255,0.1); padding: 2px 4px; border-radius: 4px; color: #818cf8;'>$1</code>");
  if (editor) editor.value = found.initialCode;
  if (feedback) {
    feedback.className = "challenge-feedback";
    feedback.style.display = "none";
  }

  modal?.classList.add("active");
};

 
function setupChallengeModalEvents() {
  const runBtn = document.getElementById("run-challenge-btn");
  const hintBtn = document.getElementById("hint-challenge-btn");
  const feedback = document.getElementById("challenge-feedback");

  if (runBtn) {
    runBtn.onclick = async () => {
      if (!activeLesson) return;
      const code = document.getElementById("challenge-code-input")?.value || "";

      const result = activeLesson.testFn(code);

      if (result === true) {
        
        feedback.className = "challenge-feedback success";
        feedback.innerHTML = `<strong>Nice.</strong> That worked. +${activeLesson.xp} XP.`;
        
        if (!completedLessons.includes(activeLesson.id)) {
          completedLessons.push(activeLesson.id);
          localStorage.setItem("bloxd_completed_lessons", JSON.stringify(completedLessons));
          
          if (userProfile) {
            const currentXp = (userProfile.stats?.xp || 50) + activeLesson.xp;
            const currentLessons = (userProfile.stats?.lessons || 0) + 1;
            await saveUserProfile({ stats: { ...userProfile.stats, xp: currentXp, lessons: currentLessons } });
          }
        }

        updateAcademyStats();
        renderCoursePath();
        showToast(`Lesson Completed! +${activeLesson.xp} XP`, "success");
      } else {
        
        feedback.className = "challenge-feedback error";
        feedback.innerHTML = `<strong>Not quite:</strong> ${escapeHtml(result)}`;
      }
    };
  }

  if (hintBtn) {
    hintBtn.onclick = () => {
      if (activeLesson && activeLesson.hint) {
        showToast(`Hint: ${activeLesson.hint}`, "info");
      }
    };
  }
}

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
