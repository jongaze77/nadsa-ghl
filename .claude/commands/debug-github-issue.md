# Debug GitHub Issue Command

This command implements systematic debugging for GitHub issues using issue comments as the debug log location, combining structured investigation with team collaboration.

## Usage
`/debug-github-issue [issue-number]` - Start or continue debugging a specific GitHub issue

## Overview

This hybrid command merges the systematic debugging approach from `debug-issue.md` with GitHub issue integration from `fix-github-issues.md`. Instead of local markdown files, **all debug progress is tracked in GitHub issue comments**, providing:

- **Centralized tracking** - Debug info stays with the issue
- **Team visibility** - Real-time progress updates
- **Persistent history** - Comments preserved even if local files lost
- **Collaborative debugging** - Team members can contribute insights
- **Automatic linking** - Debug commits reference issue number

## How It Works

### Phase 0: GitHub Issue Setup & Validation
1. **Fetch issue details**: `gh issue view [issue-number]`
2. **Validate issue exists** and is open
3. **Check for existing debug session** in issue comments
4. **Preserve current work**: Create safety stash or commit before any destructive operations
5. **Post initial debug comment** to claim the issue
6. **Create debug branch**: `debug/issue-${issue-number}-YYYY-MM-DD`
7. **Safety checks**: Ensure clean working directory (after preservation)

### Phase 1: Investigation Planning
- **Analyze issue description** and reproduction steps
- **Search codebase** for relevant files and patterns
- **Post investigation plan** as GitHub comment
- **Set up baseline state** for systematic testing

### Phase 2: Systematic Debug Loop
For each debugging attempt:
1. **Post attempt comment** with hypothesis and expected outcome
2. **Implement focused change** to test hypothesis
3. **Test and document results** in follow-up comment
4. **Commit with structured message**: `Fix #${issue-number}: Attempt N - [hypothesis]`
5. **Evaluate circuit breaker conditions**
6. **Post progress update** or escalation comment

### Phase 3: Circuit Breaker & Escalation
Monitor debug progress through comment analysis:
- **Track attempt count** via comment metadata
- **Detect repeated patterns** in hypothesis approaches
- **Measure information gain** from each attempt
- **Auto-escalate** when thresholds exceeded
- **Tag team members** for collaborative assistance

### Phase 4: Resolution & Documentation
When issue is resolved:
1. **Post resolution comment** with final solution
2. **Create pull request** linking to issue
3. **Update issue status** to resolved
4. **Document lessons learned** for future reference

## GitHub Comment Structure

### Initial Debug Session Comment
```markdown
🔍 **Debug Session Started**

**Issue**: #{issue-number} - {title}
**Debug Branch**: `debug/issue-{issue-number}-YYYY-MM-DD`
**Started**: {timestamp}
**Session ID**: `DEBUG-{issue-number}-{session-counter}`
**Work Preservation**: Previous work committed/stashed before session start

## Investigation Plan
- [ ] {planned step 1}
- [ ] {planned step 2}
- [ ] {planned step 3}

## Circuit Breaker Settings
- Max attempts: 4
- Max repeated approaches: 2
- Total attempt limit: 6
- Auto-escalate on: pattern detection, no progress

---
*This is an automated debug session. Progress will be updated in subsequent comments.*
```

### Debug Attempt Comments
```markdown
## 🧪 Debug Attempt {N} - {timestamp}

**Hypothesis**: {What might be causing this issue}
**Reasoning**: {Why this hypothesis makes sense}
**Expected Result**: {What should happen if hypothesis is correct}

### Actions Taken
- {Specific change 1}
- {Specific change 2}
- Files modified: `{file1.ts}`, `{file2.tsx}`

### Results
**Actual Result**: {What actually happened}
**Commit**: {commit-hash}
**Status**: ✅ Success | ❌ Failed | ⚠️ Partial | 🔄 Needs more testing

### Analysis
**New Information**: {What did we learn from this attempt}
**Next Steps**: {What to try next based on results}

### Circuit Breaker Status
- Attempts made: {N}/6
- Unique hypotheses: {N}
- Information gain: High | Medium | Low | None
- Decision: CONTINUE | ESCALATE | PIVOT
```

### Circuit Breaker Escalation Comment
```markdown
🚨 **Debug Circuit Breaker Triggered**

After {N} attempts, systematic debugging is being escalated:

### Summary of Attempts
{Table of all attempts with results}

### Patterns Detected
- {Pattern 1 that suggests we're stuck}
- {Pattern 2 that indicates need for help}

### Current State
- **Working branch**: `debug/issue-{issue-number}-YYYY-MM-DD`
- **Files modified**: {list}
- **Test status**: {current test results}

### Recommendation
{Specific recommendation for next steps}

@{team-lead} @{relevant-expert} - Could use collaborative input on this issue. All debugging history is preserved in the commits above.

---
*Automated escalation triggered by circuit breaker logic*
```

### Resolution Comment
```markdown
✅ **Issue Resolved**

## Solution Summary
{Brief description of what fixed the issue}

## Root Cause
{What was actually wrong}

## Implementation
- **Working commit**: {commit-hash}
- **Files changed**: {list}
- **Pull request**: #{pr-number}

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual verification complete
- [ ] Edge cases covered

## Lessons Learned
{Key insights for preventing similar issues}

## Prevention
{How to avoid this in the future}

---
*Debug session complete. Branch `debug/issue-{issue-number}-YYYY-MM-DD` preserved for reference.*
```

