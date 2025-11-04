import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Analiza imagenes de resultados de Warzone con IA
 * Puede recibir 1 o 2 imagenes (posicion y/o kills)
 */
export async function analyzeWarzoneResults(imageUrls) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    // Descargar imagenes
    const imageParts = [];
    for (const url of imageUrls) {
      const response = await fetch(url);
      const buffer = await response.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      imageParts.push({
        inlineData: {
          data: base64,
          mimeType: 'image/png'
        }
      });
    }

    const prompt = `Analiza esta(s) captura(s) de Call of Duty Warzone y extrae la siguiente informacion:

1. **Posicion del equipo** (ejemplo: 1, 2, 3... hasta 30+)
2. **Kills totales del equipo** (suma de todos los jugadores)
3. **Kills individuales de cada jugador** (nombre y kills de cada uno)

INSTRUCCIONES:
- Si ves una pantalla de victoria/derrota, extrae la posicion (#1, #2, etc.)
- Si ves la pantalla de estadisticas, extrae los kills de cada jugador
- Los nombres de jugador suelen estar junto a los numeros de kills
- Si hay multiples imagenes, combina la informacion

FORMATO DE RESPUESTA (JSON estricto):
{
  "position": numero (1-30+),
  "totalKills": numero,
  "players": [
    {"name": "NombreJugador", "kills": numero},
    {"name": "NombreJugador2", "kills": numero}
  ],
  "confidence": "high" | "medium" | "low"
}

IMPORTANTE: 
- Responde SOLO con el JSON, sin texto adicional
- Si no estas seguro de algo, usa confidence: "low"
- Si falta informacion, deja el campo en null
`;

    const result = await model.generateContent([prompt, ...imageParts]);
    const text = result.response.text();
    
    // Extraer JSON de la respuesta
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No se pudo extraer JSON de la respuesta de la IA');
    }
    
    const data = JSON.parse(jsonMatch[0]);
    
    // Validar datos
    if (!data.position && !data.totalKills) {
      throw new Error('No se pudo extraer informacion valida de las imagenes');
    }
    
    return {
      success: true,
      data: {
        position: data.position || null,
        totalKills: data.totalKills || 0,
        players: data.players || [],
        confidence: data.confidence || 'medium'
      }
    };
    
  } catch (error) {
    console.error('Error analizando imagenes con IA:', error);
    return {
      success: false,
      error: error.message
    };
  }
}