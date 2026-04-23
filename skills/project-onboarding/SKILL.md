---
name: project-onboarding
description: Guides new engineers through any codebase to accelerate onboarding. Use when a new developer joins a project or when a comprehensive architectural overview and codebase map is needed for an unfamiliar repository.
---

# Project Onboarding

## Quick start
To onboard a new engineer, use the following prompt:
"I am new to this project. Please provide a guided tour of the codebase and generate a comprehensive codebase map including architecture, state management, and API integrations."

## Workflows

### 1. The Guided Tour
Follow these steps to introduce the project:
- [ ] **High-Level Overview**: Explain the project's purpose and core value proposition based on README and project files.
- [ ] **Architecture Walkthrough**: Describe the folder structure and the relationship between different modules or services (e.g., frontend vs backend).
- [ ] **Tech Stack Deep Dive**: Identify core libraries, frameworks, and third-party integrations by analyzing dependency files.
- [ ] **Data Flow Analysis**: Explain how data moves from the API/Database to the UI (State Management).
- [ ] **Key Entry Points**: Point out the main entry files, routing logic, and critical service layers.

### 2. Generating the Codebase Map
When generating the map, the agent must:
- [ ] **Analyze the Codebase**: Use `semantic_search` and `list_dir` to verify the current structure (do not rely solely on potentially outdated markdown).
- [ ] **Map Components/Modules**: Create a visual or structured representation of the module hierarchy.
- [ ] **Map API Surface**: List primary API endpoints and their corresponding service implementations.
- [ ] **Map State**: Document where global state resides and how it is updated.
- [ ] **Identify Dependencies**: List critical third-party libraries and their roles.

## Advanced features
For detailed onboarding checklists and specific architectural patterns, see [REFERENCE.md](REFERENCE.md).
