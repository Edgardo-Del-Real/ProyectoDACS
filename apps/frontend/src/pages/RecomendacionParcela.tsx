import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { RecomendacionCultivo } from '../components/RecomendacionCultivo';

export function RecomendacionParcela() {
  const { id } = useParams<{ id: string }>();
  const [revision, setRevision] = useState(0);

  if (!id) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8">
        <div
          role="alert"
          className="bg-white p-6 sm:p-8 rounded-2xl border border-red-200 shadow-sm space-y-4"
        >
          <div className="flex items-center gap-3 text-red-600">
            <span className="text-2xl">⚠️</span>
            <h1 className="text-xl font-bold">Parcela no encontrada</h1>
          </div>
          <p className="text-slate-700 text-sm bg-red-50 p-4 rounded-xl border border-red-100">
            No se pudo identificar la parcela solicitada.
          </p>
          <div>
            <Link
              to="/panel"
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-sm transition"
            >
              ← Volver al panel
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8 space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <Link
            to={`/parcelas/${id}`}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
          >
            ← Volver a la parcela
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-3">
            Recomendación de cultivo
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Combina rotación, clima y precio de referencia para sugerir el próximo cultivo del lote.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setRevision((actual) => actual + 1)}
          className="self-start sm:self-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-sm transition"
        >
          Recalcular
        </button>
      </header>

      <RecomendacionCultivo id={id} revision={revision} />
    </div>
  );
}
