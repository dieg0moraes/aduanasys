import OpenAI from "openai";

/**
 * Módulo de embeddings usando OpenAI text-embedding-3-small.
 * Genera vectores de 1536 dimensiones.
 * Costo: ~$0.02 por millón de tokens (prácticamente gratis).
 */

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const MODEL = "text-embedding-3-small";

/**
 * Genera embedding para un texto.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: MODEL,
    input: text,
  });

  return response.data[0].embedding;
}

/**
 * Genera embeddings para múltiples textos en batch.
 * OpenAI soporta hasta 2048 textos por request.
 */
export async function generateEmbeddings(
  texts: string[]
): Promise<number[][]> {
  // OpenAI soporta batch nativo — mucho más eficiente
  const BATCH_SIZE = 500;
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const response = await openai.embeddings.create({
      model: MODEL,
      input: batch,
    });

    // Los resultados vienen en el mismo orden
    for (const item of response.data) {
      results.push(item.embedding);
    }
  }

  return results;
}
