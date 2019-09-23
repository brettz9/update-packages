# update-packages

***This project is in an early alpha stage. Please use with extreme caution as this
can alter your local and remote Git repositories, install npm packages, etc. It
is recommended to test with a smaller folder or single repository first.***

The steps that are taken are as follows:

1. Look through command line options and any config file
1. Find and cycle through the (non-hidden and non-excluded) targeted Git
    repository(ies) with `package.json` files.
    1. Get the current branch name and save it for later restoration
    1. If upgrading:
        1. Detect original branch so as to be able to switch back
          to it afterward (including upon error)
        1. Switch to the targeted `branchName` (defaulting to `master`)
    1. Upon erring in any of the following non-recovering steps, switch
        back to the saved branch.
    1. Check for npm package updates, updating if so requested
    1. If not upgrading, stop these steps.
    1. Attempt to run a local npm install (for the updates)
    1. Attempt to run an npm security audit and fix any automatable
        vulnerabilities as possible
    1. Run an npm test against the repository package
    1. Add any unstaged files to Git staging
    1. Attempt local commit (without global credentials)
    1. Upon failing, retrieve global Git config info and use for global
        commit attempt
    1. Get remote names
    1. Push to each relevant remote

## Immediate to-dos

1. Test
  1. Master config file (as well as CLI) for indication of:
    1. Which repositories (in subdirectories) to include or exclude
    1. Which remotes to push to if any (by default when available and as
        exceptions)
1. Add option on whether to confirm updates
1. Make final list at end of tasks completed, sorted by stage of final
    failure (if any)

## Possible future to-dos

1. Add tests
2. We could configure ncu, branch, commit message, audit fix, and npm script
  by repo (by default when available and as exceptions), but less critical,
  especially for ncu as it accepts config file
3. Add global commit message option (with template on info re: devDep vs. dep.?)
  and npm script to run (in place of test)
4. We might ideally allow subscribing to an RSS feed of security notices so
  as to regularly poll for security updates and upon encountering one which
  was in a cached map of dependencies, would attempt to commit an update
  to that repo.
5. Catch deprecated warnings for outdated/renamed packages
