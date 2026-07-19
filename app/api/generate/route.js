import { OpenRouter } from "@openrouter/sdk";

const openrouter = new OpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

const modelNames = [
  "openai/gpt-5.4-nano",
  "anthropic/claude-3-haiku",
  "google/gemini-3.1-flash-lite",
];

async function callModel(prompt, modelName) {
  const response = await openrouter.chat.send({
    chatRequest: {
      model: modelName,
      maxTokens: 300,
      messages: [
        {
          role: "system",
          content:
            `you are a very analytical and helpful assistant which provide well organised responses very politely yet to the point in max 250 words but not crunching any knowledge to you back, 
            FORMATTING RULES: 
            1. use short paragraphs 2-3 lines max for explaination
            2. use bullet point for genuinely parellel point, not for substituting full sentences
            3. Bold only 1-3 most important terms per section, never every noun.
            4. Use Headers (##,###) to break long answers into sections to increase readability.
            5. avoid nesting of bullet points, use subheaders instead.
            6. while comparing use tables for better clarity.
            7. match response length to complexity of the question, do not pad simple answers, don't compress complex ones
            8. write for a human reading it on screen,  prioritize flow and readability over maximal compression`,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    },
  });

  return response.choices[0].message.content;
}

function buildFallbackAggregation(successfulResults) {
  const combinedSections = successfulResults
    .map(
      (answer, index) => `### Model ${index + 1}\n${answer}`,
    )
    .join("\n\n");

  return `## Evaluation\nHere is a concise evaluation of the available model responses.\n\n## Combined Answer\nHere is a consolidated view of the available model responses:\n\n${combinedSections}`;
}

async function FinalAnswer(prompt, successfulResults) {
  const formattedAnswers = successfulResults
    .map((answer, i) => `Response ${i + 1} --- \n ${answer}`)
    .join("\n\n");
  const finalPrompt = `You are highly analytical and helpful evaluator, your work is to evaluate give responses and think critically through the perspective that the user is asking for, and prepare a combined answer which is more accurate, precise, which is something user is looking for, do not strip away any context, do not remove any knowledge,details neither repeat the same information again, Use the simplest language and articulate less words but not strip away any knowledge.
  Structure your response in two clear sections:
  ## Evaluation
  Provide a short analytical evaluation of the responses, noting strengths, gaps, and what matters most for the question.
  ## Combined Answer
  Provide the final consolidated answer the user should see.
  Question: ${prompt}
  ${formattedAnswers}
  Final Answer:`;

  try {
    const aggregatedContent = await callModel(finalPrompt, "openai/gpt-5.4-nano");

    if (aggregatedContent && aggregatedContent.trim()) {
      return aggregatedContent;
    }
  } catch (error) {
    console.error("Aggregator model failed, using fallback aggregation.", error);
  }

  return buildFallbackAggregation(successfulResults);
}

export async function POST(req) {
  const body = await req.json();
  const prompt = body.prompt;

  const results = await Promise.allSettled(
    modelNames.map((modelName) => callModel(prompt, modelName)),
  );

  const modelResults = results.map((result, index) => ({
    name: modelNames[index],
    output:
      result.status === "fulfilled"
        ? result.value
        : "No response generated from this model.",
  }));

  const successfulResults = modelResults
    .filter(
      (result) => result.output !== "No response generated from this model.",
    )
    .map((result) => result.output);

  const finalAnswer = successfulResults.length
    ? await FinalAnswer(prompt, successfulResults)
    : "No successful model responses were produced.";

  return Response.json({ finalAnswer, modelResults });
}
