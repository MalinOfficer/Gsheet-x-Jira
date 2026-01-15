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
  const keywords = query
    .toLowerCase()
    .replace(/[^a-zA-Z0-9\s-]/g, '') // Remove special characters
    .split(/\s+/)
    .filter(word => word.length > 2 && !['cek', 'berapa', 'apa', 'yang', 'dan', 'atau', 'the', 'is', 'a'].includes(word)); // Filter out common stop words

  if (keywords.length === 0) {
    return {
      answer: "Saya tidak dapat menemukan kata kunci yang spesifik dalam pertanyaan Anda. Coba ajukan pertanyaan yang lebih detail, misalnya 'berapa total kasus CBT?'."
    };
  }

  // Split context into individual cases (lines)
  const allCases = context.split('\n').filter(line => line.trim() !== '');
  const lowerCaseKeywords = keywords.map(k => k.toLowerCase());

  const matchingCases = allCases.filter(caseText => {
      const lowerCaseText = caseText.toLowerCase();
      // Check if the case text includes ALL keywords from the query
      return lowerCaseKeywords.every(keyword => lowerCaseText.includes(keyword));
  });

  // Generate a response based on the findings.
  if (matchingCases.length === 0) {
    return {
      answer: `Maaf, saya tidak dapat menemukan kasus yang cocok dengan kriteria "${keywords.join(", ")}" di dalam data yang tersedia.`
    };
  }
  
  // Try to find a "Title" or "Detail Case" to make the summary more readable
  const getCaseTitle = (caseText: string) => {
    const titleMatch = caseText.match(/Title: (.*?)(,|$)/i) || caseText.match(/Detail Case: (.*?)(,|$)/i);
    if (titleMatch && titleMatch[1]) {
        return titleMatch[1].trim();
    }
    // Fallback to the first 50 characters
    return caseText.length > 50 ? caseText.substring(0, 50) + '...' : caseText;
  }

  let answer = `Berdasarkan analisis data, saya menemukan **${matchingCases.length} kasus** yang relevan dengan pertanyaan Anda tentang *"${keywords.join(", ")}"*.\n\nBerikut adalah rinciannya:\n`;
  
  matchingCases.forEach((caseText, index) => {
      answer += `${index + 1}. ${getCaseTitle(caseText)}\n`;
  });
  
  answer += "\nIni adalah analisis sederhana berdasarkan pencocokan kata kunci dalam setiap kasus.";

  return { answer };
}

// The main flow function that now calls our local "Machon AI".
export async function knowledgeBaseFlow(input: KnowledgeBaseInput): Promise<KnowledgeBaseOutput> {
    // Validate input using Zod schema
    const validatedInput = KnowledgeBaseInputSchema.parse(input);
    
    // Call our internal AI engine
    const response = await machonAI(validatedInput);

    // Validate output before returning and return the result.
    return KnowledgeBaseOutputSchema.parse(response);
}