
'use server';
/**
 * @fileOverview A knowledge base AI agent that answers questions based on provided data.
 *
 * - knowledgeBaseFlow - A function that handles the question answering process.
 * - KnowledgeBaseInput - The input type for the knowledgeBaseFlow function.
 * - KnowledgeBaseOutput - The return type for the knowledgeBaseFlow function.
 */

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

/**
 * "Machon AI" - A custom, simple AI engine that analyzes context based on a query.
 * This function simulates an AI by performing keyword analysis on the context data.
 * It does not use any external AI APIs like Gemini.
 *
 * @param {KnowledgeBaseInput} input - The user's query and the data context.
 * @returns {Promise<KnowledgeBaseOutput>} A promise that resolves to the generated answer.
 */
async function machonAI(input: KnowledgeBaseInput): Promise<KnowledgeBaseOutput> {
  const { query, context } = input;

  // Simple keyword extraction from the query.
  // This is a basic approach; a real implementation would use more advanced NLP.
  const keywords = query
    .toLowerCase()
    .replace(/[^a-zA-Z0-9\s-]/g, '') // Remove special characters
    .split(/\s+/)
    .filter(word => word.length > 2 && !['berapa', 'apa', 'yang', 'dan', 'atau', 'the', 'is', 'a'].includes(word)); // Filter out common stop words

  if (keywords.length === 0) {
    return {
      answer: "Saya tidak dapat menemukan kata kunci yang spesifik dalam pertanyaan Anda. Coba ajukan pertanyaan yang lebih detail, misalnya 'berapa total kasus CBT?'."
    };
  }

  // Count occurrences of each keyword in the context.
  const lowerCaseContext = context.toLowerCase();
  let totalMatches = 0;
  
  const matchesPerKeyword: Record<string, number> = {};

  keywords.forEach(keyword => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
    const matches = (lowerCaseContext.match(regex) || []).length;
    if (matches > 0) {
        totalMatches += matches;
        matchesPerKeyword[keyword] = matches;
    }
  });


  // Generate a response based on the findings.
  if (totalMatches === 0) {
    return {
      answer: `Maaf, saya tidak dapat menemukan informasi yang cocok dengan kata kunci "${keywords.join(", ")}" di dalam data yang tersedia.`
    };
  }
  
  let answer = `Berdasarkan analisis data, saya menemukan ${totalMatches} kemunculan yang relevan dengan pertanyaan Anda.\n\nBerikut adalah rinciannya:\n`;
  for (const [keyword, count] of Object.entries(matchesPerKeyword)) {
      answer += `- Kata kunci "${keyword}" ditemukan sebanyak ${count} kali.\n`;
  }
  
  answer += "\nIni adalah analisis sederhana berdasarkan pencocokan kata. Untuk analisis yang lebih mendalam, sistem ini dapat dikembangkan lebih lanjut.";

  return { answer };
}

// The main flow function that now calls our local "Machon AI".
export async function knowledgeBaseFlow(input: KnowledgeBaseInput): Promise<KnowledgeBaseOutput> {
    // Validate input using Zod schema
    const validatedInput = KnowledgeBaseInputSchema.parse(input);
    
    // Call our internal AI engine
    const response = await machonAI(validatedInput);

    // Validate output before returning
    return KnowledgeBaseOutputSchema.parse(response);
}
