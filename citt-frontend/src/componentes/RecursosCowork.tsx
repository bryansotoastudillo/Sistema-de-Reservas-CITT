export const recursosCowork = {
  MICROFONO: "Micrófono",
  AUDIO_PARLANTES: "Audio de los parlantes",
  TRANSMITIR_PANTALLA: "Transmitir en la pantalla",
  MICROFONO_DIADEMA: "Micrófono de diadema",
};

export type RecursoCowork = keyof typeof recursosCowork;

export function ResumenRecursosCowork({ recursos }: { recursos?: RecursoCowork[] }) {
  if (!recursos?.length) return null;

  return (
    <div className="text-sm text-slate-700">
      <p className="font-semibold">Recursos audiovisuales del cowork</p>
      <ul className="mt-1 list-disc pl-4">
        {recursos.map((recurso) => <li key={recurso}>{recursosCowork[recurso]}</li>)}
      </ul>
    </div>
  );
}
