import React, { useEffect, useState } from 'react';

// Dies de la setmana ordenats
const WEEK_DAYS = [
  'Dilluns', 'Dimarts', 'Dimecres', 'Dijous', 'Divendres'
];

function groupByDay(asignaturas) {
  // Agrupa totes les modalitats de totes les assignatures pel seu dia
  const grouped = {};
  asignaturas.forEach(asig => {
    asig.modalidades.forEach(mod => {
      if (!grouped[mod.dia]) grouped[mod.dia] = [];
      grouped[mod.dia].push({
        ...mod,
        asignatura: asig.nombre
      });
    });
  });
  // Ordena cada dia per hora_inicio
  for (const dia in grouped) {
    grouped[dia].sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
  }
  return grouped;
}

export default function UniSchedule() {
  const [curso, setCurso] = useState(3);
  const [horario, setHorario] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/schedule?curso=${curso}`)
      .then(res => res.json())
      .then(data => {
        setHorario(data);
        setLoading(false);
      })
      .catch(() => setHorario(null));
  }, [curso]);

  if (loading) return <div>Carregant horari...</div>;
  if (!horario) return <div>No s'ha trobat horari per aquest curs.</div>;

  // Agrupa per dia
  const grouped = groupByDay(horario.asignaturas);

  return (
    <div style={{ maxWidth: 800, margin: 'auto' }}>
      <h2>Horari universitari</h2>
      <label>
        Curs:&nbsp;
        <select value={curso} onChange={e => setCurso(Number(e.target.value))}>
          <option value={1}>1r</option>
          <option value={2}>2n</option>
          <option value={3}>3r</option>
        </select>
      </label>
      <div style={{ marginTop: 24 }}>
        {WEEK_DAYS.map(dia => (
          <div key={dia} style={{ marginBottom: 18 }}>
            <h3 style={{ color: '#007bff', marginBottom: 8 }}>{dia}</h3>
            {grouped[dia] && grouped[dia].length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', background: '#f9f9f9' }}>
                <thead>
                  <tr>
                    <th style={{ border: '1px solid #ddd', padding: 6 }}>Hora</th>
                    <th style={{ border: '1px solid #ddd', padding: 6 }}>Assignatura</th>
                    <th style={{ border: '1px solid #ddd', padding: 6 }}>Tipus</th>
                    <th style={{ border: '1px solid #ddd', padding: 6 }}>Aula</th>
                  </tr>
                </thead>
                <tbody>
                  {grouped[dia].map((mod, idx) => (
                    <tr key={idx}>
                      <td style={{ border: '1px solid #ddd', padding: 6 }}>
                        {mod.hora_inicio} - {mod.hora_fin}
                      </td>
                      <td style={{ border: '1px solid #ddd', padding: 6 }}>{mod.asignatura}</td>
                      <td style={{ border: '1px solid #ddd', padding: 6 }}>{mod.tipo}</td>
                      <td style={{ border: '1px solid #ddd', padding: 6 }}>{mod.aula}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ color: '#888', fontStyle: 'italic' }}>No hi ha classes.</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}