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

  // New states for the toggleable manual form
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualActivityTitle, setManualActivityTitle] = useState('');
  const [manualActivityDay, setManualActivityDay] = useState('');
  const [manualActivityTime, setManualActivityTime] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

const fetchSchedule = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/horaris`, {
      headers: {
        'Content-Type': 'application/json',
        'uid': user?.uid || ''
      }
    });
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
  const newActivity = { title, day, time, uid: user.uid };
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

// ...existing code...

const handleManualFormSubmit = async (e) => {
  e.preventDefault();
  if (!manualActivityTitle || !manualActivityDay || !manualActivityTime) return;
  const newActivity = {
    title: manualActivityTitle,
    day: manualActivityDay,
    time: manualActivityTime,
    uid: user.uid
  };
  try {
    const token = await user.getIdToken(); // Obté el token de l'usuari autenticat
    const response = await fetch(`${API_BASE_URL}/horaris`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(newActivity)
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    await fetchSchedule();
    setManualActivityTitle('');
    setManualActivityDay('');
    setManualActivityTime('');
    setShowManualForm(false);
    alert('Activitat manual afegida correctament!');
  } catch (error) {
    console.error("Error afegint activitat manual:", error);
    alert('No s\'ha pogut afegir l\'activitat manual.');
  }
};

const handleDelete = async (idToDelete) => {
  try {
    const response = await fetch(`${API_BASE_URL}/horaris/${idToDelete}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'uid': user?.uid || '' }
    });
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
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: transcript, uid: user.uid }) // <-- Afegeix el uid aquí!
      });

      const data = await resposta.json();
      const { title, day, hour, minuts } = data?.scheduleItem || {};

      if (!title || !day || !hour) {
        alert(data.fulfillmentText || 'Falten dades per afegir l\'activitat.');
        return;
      }

      let minutes = 0;
      if (minuts) {
        const m = minuts.toString().toLowerCase();
        if (['15', 'quinze', 'quart'].includes(m)) minutes = 15;
        else if (['30', 'trenta', 'mitja'].includes(m)) minutes = 30;
        else if (['45', 'quaranta-cinc'].includes(m)) minutes = 45;
      }

      const horaFinal = `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

      const newActivity = { title, day, time: horaFinal, uid: user.uid };

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

  // Toggle manual form
  const toggleManualForm = () => setShowManualForm(!showManualForm);

  return (
    <div style={{ padding: '20px', maxWidth: '900px', margin: 'auto', fontFamily: 'Inter, sans-serif' }}>
      <h1 style={{ textAlign: 'center', color: '#333' }}>🕒 Ora - Gestor d'Horaris 2.0</h1>

      {!user ? (
        <div style={{ marginBottom: '30px', border: '1px solid #ccc', padding: '15px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <h2 style={{ textAlign: 'center', marginBottom: '20px', color: '#555' }}>Registre / Inici de Sessió</h2>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input type="email" placeholder="Correu" value={email} onChange={e => setEmail(e.target.value)} required style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }} />
            <input type="password" placeholder="Contrasenya" value={password} onChange={e => setPassword(e.target.value)} required style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }} />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="submit" style={{ flex: 1, background: '#007bff', color: 'white', padding: '10px', borderRadius: '4px', border: 'none', cursor: 'pointer', transition: 'background 0.3s ease' }}>Iniciar Sessió</button>
              <button type="button" onClick={handleRegister} style={{ flex: 1, background: '#28a745', color: 'white', padding: '10px', borderRadius: '4px', border: 'none', cursor: 'pointer', transition: 'background 0.3s ease' }}>Registrar-se</button>
            </div>
          </form>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', padding: '10px', background: '#e9ecef', borderRadius: '8px' }}>
            <p style={{ margin: 0, fontWeight: 'bold' }}>Benvingut, {user.email}</p>
            <button onClick={handleLogout} style={{ background: '#dc3545', color: 'white', padding: '8px 15px', borderRadius: '4px', border: 'none', cursor: 'pointer', transition: 'background 0.3s ease' }}>Tancar Sessió</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '20px' }}>
            <button onClick={startVoiceInput} style={{ padding: '12px 20px', background: '#ffc107', color: '#333', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '1em', fontWeight: 'bold', transition: 'background 0.3s ease', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
              🎙️ Afegeix per veu
            </button>

            <button
              onClick={toggleManualForm}
              style={{ padding: '12px 20px', background: '#6f42c1', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '1em', fontWeight: 'bold', transition: 'background 0.3s ease', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
            >
              {showManualForm ? 'Amagar Formulari d\'Activitat Manual' : 'Afegir Nova Activitat Manual'}
            </button>

{showManualForm && (
  <div style={{
    marginTop: '20px',
    padding: '15px',
    background: '#e6f7ff',
    border: '1px solid #91d5ff',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    animation: 'fadeIn 0.3s ease-out forwards',
    maxWidth: '100%',
    boxSizing: 'border-box'
  }}>
    <h2 style={{ marginBottom: '15px', color: '#0056b3', textAlign: 'center' }}>Registrar Nova Activitat Manual</h2>
    <form onSubmit={handleManualFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '100%' }}>
      <input
        type="text"
        placeholder="Títol"
        value={manualActivityTitle}
        onChange={e => setManualActivityTitle(e.target.value)}
        required
        style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' }}
      />
      <select
        value={manualActivityDay}
        onChange={e => setManualActivityDay(e.target.value)}
        required
        style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' }}
      >
        <option value="">Selecciona el dia</option>
        <option value="Dilluns">Dilluns</option>
        <option value="Dimarts">Dimarts</option>
        <option value="Dimecres">Dimecres</option>
        <option value="Dijous">Dijous</option>
        <option value="Divendres">Divendres</option>
        <option value="Dissabte">Dissabte</option>
        <option value="Diumenge">Diumenge</option>
      </select>
      <input
        type="time"
        value={manualActivityTime}
        onChange={e => setManualActivityTime(e.target.value)}
        required
        style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' }}
      />
      <button
        type="submit"
        style={{ background: '#28a745', color: 'white', padding: '10px 15px', borderRadius: '4px', border: 'none', cursor: 'pointer', transition: 'background 0.3s ease' }}
      >
        Afegir manualment
      </button>
    </form>
  </div>
)}
          </div>

<div style={{
  height: '700px',
  marginTop: '30px',
  border: '1px solid #ccc',
  borderRadius: '8px',
  padding: '10px',
  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  display: 'flex',
  flexDirection: 'column'
}}>
  <h2 style={{ marginBottom: '15px', color: '#555' }}>Calendari</h2>
  <div style={{ flex: 1, minHeight: 0 }}>
    <Calendar
      localizer={localizer}
      events={events}
      startAccessor="start"
      endAccessor="end"
      titleAccessor="title"
      style={{ height: '100%', width: '100%' }}
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
</div>

          <h2 style={{ marginTop: '30px', color: '#555' }}>Llista d'Activitats</h2>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {schedule.length === 0 ? (
              <li style={{ padding: '15px', color: '#888', textAlign: 'center', fontStyle: 'italic' }}>
                No hi ha activitats.
              </li>
            ) : (
              schedule.map(item => (
                <li key={item._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: '#f9f9f9', marginBottom: '5px', borderRadius: '4px', border: '1px solid #eee' }}>
                  <span>{item.day} - {item.time} - {item.title}</span>
                  <button onClick={() => handleDelete(item._id)} style={{ background: 'none', border: 'none', color: '#dc3545', fontSize: '1.2em', cursor: 'pointer' }}>🗑️</button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

export default App;