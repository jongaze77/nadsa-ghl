# /quickcommit - Fast Commit and Push

Execute a quick commit and push workflow for rapid development iterations.

## Workflow Steps:

1. **Stage all changes**: `git add -A`
2. **Create commit**: With user message + Claude Code signature
3. **Push changes**: `git push` to current branch

## Usage:
```
/quickcommit [message]
```

Example:
```
/quickcommit "Fix navigation bug in header component"
```

## Implementation:
When user types `/quickcommit [message]`, execute:
1. `git add -A`
2. `git commit -m "[message] 🤖 Generated with [Claude Code](https://claude.ai/code) Co-Authored-By: Claude <noreply@anthropic.com>"`
3. `git push`

Handle cases where no message is provided by prompting the user.