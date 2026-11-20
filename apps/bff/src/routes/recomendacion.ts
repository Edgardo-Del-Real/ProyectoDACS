import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../db.js';
import { obtenerPronostico } from '../services/openmeteo.js';
import { obtenerUltimoPrecioCultivo } from '../services/mercado.js';
import {
  calcularRecomendacion,
  calcularDiasConRiesgoHelada,
  esPronosticoValido,
  round1,
} from '../services/recomendacion.js';
import type {
  ClimaDisponible,
  PrecioDisponible,
} from '../services/recomendacion.js';
import {
  obtenerAnioCampaniaVigente,
  obtenerDatosCatalogoRotacion,
  parsearCampania,
} from '../services/rotacion.js';

/**
 * Resuelve el clima sin propagar errores: si Open-Meteo falla se intenta la
 * caché cruda de `PronosticoClima` y, si tampoco hay, se marca no disponible.
 */
async function obtenerClimaDisponible(parcelaId: string): Promise<ClimaDisponible> {
  try {
    const pronostico = await obtenerPronostico(parcelaId);
    if (pronostico && esPronosticoValido(pronostico.pronostico)) {
      return {
        fuente: pronostico.stale ? 'cache' : 'live',
        antiguedadHoras: round1(
          (Date.now() - new Date(pronostico.fetchedAt).getTime()) / 3_600_000,
        ),
        dias: pronostico.pronostico,
      };
    }
  } catch {
    // Se intenta recuperar el último pronóstico persistido antes de rendirse.
  }

  try {
    const cache = await prisma.pronosticoClima.findUnique({ where: { parcelaId } });
    if (cache && esPronosticoValido(cache.datos)) {
      return {
        fuente: 'cache',
        antiguedadHoras: round1((Date.now() - cache.fetchedAt.getTime()) / 3_600_000),
        dias: cache.datos,
      };
    }
  } catch {
    // Sin caché accesible: el cálculo sigue sin el factor climático.
  }

  return { fuente: 'no_disponible', antiguedadHoras: null, dias: [] };
}

export const recomendacionRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Params: { id: string } }>(
    '/:id/recomendacion',
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ['Recomendacion'],
        summary:
          'Recomendar cultivo para la próxima campaña con puntaje explicable (US-08 / KAN-54)',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', minLength: 1 } },
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = request.user.id;
        const parcelaId = request.params.id;

        const parcela = await prisma.parcela.findFirst({
          where: { id: parcelaId, userId },
          select: { id: true, nombre: true },
        });

        if (!parcela) {
          return reply.code(404).send({ error: 'Parcela no encontrada' });
        }

        const { catalogo, reglasTransicion } = await obtenerDatosCatalogoRotacion();

        const registros = await prisma.campaniaCultivo.findMany({
          where: { parcelaId },
          select: { cultivo: true, campania: true },
        });
        const historial = [...registros].sort(
          (a, b) => (parsearCampania(b.campania) ?? 0) - (parsearCampania(a.campania) ?? 0),
        );

        const clima = await obtenerClimaDisponible(parcelaId);

        const valoresPrecios: Record<string, number> = {};
        let fechaMasReciente: Date | null = null;
        for (const c of catalogo) {
          try {
            const precio = await obtenerUltimoPrecioCultivo(c.nombre);
            if (precio) {
              valoresPrecios[c.nombre] = precio.valor;
              if (fechaMasReciente === null || precio.fecha > fechaMasReciente) {
                fechaMasReciente = precio.fecha;
              }
            }
          } catch {
            // Se ignora error por cultivo individual
          }
        }

        const tienePrecios = Object.keys(valoresPrecios).length > 0;
        const precios: PrecioDisponible = {
          fuente: tienePrecios ? 'bd' : 'no_disponible',
          antiguedadDias:
            fechaMasReciente === null
              ? null
              : Math.floor((Date.now() - fechaMasReciente.getTime()) / 86_400_000),
          moneda: 'USD/t',
          valores: valoresPrecios,
        };

        const resultado = calcularRecomendacion({
          catalogo,
          reglas: reglasTransicion,
          historial,
          clima,
          precios,
          anioVigente: obtenerAnioCampaniaVigente(new Date()),
        });

        const tempMinProxima =
          clima.dias.length > 0 ? Math.min(...clima.dias.map((d) => d.tempMin)) : null;

        const cultivoRecomendado = resultado.recomendacion
          ? catalogo.find((c) => c.nombre === resultado.recomendacion?.cultivo)
          : undefined;
        const diasConRiesgoHelada = resultado.recomendacion
          ? calcularDiasConRiesgoHelada(cultivoRecomendado?.tempMinCritica, clima.dias)
          : null;

        return {
          parcela: { id: parcela.id, nombre: parcela.nombre },
          fecha: new Date().toISOString(),
          recomendacion: resultado.recomendacion
            ? {
                cultivo: resultado.recomendacion.cultivo,
                familiaBotanica: resultado.recomendacion.familiaBotanica,
                puntaje: resultado.recomendacion.puntaje,
                motivo: resultado.recomendacion.motivo,
                factores: resultado.recomendacion.factores,
              }
            : null,
          alternativas: resultado.alternativas.map((alternativa) => ({
            cultivo: alternativa.cultivo,
            puntaje: alternativa.puntaje,
            motivo: alternativa.motivo,
          })),
          pesosAplicados: resultado.pesosAplicados,
          climaUtilizado: {
            fuente: clima.fuente,
            antiguedadHoras: clima.antiguedadHoras,
            tempMinProxima,
            diasConRiesgoHelada,
            dias: clima.dias,
          },
          precioUtilizado: {
            fuente: precios.fuente,
            antiguedadDias: precios.antiguedadDias,
            moneda: precios.moneda,
            valores: precios.valores,
          },
          historial: {
            tieneHistorial: resultado.tieneHistorial,
            ultimoCultivo: resultado.ultimoCultivo,
            sugerencia: resultado.sugerencia,
          },
          advertencias: resultado.advertencias,
        };
      } catch (error) {
        app.log.error(error);
        return reply.code(500).send({ error: 'No se pudo calcular la recomendación' });
      }
    },
  );
};
