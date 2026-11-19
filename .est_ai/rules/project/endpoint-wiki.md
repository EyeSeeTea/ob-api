# Endpoint wiki

The [GitHub wiki](https://github.com/EyeSeeTea/ob-api/wiki) is the team guide to the ob-api endpoints. It must match the code.

- A change that adds, removes or renames a resource method, or an endpoint key in `src/api/endpoints.ts`, must update the wiki page of that resource and, if a task changed, the task table on `Home`.
- A change to the input fields, the result fields, the request method or the path of an endpoint must update its wiki row, its inputs and its examples.
- New OpenBoxes behavior that a live check finds (an error status, a field that OpenBoxes ignores) must go in `Known-OpenBoxes-issues`.
- Each wiki example must compile against the changed code: put the examples in a scratch file under `src/`, run `yarn typecheck`, then delete the file.
- The wiki is a shared system (`process.md` → _Shared systems_): prepare the wiki commit, and push it only after the developer approves. Push it after the code PR is merged, or say in the PR description that the wiki commit is ready.
- The review reports a missing wiki update as **Must fix** when the change matches one of the first 3 items. The PR description must list the wiki pages that changed, or say "Wiki: no change".
