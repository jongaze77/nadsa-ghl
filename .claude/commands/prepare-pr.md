# /prepare-pr - Prepare for Pull Request

Prepare current branch for pull request creation by committing changes and pushing to remote.

## Workflow Steps:

1. **Stage all changes**: `git add -A`
2. **Get commit message**: Ask user for commit message
3. **Create commit**: With Claude Code signature
4. **Push to feature branch**: `git push -u origin [current-branch]` (set upstream if needed)
5. **PR Option**: Ask user if they want to create PR now or later

## Usage:
```
/prepare-pr
```

## Implementation:
When user types `/prepare-pr`, execute:
1. `git add -A`
2. Prompt: "Enter commit message for PR preparation:"
3. `git commit -m "[user message] 🤖 Generated with [Claude Code](https://claude.ai/code) Co-Authored-By: Claude <noreply@anthropic.com>"`
4. `git push -u origin [current-branch]`
5. Ask: "Would you like me to create a pull request now? (y/n)"

If user says yes to PR creation, proceed with `gh pr create` workflow.