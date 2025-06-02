import React, { useState, useEffect } from 'react';

function App() {
  const [schedule, setSchedule] = useState(() => {
    const saved = localStorage.getItem('schedule');
    return saved ? JSON.parse(saved) : [];
  });

  const [title, setTitle] = useState('');
  const [day, setDay] = useState('');
  const [time, setTime] = useState('');

  useEffect(() => {
    localStorage.setItem('schedule', JSON.stringify(schedule));
  }, [schedule]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title || !day || !time) return;
    setSchedule([...schedule, { title, day, time }]);
    setTitle('');
    setDay('');
    setTime('');
  };

  const handleDelete = (index) => {
    const newSchedule = schedule.filter((_, i) => i !== index);
    setSchedule(newSchedule);
  };

  const startVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('El navegador no suporta reconeixement de veu.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'ca-ES'; // O el idioma que prefieras para el reconocimiento
    recognition.start();

    recognition.onresult = async (event) => {
      const transcript = event.results[0][0].transcript.toLowerCase();
      alert('Has dit: ' + transcript);

      try {
        console.log('Enviant transcript al backend per Dialogflow:', transcript);
        const resposta = await fetch('http://localhost:3000/process-dialogflow-voice', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ query: transcript })
        });

        const data = await resposta.json();
        console.log('Resposta del backend (després de Dialogflow):', data);

        if (data && data.scheduleItem && data.scheduleItem.day && data.scheduleItem.time && data.scheduleItem.title) {
          setSchedule(prev => [...prev, {
            day: data.scheduleItem.day,
            time: data.scheduleItem.time,
            title: data.scheduleItem.title
          }]);
          alert(data.fulfillmentText || 'Activitat afegida correctament!');
        } else {
          alert(data.fulfillmentText || 'No s\'ha pogut afegir l\'activitat. ' + (data.error || 'Resposta inesperada del servidor.'));
        }
      } catch (err) {
        console.error('Error de connexió amb el servidor:', err);
        alert('No s\'ha pogut connectar amb el servidor o hi ha hagut un error en processar la veu.');
      }
    };

    recognition.onerror = (event) => {
      console.error('Error en el reconeixement de veu:', event.error);
      alert('Error en el reconeixement de veu: ' + event.error);
    };
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: 'auto' }}>
      <h1>🕒 Ora - Gestor d'Horaris 2.0</h1>

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
          placeholder="Dia (ex: dilluns)"
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
            {item.day} - {item.time} - {item.title}{' '}
            <button onClick={() => handleDelete(index)}>🗑️</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;