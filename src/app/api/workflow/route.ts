import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic();

const SYSTEM_PROMPT = `You are a study curriculum designer. Given a list of topics and subtopics with complexity scores and exam weights, output an optimal linear study sequence. Group related subtopics. Indicate dependencies (what must be learned first). Return ONLY JSON, no markdown, no backticks:
{
  "nodes": [{
    "id": "string",
    "label": "string",
    "type": "topic|subtopic|milestone",
    "duration": 0,
    "depends_on": ["id"],
    "complexity": 1,
    "priority": "critical|high|medium"
  }],
  "totalMinutes": 0,
  "milestones": [{ "afterNodeId": "string", "label": "string" }]
}`;

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
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Create an optimal study workflow for these topics:\n${JSON.stringify(topics, null, 2)}`,
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
