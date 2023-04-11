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

import { getGithubFilePath, getScannerViolationType } from "../common";

import { Octokit } from "@octokit/action";
import { context } from "@actions/github";
import { BaseReporter, GithubCommitComment } from "./reporter.types";
import { ScannerViolation } from "../sfdxCli";

export class CommitCommentsReporter extends BaseReporter<GithubCommitComment> {
  /**
   * Read and write GitHub comments
   * @param optionalBody Body is required when writing a new comment
   * @private
   */
  private performGithubRequest<T>(optionalBody?: GithubCommitComment) {
    const octokit = new Octokit();
    const owner = context.repo.owner;
    const repo = context.repo.repo;
    const commit_sha = this.context.sha;

    const endpoint = `/repos/${owner}/${repo}/commits/${commit_sha}/comments`;

    return octokit.request(endpoint, optionalBody) as Promise<T>;
  }

  /**
   * @description Writes the relevant comments to the GitHub pull request.
   * Uses the octokit to post the comments to the PR.
   */
  async write() {
    console.log("Writing commit comments using GitHub REST API...");

    for (let comment of this.issues) {
      await this.performGithubRequest(comment);
    }

    this.checkHasHaltingError();
  }

  /**
   * @description Translates a violation object into a comment
   *  with a formatted body
   * @param filePath File path that the violation took place in
   * @param violation sfdx-scanner violation
   * @param engine The engine that discovered the violation
   * @returns {} The comment that will be submitted to GitHub
   */
  translateViolationToReport(
    filePath: string,
    violation: ScannerViolation,
    engine: string
  ) {
    const startLine = parseInt(violation.line);
    let endLine = violation.endLine
      ? parseInt(violation.endLine)
      : parseInt(violation.line);
    if (endLine === startLine) {
      endLine++;
    }

    const violationType = getScannerViolationType(
      this.inputs,
      violation,
      engine
    );
    // TODO: Test
    const commit_sha = this.context.sha;

    const commentHeader = `| Engine | Category | Rule | Severity | Type | Message | File |
| --- | --- | --- | --- | --- | --- | --- |`;
    this.issues.push({
      commit_sha,
      position: endLine, // TODO Confirm
      path: filePath,
      // line: endLine,
      body: `${commentHeader}
| ${engine} | ${violation.category} | ${violation.ruleName} | ${
        violation.severity
      } | ${violationType} | [${violation.message.trim()}](${
        violation.url
      }) | [${filePath}](${getGithubFilePath(commit_sha, filePath)}) |`,
    });
    return { violationType };
  }
}
