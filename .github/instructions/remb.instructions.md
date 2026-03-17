---
applyTo: "**"
---
<!-- remb-instructions:v1 -->
# Remb — AI Context Management

You have access to Remb tools for persistent memory and context across coding sessions.
Current project: **worldstreet-dashboard-revamp**

## Session Protocol (MANDATORY — follow every session)

### Session Start (do FIRST, before any other work):
1. Call `remb_loadProjectContext` — loads the full project context bundle (memories, features, tech stack)
2. Call `remb_conversationHistory` — loads what was discussed and accomplished in prior sessions

### During Work:
3. Call `remb_conversationLog` after completing any significant task, bug fix, or feature
4. Call `remb_createMemory` when you discover important patterns, architectural decisions, or gotchas

### Session End (do LAST, before the conversation ends):
5. Call `remb_conversationLog` with a summary of what was asked, what was done, and key decisions made

Skipping these steps causes knowledge loss across sessions. Follow them automatically.

## Available Tools

| Tool | Purpose |
|------|---------|
| `remb_loadProjectContext` | Full project context bundle — memories, features, tech stack |
| `remb_conversationHistory` | Prior session history — what was done before |
| `remb_conversationLog` | Record work done in this session |
| `remb_saveContext` | Save feature-specific context or decisions |
| `remb_getContext` | Retrieve context for a specific feature |
| `remb_listMemories` | Browse persistent memories |
| `remb_createMemory` | Save a new persistent memory |
| `remb_triggerScan` | Re-scan the codebase from GitHub |
| `remb_scanStatus` | Check scan progress |

## When to Use Each Tool

- **Starting work**: `remb_loadProjectContext` + `remb_conversationHistory`
- **Finished a task**: `remb_conversationLog` with what was accomplished
- **Found a pattern**: `remb_createMemory` with category "pattern"
- **Made a decision**: `remb_createMemory` with category "decision" or `remb_saveContext`
- **Need feature info**: `remb_getContext` filtered by feature name
- **Code changed significantly**: `remb_triggerScan` to refresh context
