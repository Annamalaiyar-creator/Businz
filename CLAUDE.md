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

