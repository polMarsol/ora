import React, { useState, useEffect } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'moment/locale/ca';

import { auth } from './firebaseConfig';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';

moment.locale('ca');
const localizer = momentLocalizer(moment);
const API_BASE_URL = 'https://ora-28jb.onrender.com';

function App() {
  const [schedule, setSchedule] = useState([]);
  const [title, setTitle] = useState('');
  const [day, setDay] = useState('');
  const [time, setTime] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  const fetchSchedule = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/horaris`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      setSchedule(data);
    } catch (error) {
      console.error("Error carregant horaris:", error);
      const saved = localStorage.getItem('schedule');
      setSchedule(saved ? JSON.parse(saved) : []);
      alert('No s\'han pogut carregar els horaris del servidor. S\'usaran dades locals si hi ha.');
    }
  };

  useEffect(() => {
    if (user) fetchSchedule();
    else setSchedule([]);
  }, [user]);

  useEffect(() => {
    localStorage.setItem('schedule', JSON.stringify(schedule));
  }, [schedule]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title || !day || !time) return;
    const newActivity = { title, day, time };
    try {
      const response = await fetch(`${API_BASE_URL}/horaris`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newActivity)
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      await fetchSchedule();
      setTitle(''); setDay(''); setTime('');
      alert('Activitat afegida correctament!');
    } catch (error) {
      console.error("Error afegint activitat:", error);
      alert('No s\'ha pogut afegir l\'activitat.');
    }
  };

  const handleDelete = async (idToDelete) => {
    try {
      const response = await fetch(`${API_BASE_URL}/horaris/${idToDelete}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      await fetchSchedule();
      alert('Activitat eliminada correctament!');
    } catch (error) {
      console.error("Error eliminant activitat:", error);
      alert('No s\'ha pogut eliminar l\'activitat.');
    }
  };

  const startVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert('El navegador no suporta reconeixement de veu.');

    const recognition = new SpeechRecognition();
    recognition.lang = 'ca-ES';
    recognition.start();

    recognition.onresult = async (event) => {
  const transcript = event.results[0][0].transcript.toLowerCase();
  alert('Has dit: ' + transcript);

  try {
    const resposta = await fetch(`${API_BASE_URL}/process-dialogflow-voice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: transcript })
    });

    const data = await resposta.json();
    const { title, day, hour, minuts } = data?.scheduleItem || {};

    if (!title || !day || !hour) {
      alert(data.fulfillmentText || 'Falten dades per afegir l\'activitat.');
      return;
    }

    // Convertim "minuts" a números vàlids o 00
    let minutes = 0;
    if (minuts) {
      const m = minuts.toString().toLowerCase();
      if (['15', 'quinze', 'quart'].includes(m)) minutes = 15;
      else if (['30', 'trenta', 'mitja'].includes(m)) minutes = 30;
      else if (['45', 'quaranta-cinc'].includes(m)) minutes = 45;
    }

    // Formata hora com HH:mm
    const horaFinal = `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

    // Creem la nova activitat
    const newActivity = { title, day, time: horaFinal };

    const response = await fetch(`${API_BASE_URL}/horaris`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newActivity)
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    await fetchSchedule();
    alert(data.fulfillmentText || 'Activitat afegida!');
  } catch (err) {
    console.error('Error veu:', err);
    alert('Error en processar veu.');
  }
};


    recognition.onerror = (event) => {
      console.error('Error reconeixement:', event.error);
      alert('Error reconeixement: ' + event.error);
    };
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      alert('Registre completat!');
    } catch (error) {
      alert(`Error al registrar-se: ${error.message}`);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      alert('Sessió iniciada!');
    } catch (error) {
      alert(`Error a l'iniciar sessió: ${error.message}`);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      alert('Sessió tancada.');
      setSchedule([]);
    } catch (error) {
      alert(`Error al tancar sessió: ${error.message}`);
    }
  };

