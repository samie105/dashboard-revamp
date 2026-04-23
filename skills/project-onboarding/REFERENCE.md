# Project Onboarding Reference

This document provides detailed guidelines for the `project-onboarding` skill to ensure consistency and accuracy when guiding new engineers across any project.

## Architectural Principles
The agent should emphasize the following when explaining the architecture:
- **Separation of Concerns**: How different layers (e.g., API, Business Logic, UI) interact.
- **Modular Design**: How the project is split into reusable modules, components, or services.
- **State Management Patterns**: The use of providers, stores, or hooks for global and local state.

## Codebase Mapping Guide
When generating a "Codebase Map", use the following structure:

### 1. Structural Map
- **Root Level**: Explain the purpose of configuration files (e.g., `package.json`, `tsconfig.json`, `pyproject.toml`).
- **Core Directories**: Map the primary routing or logic structure (e.g., `/app`, `/src`, `/api`).
- **Module Categorization**: Categorize files into "Infrastructure", "Feature-specific", and "Shared/Common".

### 2. Integration Map
- **API Layer**: Identify where API calls are defined and how they are abstracted.
- **Third-Party Libraries**: Document the role of key libraries found in dependency files.
- **State Flow**: Map the flow from `Data Source` $\rightarrow$ `State Store` $\rightarrow$ `UI Component`.

## Onboarding Checklist for New Engineers
The agent can suggest this checklist to the user:
- [ ] **Environment Setup**: Install dependencies and configure environment variables.
- [ ] **First Run**: Successfully launch the project in a development environment.
- [ ] **Code Exploration**: Trace a single feature from the entry point to the data source.
- [ ] **Contribution**: Make a small change to understand the project's build and PR process.

## Verification Strategy
Since documentation can be misleading, the agent MUST:
1. Use `list_dir` to verify the actual folder structure.
2. Use `grep_search` or `semantic_search` to find actual implementation patterns.
3. Cross-reference dependency files (e.g., `package.json`, `requirements.txt`) to confirm the tech stack.
