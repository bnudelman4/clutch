import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic();

const SYSTEM_PROMPT = `You are an academic study planner. Given a list of calendar events and an exam date, identify all free time blocks (minimum 30 minutes). Then create an optimal study schedule working backwards from the exam. Prioritize longer sessions earlier, shorter review sessions closer to exam. Return ONLY JSON, no markdown, no backticks:
{
  "studySessions": [{
    "date": "YYYY-MM-DD",
    "startTime": "HH:MM",
    "endTime": "HH:MM",
    "durationMinutes": 0,
    "focus": "topic name",
    "intensity": "deep|review|light",
    "notes": "what to cover"
  }],
  "summary": "one sentence overview of the plan",
  "totalStudyHours": 0,
  "daysUntilExam": 0
}`;

export async function POST(req: NextRequest) {
  try {
    const { events, examDateTime, examSubject, topics } = await req.json();

    if (!examDateTime || !examSubject) {
      return NextResponse.json(
        { error: "Exam date and subject required" },
        { status: 400 }
      );
    }

    const topicsList = topics
      ?.sort((a: { examWeight: number }, b: { examWeight: number }) => b.examWeight - a.examWeight)
      .map((t: { name: string; examWeight: number }) => `${t.name} (weight: ${t.examWeight}%)`)
      .join(", ") || "General review";

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Calendar events: ${JSON.stringify(events || [])}\nExam: ${examSubject} on ${examDateTime}\nTopics to cover (by priority): ${topicsList}`,
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
    console.error("Calendar plan error:", error);
    const message =
      error instanceof Error ? error.message : "Planning failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
