import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
// Use require to avoid webpack bundling issues
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse");

const client = new Anthropic();

async function extractPdfText(base64: string): Promise<string> {
  const buffer = Buffer.from(base64, "base64");
  const result = await pdfParse(buffer);
  return result.text;
}

const SYSTEM_PROMPT = `You are an Academic Intelligence Engine. Analyze the provided study material.
1. Identify core topics based on heading density, repetition, and weighting. For each topic, identify 2-4 subtopics with importance levels.
2. Assign a Complexity Score (1-10) based on technical terminology density.
3. Generate 10 high-yield flashcards focused on definitions and key concepts.
4. Create 5 audit questions that test APPLICATION, not just recall. Each question must have 4 multiple-choice options where wrong answers are common misconceptions (not obviously wrong).
CRITICAL: Return ONLY a JSON object, no markdown, no backticks:
{
  "topics": [{
    "name": "", "summary": "", "examWeight": 0, "complexityScore": 0, "pageNumber": 0,
    "subtopics": [{ "name": "", "description": "", "importance": "high|medium|low", "pageNumber": 0 }]
  }],
  "flashcards": [{ "front": "", "back": "", "sourcePageNumber": 0 }],
  "auditQuestions": [{
    "question": "",
    "options": ["A answer", "B answer", "C answer", "D answer"],
    "correctIndex": 0,
    "explanation": "Why the correct answer is right and common misconceptions",
    "sourcePageNumber": 0
  }]
}`;

// Sonnet has much higher rate limits — allow up to ~50k chars
const MAX_TEXT_CHARS = 50000;

function truncateText(text: string): string {
  if (text.length <= MAX_TEXT_CHARS) return text;
  const head = text.substring(0, 35000);
  const tail = text.substring(text.length - 15000);
  return `${head}\n\n[... content truncated for length ...]\n\n${tail}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, fileBase64, fileType, fileName } = body;

    let userContent: Anthropic.Messages.ContentBlockParam[];

    if (fileBase64 && fileType === "application/pdf") {
      const extractedText = await extractPdfText(fileBase64);
      if (!extractedText.trim()) {
        return NextResponse.json(
          { error: "Could not extract text from PDF. It may be image-only." },
          { status: 400 }
        );
      }
      userContent = [
        {
          type: "text",
          text: `Analyze this study material (${fileName || "PDF"}):\n\n${truncateText(extractedText)}`,
        },
      ];
    } else if (text) {
      userContent = [
        {
          type: "text",
          text: `Analyze this study material:\n\n${truncateText(text)}`,
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

    let rawText = textBlock.text.trim();
    // Strip markdown code fences if present
    if (rawText.startsWith("```")) {
      rawText = rawText.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    }
    const parsed = JSON.parse(rawText);
    return NextResponse.json(parsed);
  } catch (error: unknown) {
    console.error("Analyze error:", error);
    const message =
      error instanceof Error ? error.message : "Analysis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
