# /finalize - Complete Story Workflow

Execute the complete story finalization sequence with proper git workflow.

## Workflow Steps:

1. **Get commit message**: Ask user for any final commit message details
2. **Stage all changes**: `git add -A`
3. **Create commit**: With Claude Code signature
4. **Push to feature branch**: `git push -u origin [current-branch]`
5. **Switch to main**: `git checkout main` 
6. **Pull latest main**: `git pull origin main`
7. **Merge feature branch**: `git merge [feature-branch]`
8. **Push updated main**: `git push origin main`
9. **Cleanup**: `git branch -d [feature-branch]`
10. **Final status**: `git status` to confirm clean state

## Usage:
```
/finalize
```

## Implementation:
When user types `/finalize`, execute each step in sequence, handling errors appropriately and confirming success at each stage.