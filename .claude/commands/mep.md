---
description: Convert verbose prompt to MEP (Minimal Effective Prompt)
---

# MEP - Minimal Effective Prompt

## Context

User's original prompt:
```
$ARGUMENTS
```

## Your Task

Analyze the user's prompt above and refactor it into a **Minimal Effective Prompt (MEP)** that:

### Remove Unnecessary Context
❌ Remove information that AI already knows:
- Current date/time (AI has access via hooks)
- System information (platform, CPU, memory - provided automatically)
- Project structure (AI can search codebase)
- Tech stack (AI can detect from package.json and code)
- File locations (AI can search)
- Existing code patterns (AI can search codebase)

### Keep Essential Information
✅ Keep only what AI cannot infer:
- Specific business requirements
- User preferences or constraints
- Domain-specific knowledge
- Desired outcome or behavior
- Acceptance criteria

### Apply MEP Principles

1. **Be Specific About What, Not How**
   - ❌ "Create a React component with useState hook, useEffect for data fetching, proper error handling..."
   - ✅ "Add user profile page with real-time data"

2. **Trust AI's Knowledge**
   - ❌ "Using TypeScript with proper types, following our code style..."
   - ✅ "Add user authentication" (AI will use TypeScript, follow existing patterns)

3. **Focus on Intent**
   - ❌ "I need a function that takes an array and returns unique values using Set..."
   - ✅ "Remove duplicate items from the list"

4. **Remove Redundancy**
   - ❌ "Add comprehensive error handling with try-catch blocks and proper error messages..."
   - ✅ "Add error handling" (comprehensive is default)

### Output Format

Provide the refactored MEP prompt as a single, concise statement (1-3 sentences max) that captures the essence of the user's intent.

**Original:** [quote the original]

**MEP Version:** [your refactored minimal prompt]

**Removed Context:** [list what was removed and why - explain that AI already has this info]

**Preserved Intent:** [confirm the core requirement is maintained]
