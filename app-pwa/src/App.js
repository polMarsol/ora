import React, { useState, useEffect } from 'react';

function App() {
  const [schedule, setSchedule] = useState([]);
  const [title, setTitle] = useState('');
  const [day, setDay] = useState('');
  const [time, setTime] = useState('');

  // Carrega horaris de MongoDB al iniciar l'app
  useEffect(() => {
    const fetchSchedule = async () => {
      try {
        const response = await fetch('http://localhost:3000/horaris');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setSchedule(data);
      } catch (error) {
        console.error("Error carregant horaris de MongoDB:", error);
        // Opcional: Carregar de localStorage com a fallback si hi ha un error
        const saved = localStorage.getItem('schedule');
        setSchedule(saved ? JSON.parse(saved) : []);
        alert('No s\'han pogut carregar els horaris del servidor. Es carreguen els guardats localment (si n\'hi ha).');
      }
    };

    fetchSchedule();
  }, []); // S'executa només un cop al muntar el component

  // Mantenim l'efecte per guardar a localStorage com a còpia de seguretat
  useEffect(() => {
    localStorage.setItem('schedule', JSON.stringify(schedule));
  }, [schedule]);

  // Gestió de l'enviament manual de l'activitat
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title || !day || !time) return;

    const newActivity = { title, day, time };
    try {
      const response = await fetch('http://localhost:3000/horaris', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newActivity)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const addedActivity = await response.json(); // El backend retornarà l'element afegit amb _id
      setSchedule(prevSchedule => [...prevSchedule, addedActivity]);
      setTitle('');
      setDay('');
      setTime('');
      alert('Activitat afegida manualment correctament!');
    } catch (error) {
      console.error("Error afegint activitat manualment a MongoDB:", error);
      alert('No s\'ha pogut afegir l\'activitat manualment al servidor.');
    }
  };

  // Gestió de l'eliminació de l'activitat
  const handleDelete = async (idToDelete) => {
    console.log(`Intentant eliminar l'activitat amb ID: ${idToDelete}`);
    try {
      const response = await fetch(`http://localhost:3000/horaris/${idToDelete}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Si l'eliminació al backend és exitosa, actualitzem l'estat local
      setSchedule(prevSchedule => prevSchedule.filter(item => item._id !== idToDelete));
      alert('Activitat eliminada correctament!');
    } catch (error) {
      console.error("Error eliminant activitat de MongoDB:", error);
      alert('No s\'ha pogut eliminar l\'activitat del servidor.');
    }
  };

  // Gestió de l'entrada de veu
  const startVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('El navegador no suporta reconeixement de veu.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'ca-ES';
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

        // La resposta del backend hauria de contenir la _id de MongoDB
        if (data && data.scheduleItem && data.scheduleItem.day && data.scheduleItem.time && data.scheduleItem.title && data.scheduleItem._id) {
          setSchedule(prev => [...prev, {
            _id: data.scheduleItem._id, // Afegim la ID
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
        {schedule.map((item) => (
          <li key={item._id}> {/* IMPORTANT: Utilitzem item._id com a clau */}
            {item.day} - {item.time} - {item.title}{' '}
            <button onClick={() => handleDelete(item._id)}>🗑️</button> {/* Passem item._id */}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;