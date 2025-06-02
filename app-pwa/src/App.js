import React, { useState, useEffect } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'moment/locale/ca'; // Carrega el local català per a moment

// Configura moment en català
moment.locale('ca');
const localizer = momentLocalizer(moment);

function App() {
  const [schedule, setSchedule] = useState([]);
  const [title, setTitle] = useState('');
  const [day, setDay] = useState('');
  const [time, setTime] = useState('');

  // Funció per carregar horaris de MongoDB
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
      const saved = localStorage.getItem('schedule');
      setSchedule(saved ? JSON.parse(saved) : []);
      alert('No s\'han pogut carregar els horaris del servidor. Es carreguen els guardats localment (si n\'hi ha).');
    }
  };

  // Carrega horaris en muntar el component
  useEffect(() => {
    fetchSchedule();
  }, []);

  // Guarda a localStorage com a còpia de seguretat
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

      // Després d'afegir, tornem a carregar l'horari per actualitzar el calendari
      await fetchSchedule();
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

      // Després d'eliminar, tornem a carregar l'horari per actualitzar el calendari
      await fetchSchedule();
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

        if (data && data.scheduleItem && data.scheduleItem.day && data.scheduleItem.time && data.scheduleItem.title && data.scheduleItem._id) {
          // Després d'afegir, tornem a carregar l'horari per actualitzar el calendari
          await fetchSchedule();
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

  // Adaptació de les activitats per al calendari
  const events = schedule.map(item => {
    // Intentem construir una data vàlida
    // Asumirem l'any actual per simplificar si només tenim dia de la setmana
    const today = moment();
    let year = today.year();
    let month = today.month(); // 0-indexed month

    // Convertim el dia de la setmana a un número de dia del mes per a la setmana actual
    // Aquesta lògica és simplista i assumirà que els dies de la setmana són a la setmana actual.
    // Per a una solució més robusta, hauries de guardar dates completes a MongoDB.
    let dayOfWeekNum; // Dia de la setmana (0 per diumenge, 1 per dilluns, etc.)
    const dayName = item.day.toLowerCase();

    switch (dayName) {
        case 'dilluns': dayOfWeekNum = 1; break;
        case 'dimarts': dayOfWeekNum = 2; break;
        case 'dimecres': dayOfWeekNum = 3; break;
        case 'dijous': dayOfWeekNum = 4; break;
        case 'divendres': dayOfWeekNum = 5; break;
        case 'dissabte': dayOfWeekNum = 6; break;
        case 'diumenge': dayOfWeekNum = 0; break;
        default: dayOfWeekNum = -1; // Dia desconegut
    }

    let startDateTime, endDateTime;

    if (dayOfWeekNum !== -1) {
        // Trobem el moment que correspon a aquest dia de la setmana a la setmana actual
        // moment().day(X) posa al dia de la setmana X de la setmana actual
        let targetMoment = moment().day(dayOfWeekNum);

        // Si el dia ja ha passat aquesta setmana, assumeix la setmana següent
        if (targetMoment.isBefore(today, 'day') && today.day() !== dayOfWeekNum) {
            targetMoment.add(1, 'week');
        }

        // Parsejem l'hora i la combinem amb la data calculada
        const [hours, minutes] = item.time.split(':').map(Number);
        if (!isNaN(hours) && !isNaN(minutes)) {
            startDateTime = targetMoment.hours(hours).minutes(minutes).seconds(0).toDate();
            // Per a l'hora final, podem assumir que dura una hora per defecte
            endDateTime = moment(startDateTime).add(1, 'hour').toDate();
        } else {
            // Si l'hora no és vàlida, creem un event sense hora específica
            startDateTime = targetMoment.toDate();
            endDateTime = moment(startDateTime).add(1, 'hour').toDate();
        }
    } else {
        // En cas que el dia no sigui un dia de la setmana reconegut, o si no és vàlid
        // Podríem usar la data actual o posar-lo en un "calendari d'errors"
        console.warn(`Dia "${item.day}" no reconegut per a l'activitat "${item.title}". No es mostrarà al calendari.`);
        return null; // No retornem l'esdeveniment si no podem parsejar el dia
    }

    return {
      id: item._id, // Utilitzem l'ID de MongoDB
      title: item.title,
      start: startDateTime,
      end: endDateTime,
      allDay: false, // Perquè tenim una hora específica
    };
  }).filter(Boolean); // Filtra els elements nuls si no es van poder parsejar


  return (
    <div style={{ padding: '20px', maxWidth: '900px', margin: 'auto' }}>
      <h1>🕒 Ora - Gestor d'Horaris 2.0</h1>

      <div style={{ marginBottom: '20px' }}>
        <button onClick={startVoiceInput}>🎙️ Afegeix per veu</button>
      </div>

      <form onSubmit={handleSubmit} style={{ marginBottom: '30px', border: '1px solid #ccc', padding: '15px', borderRadius: '8px' }}>
        <h2>Afegir Activitat Manualment</h2>
        <input
          type="text"
          placeholder="Títol"
          value={title}
          onChange={e => setTitle(e.target.value)}
          required
          style={{ width: 'calc(100% - 22px)', padding: '10px', marginBottom: '10px', borderRadius: '4px', border: '1px solid #ddd' }}
        />
        <input
          type="text"
          placeholder="Dia (ex: dilluns)"
          value={day}
          onChange={e => setDay(e.target.value)}
          required
          style={{ width: 'calc(100% - 22px)', padding: '10px', marginBottom: '10px', borderRadius: '4px', border: '1px solid #ddd' }}
        />
        <input
          type="time"
          value={time}
          onChange={e => setTime(e.target.value)}
          required
          style={{ width: 'calc(100% - 22px)', padding: '10px', marginBottom: '10px', borderRadius: '4px', border: '1px solid #ddd' }}
        />
        <button type="submit" style={{ padding: '10px 15px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          Afegir manualment
        </button>
      </form>

      <div style={{ height: '700px', marginBottom: '30px' }}> {/* Altura per al calendari */}
        <h2>Calendari d'Activitats</h2>
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          titleAccessor="title"
          style={{ height: '100%' }}
          culture="ca" // Configura la cultura a català
          messages={{ // Missatges del calendari en català
            allDay: 'Tot el dia',
            previous: 'Anterior',
            next: 'Següent',
            today: 'Avui',
            month: 'Mes',
            week: 'Setmana',
            day: 'Dia',
            agenda: 'Agenda',
            date: 'Data',
            time: 'Hora',
            event: 'Esdeveniment',
            noEventsInRange: 'No hi ha esdeveniments en aquest rang.',
            showMore: total => `+ ${total} més`,
          }}
          // Event click handler (opcional, per si vols fer alguna cosa al fer clic a un esdeveniment)
          onSelectEvent={event => alert(`Activitat: ${event.title}\nDia: ${moment(event.start).format('LLLL')}`)}
        />
      </div>

      <h2 style={{ marginTop: '20px' }}>Llista d'Activitats (per a depuració)</h2>
      <ul style={{ marginTop: '10px', listStyle: 'none', padding: 0 }}>
        {schedule.map((item) => (
          <li key={item._id} style={{ border: '1px solid #eee', padding: '10px', marginBottom: '5px', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f9f9f9' }}>
            <span>{item.day} - {item.time} - {item.title}</span>
            <button
              onClick={() => handleDelete(item._id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2em', color: '#dc3545' }}
            >
              🗑️
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;