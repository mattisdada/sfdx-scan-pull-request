/*
   Copyright 2022 Mitch Spano
   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at
	 https://www.apache.org/licenses/LICENSE-2.0
   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
 */

import parse from "parse-diff";
import { simpleGit } from "simple-git";
import { context } from "@actions/github";

const DESTINATION_REMOTE_NAME = "destination";

export type GithubPullRequest = typeof context.payload.pull_request | undefined;

export const git = simpleGit({
  baseDir: process.cwd(),
  binary: "git",
  maxConcurrentProcesses: 6,
  trimmed: false,
});

/**
 * @description Calculates the diff for all files within the pull request and
 * populates a map of filePath -> Set of changed line numbers
 */
export async function getDiffInPullRequest(
  diffArgs: string[],
  destination?: string
) {
  console.log("Getting difference within the pull request ...", diffArgs);
  if (destination) {
    await git.addRemote(DESTINATION_REMOTE_NAME, destination);
    await git.remote(["update"]);
  }

  diffArgs = diffArgs
    .filter((arg) => arg)
    .map(
      (diffArg, index) =>
        `${index === 0 ? "origin" : DESTINATION_REMOTE_NAME}/${diffArg}`
    );

  const diffString = await git.diff(diffArgs);
  const files = parse(diffString);

  const filePathToChangedLines = new Map<string, Set<number>>();
  for (let file of files) {
    if (file.to && file.to !== "/dev/null") {
      const changedLines = new Set<number>();
      for (let chunk of file.chunks) {
        for (let change of chunk.changes) {
          if (change.type === "add" || change.type === "del") {
            changedLines.add(change.ln);
          }
        }
      }
      filePathToChangedLines.set(file.to, changedLines);
    }
  }
  return filePathToChangedLines;
}
