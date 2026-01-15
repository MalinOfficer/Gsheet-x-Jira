'use server';
/**
 * @fileOverview A knowledge base AI agent that answers questions based on provided data.
 *
 * - knowledgeBaseFlow - A function that handles the question answering process.
 * - KnowledgeBaseInput - The input type for the knowledgeBaseFlow function.
 * - KnowledgeBaseOutput - The return type for the knowledgeBaseFlow function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

export const KnowledgeBaseInputSchema = z.object({
  query: z.string().describe("The user's question."),
  context: z
    .string()
    .describe('The knowledge base data from the Google Sheet.'),
});
export type KnowledgeBaseInput = z.infer<typeof KnowledgeBaseInputSchema>;

export const KnowledgeBaseOutputSchema = z.object({
  answer: z
    .string()
    .describe("The AI-generated answer to the user's question."),
});
export type KnowledgeBaseOutput = z.infer<typeof KnowledgeBaseOutputSchema>;


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
