\---

name: remove-nul
description: Remove the problematic NUL file created by Windows device name conflicts
---

# Remove NUL File

This skill removes the problematic NUL file that gets created in the repository.

## Purpose

NUL is a reserved device name on Windows (like CON, PRN, AUX, COM1-9, LPT1-9). When accidentally created as a file, it:

* Breaks Git operations
* Causes issues with file system operations
* Shows up in `git status` but can't be easily removed with standard commands
* Can break CLI tools including Claude Code

This skill provides a reliable method to remove it.

## When to Use

Use this skill whenever you see `?? NUL` in git status or encounter errors related to a NUL file.

## Process

### Step 1: Check if NUL File Exists

Check git status to confirm the NUL file is present:

```bash
git status --short
```

Look for `?? NUL` in the output.

### Step 2: Attempt Removal

Try multiple removal methods in sequence:

**Method 1: Direct rm**

```bash
rm -f NUL 2>/dev/null
```

**Method 2: Explicit path rm**

```bash
rm -f ./NUL 2>/dev/null
```

**Method 3: Combined fallback**

```bash
rm -f NUL 2>\&1 || rm -f ./NUL 2>\&1
```

### Step 3: Verify Removal

Check git status again to confirm the file is gone:

```bash
git status --short
```

If the output is empty or doesn't show `?? NUL`, the removal was successful.

### Step 4: Report Success

Inform the user that the NUL file has been successfully removed.

## Prevention Tips

To avoid creating NUL files in the future:

**DON'T:**

* Never redirect to `NUL` in bash commands on Windows
* Don't use Windows device names (NUL, CON, PRN, AUX, COM1-9, LPT1-9) as filenames
* Avoid using `> NUL` in bash (this is PowerShell/CMD syntax)

**DO:**

* Use `/dev/null` for suppressing output in bash
* Use `2>/dev/null` to suppress stderr
* Use `>/dev/null 2>\&1` to suppress all output

## Example Command Patterns

**Bad (creates NUL file):**

```bash
some-command > NUL
```

**Good (proper null device):**

```bash
some-command > /dev/null
```

## Technical Notes

* NUL is a Windows device name that maps to the null device
* When used in Git Bash, it can create an actual file named "NUL" instead of redirecting to the device
* The file appears in git status but standard removal commands may fail
* The `rm -f` command usually works but may need explicit path or multiple attempts
* Windows reserves these names: CON, PRN, AUX, NUL, COM1-COM9, LPT1-LPT9

## Quick Reference

**Single command to remove NUL:**

```bash
rm -f NUL 2>\&1 || rm -f ./NUL 2>\&1
```

**Check if gone:**

```bash
git status --short
```

## Edge Cases

**If removal fails:**

* Try running the command multiple times
* Check file permissions
* Ensure no processes have the file open
* As last resort, use Windows Explorer to delete (may require special syntax like `\\\\.\\C:\\path\\to\\NUL`)

**If file keeps reappearing:**

* Review recent commands for accidental `> NUL` redirects
* Check scripts or aliases that might be creating it
* Remind Claude Code to use `/dev/null` instead of `NUL`

