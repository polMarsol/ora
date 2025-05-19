import React, { useState, useEffect } from 'react';

function App() {
  // Estat dels horaris
  const [schedule, setSchedule] = useState(() => {
    // Carregar des de localStorage si existeix
    const saved = localStorage.getItem('schedule');
    return saved ? JSON.parse(saved) : [];
  });

  const [title, setTitle] = useState('');
  const [day, setDay] = useState('');
  const [time, setTime] = useState('');

  // Guardar schedule a localStorage cada cop que canvia
  useEffect(() => {
    localStorage.setItem('schedule', JSON.stringify(schedule));
  }, [schedule]);

  // Afegir horari manualment
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title || !day || !time) return;
    setSchedule([...schedule, { title, day, time }]);
    setTitle('');
    setDay('');
    setTime('');
  };

  // Eliminar horari
  const handleDelete = (index) => {
    const newSchedule = schedule.filter((_, i) => i !== index);
    setSchedule(newSchedule);
  };

  // Reconeixement de veu
  const startVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('El navegador no suporta reconeixement de veu.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'ca-ES';
    recognition.start();

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.toLowerCase();
      alert('Has dit: ' + transcript);

      // Exemple molt bàsic de parseig: "dilluns 10:00 reunió"
      // Pots millorar-ho amb expressions regulars o NLP
      const parts = transcript.split(' ');
      if(parts.length >= 3) {
        const [vDay, vTime, ...vTitle] = parts;
        setSchedule(prev => [...prev, { title: vTitle.join(' '), day: vDay, time: vTime }]);
      } else {
        alert('No s’ha pogut processar correctament la frase.');
      }
    };
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: 'auto' }}>
      <h1>🕒 Ora - Gestor d'Horaris</h1>

      <button onClick={startVoiceInput}>🎙️ Afegeix per veu</button>

      <form onSubmit={handleSubmit} style={{ marginTop: '20px' }}>
        <input 
          type="text" 
          placeholder="Títol" 
          value={title} 
          onChange={e => setTitle(e.target.value)} 
          required 
        />
        <input 
          type="text" 
          placeholder="Dia -> (ex: dilluns)" 
          value={day} 
          onChange={e => setDay(e.target.value)} 
          required 
        />
        <input 
          type="time" 
          value={time} 
          onChange={e => setTime(e.target.value)} 
          required 
        />
        <button type="submit">Afegir manualment</button>
      </form>

      <ul style={{ marginTop: '20px' }}>
        {schedule.map((item, index) => (
          <li key={index}>
            {item.day} - {item.time} - {item.title} {' '}
            <button onClick={() => handleDelete(index)}>🗑️</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;