## Command Implementation

The command follows this workflow:

```bash
# 1. Validate and fetch issue
gh issue view $ISSUE_NUMBER

# 2. Check for existing debug session
gh issue view $ISSUE_NUMBER --comments | grep "🔍 **Debug Session Started**"

# 3. Preserve current work before any destructive operations
if [ -n "$(git status --porcelain)" ]; then
  echo "Preserving current work..."
  git add .
  git commit -m "WIP: Preserving work before debug session for issue #$ISSUE_NUMBER" || \
  git stash push -m "Debug session preservation for issue #$ISSUE_NUMBER - $(date)"
  echo "Work preserved. Can be restored with 'git stash pop' or by checking commit history."
fi

# 4. Create debug branch if not exists  
git checkout -b debug/issue-$ISSUE_NUMBER-$(date +%Y-%m-%d)

# 5. Post initial comment
gh issue comment $ISSUE_NUMBER --body "$INITIAL_DEBUG_COMMENT"

# 6. Begin systematic debugging loop
# ... (investigation and attempts)

# 7. Monitor circuit breaker via comment analysis
# ... (count attempts, detect patterns)

# 8. Escalate or resolve based on results
```

## Circuit Breaker Logic

### Attempt Tracking
- **Parse comments** to count debug attempts
- **Analyze hypothesis patterns** to detect repetition
- **Measure progress** by new information gained
- **Track time spent** on debugging session

### Escalation Triggers
- **4+ failed attempts** with minimal learning
- **2+ repeated hypothesis approaches**
- **6+ total attempts** regardless of uniqueness
- **24+ hours** of debugging time elapsed
- **No progress** in last 3 attempts

### Escalation Actions
1. **Tag relevant team members** based on file ownership
2. **Summarize all attempts** in structured format
3. **Preserve debug branch** for collaborative review
4. **Request specific expertise** based on issue type
5. **Schedule pair debugging** if available

## Integration Features

### Git Integration
- **Branch naming**: `debug/issue-{number}-YYYY-MM-DD`
- **Commit messages**: `Fix #{number}: Attempt N - {hypothesis} - {result}`
- **PR creation**: Auto-links to issue, includes debug summary
- **Tag preservation**: All debug commits preserved for learning

### GitHub CLI Integration
- **Issue fetching**: `gh issue view` for details
- **Comment posting**: `gh issue comment` for all updates
- **Status updates**: `gh issue edit` for labels/assignments
- **PR creation**: `gh pr create` with proper linking

### Team Collaboration
- **@mentions**: Auto-tag relevant team members on escalation
- **Label management**: Add 'debugging', 'needs-help' labels automatically
- **Assignment**: Assign issue to debugger during session
- **Milestone tracking**: Preserve milestone assignments

## Safety & Recovery

### Session Recovery
If local session is interrupted:
1. **Parse issue comments** to reconstruct state
2. **Checkout debug branch** to continue work
3. **Resume from last attempt** based on comment history
4. **Maintain attempt numbering** across interruptions

### Work Preservation
Before starting any debug session:
1. **Check for uncommitted changes** with `git status --porcelain`
2. **Create preservation commit** if changes are ready: `git add . && git commit -m "WIP: ..."`
3. **Create named stash** if changes are incomplete: `git stash push -m "Debug preservation for #issue..."`
4. **Log preservation method** in initial debug comment for reference
5. **Provide recovery instructions** in case of interruption

### Comment Backup
- **Local cache**: Store comment drafts before posting
- **Git preservation**: All debug commits contain comment content
- **Branch protection**: Debug branches never auto-deleted
- **Export capability**: Can export full debug log from comments

## Usage Examples

### Starting New Debug Session
```bash
/debug-github-issue 42

# Creates:
# - Branch: debug/issue-42-2025-01-06
# - Initial comment on issue #42
# - Local session tracking
# - Circuit breaker monitoring
```

### Continuing Existing Session
```bash
/debug-github-issue 42

# Detects existing session and:
# - Switches to existing debug branch
# - Reviews previous attempts from comments
# - Continues attempt numbering
# - Maintains circuit breaker state
```

### During Debug Session
Available commands:
- `/debug-attempt` - Log new debugging attempt (posts comment)
- `/debug-status` - Show current circuit breaker state
- `/debug-escalate` - Force escalation with current state
- `/debug-resolve` - Mark issue as resolved, create PR
- `/debug-abandon` - Abandon session (preserves all history)

## Success Metrics

This command aims to:
- **Eliminate infinite debug loops** through circuit breaker in comments
- **Enable team collaboration** on complex debugging issues
- **Preserve institutional knowledge** in issue history
- **Accelerate resolution** through systematic approach
- **Maintain transparency** of debugging progress
- **Build debugging competency** across the team

## Configuration

Configurable thresholds (via CLAUDE.md or command args):
```markdown
# Debug settings
debug_max_attempts: 4
debug_max_repeated: 2  
debug_total_limit: 6
debug_escalation_tags: ["@team-lead", "@senior-dev"]
debug_time_limit_hours: 24
```

---

**Note**: This command combines the systematic rigor of local debugging with the collaborative benefits of GitHub issue tracking, creating a powerful hybrid approach for complex issue resolution.