const events = schedule.map(item => {
  const dayMap = {
    'diumenge': 0,
    'dilluns': 1,
    'dimarts': 2,
    'dimecres': 3,
    'dijous': 4,
    'divendres': 5,
    'dissabte': 6
  };
  const dayOfWeekNum = dayMap[item.day?.toLowerCase()];
  if (dayOfWeekNum === undefined || !item.time || !/^\d{2}:\d{2}$/.test(item.time)) return null;

  const [hours, minutes] = item.time.split(':').map(Number);
  let targetMoment = moment().day(dayOfWeekNum).hours(hours).minutes(minutes).seconds(0);

  // Si ja ha passat aquest moment, avança una setmana
  if (targetMoment.isBefore(moment())) {
    targetMoment.add(1, 'week');
  }

  const startDateTime = targetMoment.toDate();
  const endDateTime = moment(targetMoment).add(1, 'hour').toDate();

  return {
    id: item._id,
    title: item.title,
    start: startDateTime,
    end: endDateTime,
    allDay: false
  };
}).filter(Boolean);


  if (loadingAuth) return <div style={{ padding: '20px', textAlign: 'center' }}><h1>Carregant usuari...</h1></div>;

  return (
    <div style={{ padding: '20px', maxWidth: '900px', margin: 'auto' }}>
      <h1>🕒 Ora - Gestor d'Horaris 2.0</h1>

      {!user ? (
        <div style={{ marginBottom: '30px', border: '1px solid #ccc', padding: '15px', borderRadius: '8px' }}>
          <h2>Registre / Inici de Sessió</h2>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column' }}>
            <input type="email" placeholder="Correu" value={email} onChange={e => setEmail(e.target.value)} required style={{ padding: '10px', marginBottom: '10px' }} />
            <input type="password" placeholder="Contrasenya" value={password} onChange={e => setPassword(e.target.value)} required style={{ padding: '10px', marginBottom: '10px' }} />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="submit" style={{ flex: 1, background: '#007bff', color: 'white', padding: '10px' }}>Iniciar Sessió</button>
              <button type="button" onClick={handleRegister} style={{ flex: 1, background: '#28a745', color: 'white', padding: '10px' }}>Registrar-se</button>
            </div>
          </form>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <p>Benvingut, {user.email}</p>
            <button onClick={handleLogout} style={{ background: '#dc3545', color: 'white', padding: '8px' }}>Tancar Sessió</button>
          </div>

          <button onClick={startVoiceInput} style={{ marginTop: '20px', padding: '10px' }}>🎙️ Afegeix per veu</button>

          <form onSubmit={handleSubmit} style={{ marginTop: '20px', border: '1px solid #ccc', padding: '15px' }}>
            <h2>Afegir Activitat</h2>
            <input type="text" placeholder="Títol" value={title} onChange={e => setTitle(e.target.value)} required style={{ width: '100%', padding: '10px', marginBottom: '10px' }} />
            <input type="text" placeholder="Dia (ex: dilluns)" value={day} onChange={e => setDay(e.target.value)} required style={{ width: '100%', padding: '10px', marginBottom: '10px' }} />
            <input type="time" value={time} onChange={e => setTime(e.target.value)} required style={{ width: '100%', padding: '10px', marginBottom: '10px' }} />
            <button type="submit" style={{ background: '#28a745', color: 'white', padding: '10px' }}>Afegir manualment</button>
          </form>

          <div style={{ height: '700px', marginTop: '30px' }}>
            <h2>Calendari</h2>
            <Calendar
              localizer={localizer}
              events={events}
              startAccessor="start"
              endAccessor="end"
              titleAccessor="title"
              style={{ height: '100%' }}
              culture="ca"
              messages={{
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
                noEventsInRange: 'No hi ha esdeveniments.',
                showMore: total => `+ ${total} més`,
              }}
              onSelectEvent={event => alert(`Activitat: ${event.title}\nData: ${moment(event.start).format('LLLL')}`)}
            />
          </div>

          <h2>Llista d'Activitats</h2>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {schedule.map(item => (
              <li key={item._id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: '#f9f9f9', marginBottom: '5px' }}>
                <span>{item.day} - {item.time} - {item.title}</span>
                <button onClick={() => handleDelete(item._id)} style={{ background: 'none', color: '#dc3545', fontSize: '1.2em' }}>🗑️</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default App;
