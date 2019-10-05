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
    1. Push to `origin`
    <!--
    1. Get remote names
    1. Push to each relevant remote
    -->

## To-dos

1. Make **final report of tasks completed** (at end), sorted by stage of
    final failure (if any); optionally save to status file including
    time checked and repos checked (if in sequence)
1. Find an approach for **chunking/timing tasks** to avoid heap error.
    1. Break up **Promises to be sequential**
    2. **Resume** from checking pre-existing status file; check when the
        repos have been checked with config/default to update
        past certain duration and their state (so non-erring ones
        aren't checking again), and if within duration, optionally still
        **check erring ones**, etc.)
    1. Document **scripts for querying JSON** out of that report file
        (e.g., to find when last queried); currently using `jq` (though
        see <https://github.com/s3u/JSONPath/issues/105> for desired
        jsonpath-plus support)?
    1. Allow **limit** to number of Promises
1. **Configuration**
    1. Support pushing to **multiple and alternate remote names** besides
        `origin`.
    1. **Test master config file** (as well as CLI) for indication of:
      1. Ensure still getting `token`
      1. Ensure `npm-check-updates` is taking into account `ncurc` files!
      1. Which **repositories to include or exclude** (in subdirectories)
      1. Which **remotes to push to** if any (by default when available and as
          exceptions)
    1. Add **global commit message** option (with template on info re: devDep
        vs. dep.?) and npm script to run (in place of test)
    1. We could **configure by repo** the following: ncu, branch, commit
        message, audit fix, and npm script (by default when available and as
        exceptions), but this is less critical, especially for ncu as it
        accepts config file

## Possible future to-dos

1. Allow optional **`npm version`/`semver`** (which can bump version as
    appropriate per versions updated, do **tagging** (including a commit
    template with `%s` as variable for version number)) and/or
    **publishing** via `npm publish`
1. Add **tests**
1. Add a **confirm updates option**
1. **Collect and report back deprecated warnings** for outdated/renamed
    packages ([not performed currently](https://github.com/tjunnone/npm-check-updates/issues/397)
    by `npm-check-updates`); one can get info on a package with `npm view <package name> deprecated --json` (to get JSON string (e.g., `opn-cli`) or get nothing
    if not deprecated) but doesn't seem to show with `npm ls` or extended
    `npm la`.
1. We might ideally allow **subscribing to an RSS feed of security notices**
    so as to regularly poll for security updates and upon encountering one
    which was in a cached map of dependencies, would attempt to commit an
    update to that repo.
