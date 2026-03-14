import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic();

const SYSTEM_PROMPT = `You are an Academic Intelligence Engine. Analyze the provided study material.
1. Identify core topics based on heading density, repetition, and weighting.
2. Assign a Complexity Score (1-10) based on technical terminology density.
3. Generate 10 high-yield flashcards focused on definitions and key concepts.
4. Create 5 audit questions that test APPLICATION, not just recall.
CRITICAL: Return ONLY a JSON object, no markdown, no backticks:
{
  "topics": [{ "name": "", "summary": "", "examWeight": 0, "complexityScore": 0, "pageNumber": 0 }],
  "flashcards": [{ "front": "", "back": "", "sourcePageNumber": 0 }],
  "auditQuestions": [{ "question": "", "correctAnswer": "", "sourcePageNumber": 0 }]
}`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, fileBase64, fileType, fileName } = body;

    let userContent: Anthropic.Messages.ContentBlockParam[];

    if (fileBase64 && fileType === "application/pdf") {
      userContent = [
        {
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: fileBase64,
          },
        },
        {
          type: "text",
          text: `Analyze this PDF document: "${fileName || "uploaded document"}"`,
        },
      ];
    } else if (text) {
      userContent = [
        {
          type: "text",
          text: `Analyze this study material:\n\n${text}`,
        },
      ];
    } else {
      return NextResponse.json(
        { error: "No content provided" },
        { status: 400 }
      );
    }

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json(
        { error: "No text response from Claude" },
        { status: 500 }
      );
    }

    const parsed = JSON.parse(textBlock.text);
    return NextResponse.json(parsed);
  } catch (error: unknown) {
    console.error("Analyze error:", error);
    const message =
      error instanceof Error ? error.message : "Analysis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
