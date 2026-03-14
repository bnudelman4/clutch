import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic();

const SYSTEM_PROMPT = `You are a study curriculum designer. Given topics with complexity scores and exam weights, output an optimal linear study sequence. Group related subtopics. Indicate dependencies. Return ONLY valid JSON, no markdown, no backticks, no explanation:
{
  "nodes": [{"id":"string","label":"string","type":"topic|subtopic|milestone","duration":0,"depends_on":["id"],"complexity":1,"priority":"critical|high|medium"}],
  "totalMinutes": 0,
  "milestones": [{"afterNodeId":"string","label":"string"}]
}
Keep node labels concise (under 25 chars). Limit to 2-3 milestones max. Use short ids like "t1","s1","m1".`;

export async function POST(req: NextRequest) {
  try {
    const { topics } = await req.json();

    if (!topics || !Array.isArray(topics)) {
      return NextResponse.json(
        { error: "No topics provided" },
        { status: 400 }
      );
    }

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Create study workflow:\n${JSON.stringify(topics)}`,
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json(
        { error: "No response from Claude" },
        { status: 500 }
      );
    }

    const parsed = JSON.parse(textBlock.text);
    return NextResponse.json(parsed);
  } catch (error: unknown) {
    console.error("Workflow error:", error);
    const message =
      error instanceof Error ? error.message : "Workflow generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
