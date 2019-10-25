# CHANGES for update-packages

## ?

- npm: Update deps (chunk-promises, isomorphic-git, npm) and devDeps

## 0.2.0

- Feature: Make genuine binary
- Feature: Move `token` to separate file so can share configs without concern
- Feature: Take into account ncurc files
- Feature: Reporting summary of errors
- Feature: Report file retrieval and processing
- Chunk promises and allow `limit`
- Allow multiple repositories by CLI
- Command-line-usage docs
- Add `duration` and `skipErring` options checking against any previous report
- update-notifier
- Customizable commit message
- Report non-found remote names
- update deps/devDeps
- Return --version
- Allow -h alias
- Throw errors early if problems with config/report file retrieval
    or git repository listing retrieval
- Misc. other fixes

## 0.1.1

- Fix: Parse git@-style URLs
- Temporarily only allow pushing to origin

## 0.1.0

- Initial version with minimal functionality
