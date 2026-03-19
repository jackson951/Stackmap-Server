import { Octokit } from "@octokit/rest";

const buildOctokit = (token: string) => new Octokit({ auth: token });

const splitFullName = (fullName: string) => {
  const [owner, repo] = fullName.split("/");

  if (!owner || !repo) {
    throw new Error("Invalid repository full name, expected owner/repo");
  }

  return { owner, repo };
};

export const verifyRepoExists = async (fullName: string, token: string) => {
  const octokit = buildOctokit(token);
  const { owner, repo } = splitFullName(fullName);
  const response = await octokit.rest.repos.get({ owner, repo });
  return response.data;
};

export const getRepoTree = async (fullName: string, token: string) => {
  const octokit = buildOctokit(token);
  const { owner, repo } = splitFullName(fullName);

  const repoData = await octokit.rest.repos.get({ owner, repo });
  const branch = repoData.data.default_branch ?? "HEAD";
  const branchData = await octokit.rest.repos.getBranch({ owner, repo, branch });

  const treeResponse = await octokit.rest.git.getTree({
    owner,
    repo,
    tree_sha: branchData.data.commit.sha,
    recursive: "true",
  });

  return treeResponse.data.tree;
};

export const getFileContent = async (fullName: string, path: string, token: string) => {
  const octokit = buildOctokit(token);
  const { owner, repo } = splitFullName(fullName);

  const response = await octokit.rest.repos.getContent({
    owner,
    repo,
    path,
  });

  if (Array.isArray(response.data)) {
    return null;
  }

  if ("content" in response.data && response.data.content) {
    return Buffer.from(response.data.content, "base64").toString("utf-8");
  }

  return null;
};

export const getCommitCount = async (fullName: string, path: string, token: string) => {
  const octokit = buildOctokit(token);
  const { owner, repo } = splitFullName(fullName);

  const commits = await octokit.rest.repos.listCommits({
    owner,
    repo,
    path,
    per_page: 100,
  });

  return commits.data.length;
};
