# update-packages

***This project is not complete.***

## Immediate to-dos

1. Allow master config file (as well as CLI) for indication of:
  1. Which repositories (in subdirectories) to include or exclude
  2. Which remotes to push to if any (by default when available and as exceptions)
  1. Option on whether to confirm
1. Implement programmatic equivalent of these commands for each included repo:
  1. ncu -u (checking config file)
  2. npm install
  3. npm audit fix (<https://github.com/Vispercept/run-npm-audit>?), checking user
    or global npm audit config
  3. npm test
  4. git branch master
  5. git add . && git commit -a -m "Upgrade"
  6. git remote
  7. e.g., git push origin && git push upstream

## Possible future to-dos

1. We could configure ncu, branch, commit message, audit fix, and npm script
  by repo (by default when available and as exceptions), but less critical,
  especially for ncu as it accepts config file
2. We might ideally allow subscribing to an RSS feed of security notices so
  as to regularly poll for security updates and upon encountering one which
  was in a cached map of dependencies, would attempt to commit an update
  to that repo.
