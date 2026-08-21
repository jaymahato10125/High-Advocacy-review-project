# AI-Assisted Development — `prompt.md`

## Overview

I used **Gemini Antigravity** as a development assistant throughout the project. I remained responsible for the architecture, implementation decisions, debugging, testing, and final code review.

I did not use AI to generate the entire application in one step. I built the project incrementally and used Gemini when it was useful for implementation, debugging, investigation, testing, and code review.

## Representative Prompts Used

### Initial Implementation

> Read the assignment carefully and help me break it into backend, frontend, database, authentication, bulk operations, testing, and deployment tasks. Identify the important requirements and edge cases I should not miss.

### Database Schema

> Create a MySQL schema for testimonial submissions and notifications based on this assignment. Keep the schema simple but make sure it supports filtering, sorting, search, reviewer actions, and future scaling.

### Review Queue

> Help me implement the reviewer queue. It should support filtering by status, rating, type, date and search, with pagination and sorting. Keep the API efficient enough to work with around 20,000 records.

### Bulk Selection

> Implement the selection logic for the review queue. I need both individual selection and "select all matching the current filter". If the user deselects a few records after selecting all, those IDs should be excluded from the bulk operation.

### Bulk Action Bug

> The bulk approve operation is working for small selections, but I need to make sure it is safe when tens of thousands of records match the filter. Find possible performance, transaction, locking, and idempotency problems in the current implementation and suggest fixes.

### Search Problem

> Search is returning unexpected results for some special characters. Investigate how the current MySQL FULLTEXT query is being built, identify why this is happening, and suggest a safe way to sanitize the search input without breaking normal searches.

### Pagination Problem

> Find potential problems with the current offset pagination implementation. Check page boundaries, invalid page numbers, large offsets, empty results, and page changes after bulk actions.

### Validation Bug

> Find all places where invalid user input could reach the API without being properly validated. Pay special attention to rating, testimonial type, URLs, testimonial length, pagination, sorting, and unexpected JSON values.

### Authorization Problem

> Review the current viewer/reviewer authorization. Try to identify ways a viewer could access pending submissions or call reviewer-only endpoints directly instead of through the UI. The API must enforce authorization independently of the frontend.

### API Error

> This API endpoint is returning an unexpected response. Read the current implementation and identify the most likely cause. Do not rewrite the whole endpoint; explain the issue and propose the smallest safe fix.

### TypeScript Error

> I'm getting this TypeScript compilation error in the following file. Trace the error back to its actual cause, explain why it happens, and suggest a minimal fix that does not change the existing API behavior.

### Test Failure

> This test is failing even though the implementation appears correct. Analyze the test expectation and the actual application behavior. Determine whether the bug is in the implementation or the test itself before suggesting a change.

### Seed Data

> Generate a realistic seed-data strategy for approximately 20,000 testimonial submissions. Include different ratings, testimonial types, companies, dates, statuses, G2 records, long text, Unicode and other edge cases so the application can be tested realistically.

### Performance Investigation

> Review the current database queries used by the review queue. Identify queries that could become slow with 10x the current data and suggest indexes or query changes. Focus on actual query patterns rather than adding indexes unnecessarily.

### Frontend Issue

> The review queue UI becomes inconsistent when filters change while records are selected. Trace the current selection and filter state logic and identify how stale selections can occur. Suggest a fix that keeps the selection behavior predictable.

### Final Code Review

> Review the current implementation against the assignment requirements. Look specifically for missing requirements, hidden edge cases, authorization problems, inefficient database operations, broken empty states, and behavior that could fail when tested with 20,000+ records. Do not rewrite working code unnecessarily; identify concrete issues first.

## Examples of AI Suggestions That Were Incorrect

AI suggestions were always validated against the actual project.

1. **Drizzle FULLTEXT index** — an initial suggestion used an API that was not supported by the installed Drizzle version. I verified the installed package and moved the FULLTEXT index into a custom SQL migration.

2. **Search sanitization** — an initial test had an incorrect expectation about MySQL boolean search behavior. I tested the actual query behavior and corrected the test.

3. **Zod defaults** — an initial approach used `z.enum().default()`, which does not convert invalid values to the default. I changed the implementation to use `.catch()` with appropriate pagination handling.

4. **Incomplete generated code** — one AI-assisted modification left a function incomplete. TypeScript compilation exposed the problem, and I fixed it before continuing.

## Testing & Validation

MySQL was run locally through Docker so database behavior could be tested against a real MySQL instance.

The final test suite includes:

* **41 API tests**
* **5 frontend tests**

I also manually tested:

* search
* filtering
* sorting
* pagination
* bulk selection
* bulk approve/reject
* viewer restrictions
* reviewer actions
* invalid input
* long input
* edge cases
* large seed datasets

## Where Gemini Saved Time

Gemini Antigravity was most useful for:

* exploring implementation approaches
* debugging
* finding edge cases
* generating repetitive tests
* generating seed data
* investigating database queries
* reviewing existing code
* identifying potential problems

I spent more time on the areas requiring engineering judgment, including database design, authorization, bulk operations, transaction handling, performance, and failure cases.

## Final Approach

I treated Gemini Antigravity as a **development assistant and second pair of eyes**, not as the source of truth.

The workflow was:

> **Create → Investigate → Ask → Implement → Test → Find Problems → Fix → Verify**

The final implementation was validated against the actual codebase, TypeScript compiler, MySQL database, automated tests, and runtime behavior.
