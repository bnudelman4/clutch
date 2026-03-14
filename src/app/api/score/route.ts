import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic();

const SYSTEM_PROMPT = `You are a strict academic grader. Return ONLY JSON, no markdown:
{"verdict": "correct"|"partial"|"wrong", "score": 0-100, "feedback": "1-2 sentence specific feedback", "missing": "key concept missed or empty string"}`;

export async function POST(req: NextRequest) {
  try {
    const { question, correctAnswer, studentAnswer } = await req.json();

    if (!question || !correctAnswer || !studentAnswer) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Question: ${question}\nModel answer: ${correctAnswer}\nStudent answer: ${studentAnswer}`,
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
    console.error("Score error:", error);
    const message =
      error instanceof Error ? error.message : "Scoring failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
