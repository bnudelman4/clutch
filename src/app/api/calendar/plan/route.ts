import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic();

const SYSTEM_PROMPT = `You are an academic study planner. Given calendar events, exam details, and topics with complexity scores, create an optimal study schedule.

CONSTRAINTS:
- Sessions start no earlier than 10:00 AM, end no later than 11:00 PM
- Skip any block already occupied by an existing event (check for overlap)
- Minimum session length: 30 minutes
- Prioritize higher-weight and higher-complexity topics
- Work backwards from the exam date — heavier "deep-study" sessions earlier, lighter "review" sessions closer to exam
- If there is not enough time to cover all topics, mark lower-priority ones as sacrificed

Return ONLY JSON, no markdown, no backticks:
{
  "sessions": [{
    "date": "YYYY-MM-DD",
    "startTime": "HH:MM",
    "endTime": "HH:MM",
    "durationMinutes": 0,
    "title": "topic or subtopic name",
    "notes": "what specifically to cover",
    "type": "deep-study|review|light",
    "priority": "critical|high|medium"
  }],
  "sacrificed": [{ "topicName": "name", "reason": "why it was cut" }],
  "summary": "one sentence overview of the plan",
  "totalHours": 0
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
      .map((t: { name: string; examWeight: number; complexityScore: number; subtopics?: { name: string; importance: string }[] }) =>
        `${t.name} (weight: ${t.examWeight}%, complexity: ${t.complexityScore}/10${t.subtopics?.length ? `, subtopics: ${t.subtopics.map(s => `${s.name} [${s.importance}]`).join(", ")}` : ""})`
      )
      .join("\n") || "General review";

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Existing calendar events (DO NOT schedule over these):\n${JSON.stringify(events || [])}\n\nExam: ${examSubject} on ${examDateTime}\n\nTopics to cover (by priority):\n${topicsList}`,
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
