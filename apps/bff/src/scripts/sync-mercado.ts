/**
 * Sincroniza las cotizaciones oficiales de la Bolsa de Cereales.
 *
 * Se corre aparte del servidor a propósito: el sitio está detrás de Cloudflare y
 * el fallback a `curl` no tiene por qué vivir en el request path. Pensado para un
 * cron diario (el FOB se publica una vez por día):
 *
 *   DATABASE_URL=postgres://... npm run sync:mercado
 */
import { prisma } from '../db.js';
import { FUENTE_BOLSA, sincronizarDesdeBolsa } from '../services/mercado.js';

async function main(): Promise<void> {
  const inicio = Date.now();
  console.log(`🔄 Sincronizando cotizaciones de mercado (${FUENTE_BOLSA})...`);

  const { filas, advertencias } = await sincronizarDesdeBolsa();

  console.log(`✅ ${filas} filas guardadas en ${Date.now() - inicio} ms.`);
  for (const advertencia of advertencias) {
    console.warn(`⚠️  ${advertencia}`);
  }
}

main()
  .catch((error) => {
    console.error('❌ No se pudo sincronizar el mercado:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
