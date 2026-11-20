# CLAUDE.md - BUSINZ Engineering Guidelines

## The 4 Core Principles (Mandatory Engineering Standard)
Derived from Andrej Karpathy's guidelines on LLM coding pitfalls:

### 1. Think Before Coding
- **Don't assume. Don't hide confusion. Surface tradeoffs.**
- State assumptions explicitly before implementing. If uncertain, ASK first.
- If multiple interpretations exist, present them — never pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, STOP. Name what is confusing. Ask.

### 2. Simplicity First
- **Minimum code that solves the problem. Nothing speculative.**
- Write NO features beyond what was explicitly asked.
- NO abstractions for single-use code.
- NO "flexibility" or "configurability" that wasn't requested.
- NO error handling for impossible scenarios.
- If 50 lines solve it, never write 200 lines.
- Ask: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes
- **Touch only what you must. Clean up only your own mess.**
- Do NOT "improve" adjacent code, comments, or formatting.
- Do NOT refactor things that aren't broken.
- Match existing style strictly, even if you would write it differently.
- If you notice unrelated dead code, mention it — do NOT delete it.
- Remove imports/variables/functions that YOUR changes made unused.
- **The Golden Test**: Every changed line in the git diff must trace directly back to the user's request.

### 4. Goal-Driven Execution
- **Define success criteria. Loop until verified.**
- Transform tasks into verifiable goals:
  - "Add validation" → Verify tests/checks for invalid inputs, then make them pass.
  - "Fix the bug" → Reproduce it, then make the check pass.
  - "Refactor" → Ensure checks/builds pass before and after.
- For multi-step tasks, state a brief plan:
  ```
  1. [Step] → verify: [check]
  2. [Step] → verify: [check]
  3. [Step] → verify: [check]
  ```
- Loop independently until verification is 100% complete.

### 5. Zero-Break Live Server Rule (Pre-Push End-to-End Check)
- **No code goes to `dev`, `main`, or the live server unless it is verified end-to-end first. Live users must NEVER face a break caused by our push.**
- Before EVERY `git push` (dev or main), the agent MUST:
  1. Run `npm run build` → must pass with 0 lint errors and a successful Vite build.
  2. Run `node --check` on every changed `server/*.js` file → 0 syntax errors.
  3. Start/restart the local server (`npm run dev` + `node server/index.js`) → verify no startup crash and no new errors in the logs.
  4. Test the changed feature end-to-end on localhost in the affected login(s)/role(s) → it works as requested.
  5. Re-check the related flows the change touches (PI → BOM → Dispatch Packing → Accounts → Invoice → Vehicle Loading, PO/GRN, Inventory, Login/Sessions) → no regressions.
  6. Check API calls for new `401`/`403`/`404`/`500` errors, request loops, or repeated full-table reloads.
  7. Confirm no `server/*.json` runtime files, `.env*`, or secrets are staged.
- If ANY problem is found, fix it and re-run all checks BEFORE pushing. Never push "to fix later".
- Report the results of these checks in the Rule 16 audit checklist and STOP for user approval before pushing.
- If something cannot be verified locally (e.g., live-only data, Zoho, production DB), say so clearly before pushing — never claim it is verified.

