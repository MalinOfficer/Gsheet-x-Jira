
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

const KnowledgeBaseInputSchema = z.object({
  query: z.string().describe('The user\'s question.'),
  context: z.string().describe('The knowledge base data from the Google Sheet.'),
});
export type KnowledgeBaseInput = z.infer<typeof KnowledgeBaseInputSchema>;

const KnowledgeBaseOutputSchema = z.object({
  answer: z.string().describe('The AI-generated answer to the user\'s question.'),
});
export type KnowledgeBaseOutput = z.infer<typeof KnowledgeBaseOutputSchema>;


const knowledgeBasePrompt = ai.definePrompt({
  name: 'knowledgeBasePrompt',
  input: { schema: KnowledgeBaseInputSchema },
  output: { schema: KnowledgeBaseOutputSchema },
  prompt: `You are an expert data analyst. Your task is to answer the user's question based *only* on the provided context data. The context is a series of rows from a spreadsheet.

If the question requires calculation (e.g., 'how many', 'total'), perform the calculation based on the data.
Provide a clear, concise answer. If the information is not in the context, state that you cannot answer the question with the provided data.

CONTEXT:
---
{{{context}}}
---

QUESTION:
"{{{query}}}"

Based on the context, provide the answer.`,
});

export const knowledgeBaseFlow = ai.defineFlow(
  {
    name: 'knowledgeBaseFlow',
    inputSchema: KnowledgeBaseInputSchema,
    outputSchema: KnowledgeBaseOutputSchema,
  },
  async (input) => {
    const { output } = await knowledgeBasePrompt(input);
    return output!;
  }
);
