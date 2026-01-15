'use server';
/**
 * @fileOverview A knowledge base AI agent that answers questions based on provided data.
 *
 * - knowledgeBaseFlow - A function that handles the question answering process.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const KnowledgeBaseInputSchema = z.object({
  query: z.string().describe("The user's question."),
  context: z
    .string()
    .describe('The knowledge base data from the Google Sheet.'),
});
type KnowledgeBaseInput = z.infer<typeof KnowledgeBaseInputSchema>;

const KnowledgeBaseOutputSchema = z.object({
  answer: z
    .string()
    .describe("The AI-generated answer to the user's question."),
});
type KnowledgeBaseOutput = z.infer<typeof KnowledgeBaseOutputSchema>;


const knowledgeBasePrompt = ai.definePrompt({
    name: 'knowledgeBasePrompt',
    input: { schema: KnowledgeBaseInputSchema },
    output: { schema: KnowledgeBaseOutputSchema },
    prompt: `You are a helpful AI assistant. Answer the user's query based on the provided context.

Context:
{{{context}}}

Query:
{{{query}}}
`,
});


export async function knowledgeBaseFlow(
  input: KnowledgeBaseInput
): Promise<KnowledgeBaseOutput> {
  const { output } = await knowledgeBasePrompt(input);
  return output!;
}
