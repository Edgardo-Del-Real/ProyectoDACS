import { prisma } from '../src/db.js';

interface CultivoSeed {
  nombre: string;
  familiaBotanica: string;
  cicloDias: number;
  tempMinCritica: number;
}

const CULTIVOS_BASE: CultivoSeed[] = [
  {
    nombre: 'Soja 1ra',
    familiaBotanica: 'Leguminosa',
    cicloDias: 135,
    tempMinCritica: 1.0,
  },
  {
    nombre: 'Maíz tardío',
    familiaBotanica: 'Gramínea',
    cicloDias: 150,
    tempMinCritica: 0.0,
  },
  {
    nombre: 'Trigo pan',
    familiaBotanica: 'Gramínea',
    cicloDias: 160,
    tempMinCritica: -3.0,
  },
  {
    nombre: 'Girasol',
    familiaBotanica: 'Asterácea',
    cicloDias: 125,
    tempMinCritica: 0.0,
  },
  {
    nombre: 'Sorgo granífero',
    familiaBotanica: 'Gramínea',
    cicloDias: 120,
    tempMinCritica: 2.0,
  },
  {
    nombre: 'Cebada cervecera',
    familiaBotanica: 'Gramínea',
    cicloDias: 140,
    tempMinCritica: -2.0,
  },
];

interface ReglaSeed {
  cultivoAnterior: string;
  cultivoSiguiente: string;
  aniosEsperaMin: number;
  efectoSuelo: string;
  prioridadSugerencia: number;
}

const REGLAS_ROTACION_BASE: ReglaSeed[] = [
  {
    cultivoAnterior: 'Soja 1ra',
    cultivoSiguiente: 'Maíz tardío',
    aniosEsperaMin: 0,
    efectoSuelo:
      'Aporte clave de carbono y volumen de rastrojo tras leguminosa. Rompe ciclo biológico de malezas tolerantes (Conyza, Amaranthus) y mejora la infiltración.',
    prioridadSugerencia: 5,
  },
  {
    cultivoAnterior: 'Soja 1ra',
    cultivoSiguiente: 'Trigo pan',
    aniosEsperaMin: 0,
    efectoSuelo:
      'Excelente opción invernal. Mantiene el suelo cubierto durante el invierno reduciendo la erosión eólica e hídrica y aprovechando nutrientes residuales.',
    prioridadSugerencia: 4,
  },
  {
    cultivoAnterior: 'Maíz tardío',
    cultivoSiguiente: 'Soja 1ra',
    aniosEsperaMin: 0,
    efectoSuelo:
      'Aprovecha el rastrojo denso del maíz como cobertura superficial y aporta nitrógeno al suelo mediante fijación biológica simbiótica de bacterias Rhizobium.',
    prioridadSugerencia: 5,
  },
  {
    cultivoAnterior: 'Trigo pan',
    cultivoSiguiente: 'Soja 1ra',
    aniosEsperaMin: 0,
    efectoSuelo:
      'Rotación tradicional intensiva pampeana. Alterna especies con diferente profundidad de arraigo y optimiza la eficiencia de uso del agua.',
    prioridadSugerencia: 4,
  },
  {
    cultivoAnterior: 'Soja 1ra',
    cultivoSiguiente: 'Soja 1ra',
    aniosEsperaMin: 1,
    efectoSuelo:
      'Desaconsejada por INTA: el monocultivo de leguminosas agota el fósforo disponible, acidifica el horizonte superficial y propicia patógenos de raíz (Fusarium, Macrophomina).',
    prioridadSugerencia: 1,
  },
  {
    cultivoAnterior: 'Girasol',
    cultivoSiguiente: 'Maíz tardío',
    aniosEsperaMin: 0,
    efectoSuelo:
      'El maíz compensa el escaso residuo que deja el girasol, evitando el encostramiento de suelos limosos y mejorando la materia orgánica.',
    prioridadSugerencia: 4,
  },
  {
    cultivoAnterior: 'Maíz tardío',
    cultivoSiguiente: 'Girasol',
    aniosEsperaMin: 0,
    efectoSuelo:
      'El sistema radicular pivotante y vigoroso del girasol descompacta capas intermedias del suelo, explorando agua en profundidad.',
    prioridadSugerencia: 3,
  },
  {
    cultivoAnterior: 'Sorgo granífero',
    cultivoSiguiente: 'Soja 1ra',
    aniosEsperaMin: 0,
    efectoSuelo:
      'Alta tolerancia al estrés térmico e hídrico; deja una masa radicular muy densa que reconstituye la estabilidad de los agregados del suelo.',
    prioridadSugerencia: 4,
  },
];

