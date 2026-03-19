import anthropicClient from "../lib/anthropic";

const MODEL = "claude-sonnet-4-20250514";

const extractTextFromResponse = (content?: Array<{ type: string; text?: string }>) => {
  if (!content?.length) {
    return "";
  }

  return content
    .filter((block) => block.type === "text" && block.text)
    .map((block) => block.text?.trim())
    .filter(Boolean)
    .join("\n\n")
    .trim();
};

const parseFileReferences = (text: string) => {
  const matches = text.matchAll(/`([^`]+)`/g);
  return Array.from(new Set(Array.from(matches, (match) => match[1])));
};

const systemPrompt =
  "You are a codebase expert helping a developer understand repositories. Always cite file paths wrapped in backticks and answer concisely.";

export const summarizeFile = async (path: string, content: string) => {
  const trimmed = content.length > 4000 ? content.slice(0, 4000) : content;

  const response = await anthropicClient.messages.create({
    model: MODEL,
    max_tokens: 120,
    messages: [
      {
        role: "user",
        content: `Summarize the purpose and responsibilities of the file \`${path}\` in one sentence. Focus on what it does, key exports, and how it ties into the rest of the repo. Content:\n${trimmed}`,
      },
    ],
    system: "You are a concise, practical assistant.",
  });

  return extractTextFromResponse(response.content);
};

export const queryRepo = async (question: string, files: Array<{ path: string; summary: string | null }>) => {
  const fileContext = files
    .slice(0, 200)
    .map((file) => `\`${file.path}\`: ${file.summary ?? "Summary pending."}`)
    .join("\n");

  const response = await anthropicClient.messages.create({
    model: MODEL,
    max_tokens: 600,
    messages: [
      {
        role: "user",
        content: `${question}\n\nContext:\n${fileContext}`,
      },
    ],
    system: systemPrompt,
  });

  const answer = extractTextFromResponse(response.content);

  return {
    answer,
    filesReferenced: parseFileReferences(answer),
  };
};

export const generateGuide = async (files: Array<{ path: string; summary: string | null }>) => {
  const fileContext = files
    .slice(0, 200)
    .map((file) => `\`${file.path}\`: ${file.summary ?? "Summary pending."}`)
    .join("\n");

  const prompt = `Generate a structured Markdown onboarding guide with sections: 1) Project Overview 2) Key Files & Their Purpose 3) Architecture Summary 4) Where to Start 5) Known Gotchas or Important Patterns. Use the file summaries when relevant,\n\nFile summaries:\n${fileContext}`;

  const response = await anthropicClient.messages.create({
    model: MODEL,
    max_tokens: 800,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
    system: "You are a helpful onboarding coach for developers.",
  });

  const guide = extractTextFromResponse(response.content);

  return guide;
};