interface ParametroEconomicoSeed {
  cultivo: string;
  retencionPct: number;
  costoPorHa: number;
}

const PARAMETROS_ECONOMICOS_BASE: ParametroEconomicoSeed[] = [
  {
    cultivo: 'Soja 1ra',
    retencionPct: 33.0,
    costoPorHa: 385.0,
  },
  {
    cultivo: 'Maíz tardío',
    retencionPct: 12.0,
    costoPorHa: 540.0,
  },
  {
    cultivo: 'Trigo pan',
    retencionPct: 12.0,
    costoPorHa: 320.0,
  },
  {
    cultivo: 'Girasol',
    retencionPct: 7.0,
    costoPorHa: 345.0,
  },
  {
    cultivo: 'Sorgo granífero',
    retencionPct: 12.0,
    costoPorHa: 310.0,
  },
  {
    cultivo: 'Cebada cervecera',
    retencionPct: 12.0,
    costoPorHa: 330.0,
  },
];

export async function main() {
  console.log('🌱 Iniciando carga de datos semilla agronómicos...');

  // 1. Cargar catálogo de cultivos
  const mapaCultivos = new Map<string, string>();
  for (const c of CULTIVOS_BASE) {
    const registro = await prisma.cultivo.upsert({
      where: { nombre: c.nombre },
      update: {
        familiaBotanica: c.familiaBotanica,
        cicloDias: c.cicloDias,
        tempMinCritica: c.tempMinCritica,
      },
      create: {
        nombre: c.nombre,
        familiaBotanica: c.familiaBotanica,
        cicloDias: c.cicloDias,
        tempMinCritica: c.tempMinCritica,
      },
    });
    mapaCultivos.set(c.nombre, registro.id);
  }
  console.log(`✅ ${mapaCultivos.size} cultivos registrados/actualizados.`);

  // 2. Cargar reglas de rotación
  let reglasCargadas = 0;
  for (const r of REGLAS_ROTACION_BASE) {
    const anteriorId = mapaCultivos.get(r.cultivoAnterior);
    const siguienteId = mapaCultivos.get(r.cultivoSiguiente);

    if (!anteriorId || !siguienteId) continue;

    await prisma.reglaRotacion.upsert({
      where: {
        cultivoAnteriorId_cultivoSiguienteId: {
          cultivoAnteriorId: anteriorId,
          cultivoSiguienteId: siguienteId,
        },
      },
      update: {
        aniosEsperaMin: r.aniosEsperaMin,
        efectoSuelo: r.efectoSuelo,
        prioridadSugerencia: r.prioridadSugerencia,
      },
      create: {
        cultivoAnteriorId: anteriorId,
        cultivoSiguienteId: siguienteId,
        aniosEsperaMin: r.aniosEsperaMin,
        efectoSuelo: r.efectoSuelo,
        prioridadSugerencia: r.prioridadSugerencia,
      },
    });
    reglasCargadas++;
  }
  console.log(`✅ ${reglasCargadas} reglas de rotación agronómica cargadas.`);

  // 3. Cargar parámetros económicos
  let parametrosCargados = 0;
  for (const p of PARAMETROS_ECONOMICOS_BASE) {
    const existente = await prisma.parametroEconomico.findFirst({
      where: { cultivo: p.cultivo },
    });

    if (existente) {
      await prisma.parametroEconomico.update({
        where: { id: existente.id },
        data: {
          retencionPct: p.retencionPct,
          costoPorHa: p.costoPorHa,
        },
      });
    } else {
      await prisma.parametroEconomico.create({
        data: {
          cultivo: p.cultivo,
          retencionPct: p.retencionPct,
          costoPorHa: p.costoPorHa,
        },
      });
    }
    parametrosCargados++;
  }
  console.log(`✅ ${parametrosCargados} parámetros económicos cargados.`);
  console.log('🌾 Seed completado con éxito.');
}

main()
  .catch((e) => {
    console.error('❌ Error al ejecutar el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
