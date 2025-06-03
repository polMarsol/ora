import React, { useState, useEffect } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'moment/locale/ca'; // Carrega el local català per a moment

// Importa Firebase Auth
import { auth } from './firebaseConfig';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';

// Configura moment en català
moment.locale('ca');
const localizer = momentLocalizer(moment);

// Defineix la URL base del backend
// IMPORTANT: SUBSTITUEIX AQUESTA URL AMB LA TEVA URL DE BACKEND DE RENDER.COM O SIMILAR
const API_BASE_URL = 'https://ora-44gf.onrender.com';//***************************************************************************************************************************************** */

function App() {
  const [schedule, setSchedule] = useState([]);
  const [title, setTitle] = useState('');
  const [day, setDay] = useState('');
  const [time, setTime] = useState('');

  // Estats per a l'autenticació
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [user, setUser] = useState(null); // Aquí es guardarà l'objecte usuari de Firebase
  const [loadingAuth, setLoadingAuth] = useState(true); // Per saber si Firebase ja ha carregat l'estat d'autenticació

  // Efecte per monitoritzar l'estat d'autenticació de Firebase
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoadingAuth(false); // Ja hem comprovat l'estat
    });
    return () => unsubscribe(); // Neteja el listener en desmuntar el component
  }, []);

  // Funció per carregar horaris de MongoDB
  const fetchSchedule = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/horaris`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setSchedule(data);
    } catch (error) {
      console.error("Error carregant horaris de MongoDB:", error);
      // Fallback a localStorage si el servidor no respon
      const saved = localStorage.getItem('schedule');
      setSchedule(saved ? JSON.parse(saved) : []);
      alert('No s\'han pogut carregar els horaris del servidor. Es carreguen els guardats localment (si n\'hi ha).');
    }
  };

  // Carrega horaris en muntar el component o quan l'usuari canvia
  useEffect(() => {
    if (user) { // Només carreguem horaris si l'usuari està logat
      fetchSchedule();
    } else {
      setSchedule([]); // Buidem l'horari si no hi ha usuari logat
    }
  }, [user]); // Re-executa quan canvia l'usuari

  // Guarda a localStorage com a còpia de seguretat (independent de l'autenticació)
  useEffect(() => {
    localStorage.setItem('schedule', JSON.stringify(schedule));
  }, [schedule]);

  // Gestió de l'enviament manual de l'activitat
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title || !day || !time) return;

    const newActivity = { title, day, time };
    try {
      const response = await fetch(`${API_BASE_URL}/horaris`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newActivity)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      await fetchSchedule(); // Recarregar per actualitzar el calendari
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
      const response = await fetch(`${API_BASE_URL}/horaris/${idToDelete}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      await fetchSchedule(); // Recarregar per actualitzar el calendari
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
        const resposta = await fetch(`${API_BASE_URL}/process-dialogflow-voice`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ query: transcript })
        });

        const data = await resposta.json();
        console.log('Resposta del backend (després de Dialogflow):', data);

        if (data && data.scheduleItem && data.scheduleItem.day && data.scheduleItem.time && data.scheduleItem.title && data.scheduleItem._id) {
          await fetchSchedule(); // Recarregar per actualitzar el calendari
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

  // Funcions d'autenticació de Firebase
  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      alert('Registre exitós! Ja has iniciat sessió.');
    } catch (error) {
      console.error('Error al registrar-se:', error.message);
      alert(`Error al registrar-se: ${error.message}`);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      alert('Inici de sessió exitós!');
    } catch (error) {
      console.error('Error a l\'iniciar sessió:', error.message);
      alert(`Error a l\'iniciar sessió: ${error.message}`);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      alert('Sessió tancada correctament.');
      setSchedule([]); // Buidem l'horari en tancar sessió
    } catch (error) {
      console.error('Error al tancar sessió:', error.message);
      alert(`Error al tancar sessió: ${error.message}`);
    }
  };

  // Adaptació de les activitats per al calendari
  const events = schedule.map(item => {
    const today = moment();
    let dayOfWeekNum;
    const dayName = item.day.toLowerCase();

    // Map the day name to a moment.js day of week number (0 for Sunday, 1 for Monday, etc.)
    switch (dayName) {
        case 'dilluns': dayOfWeekNum = 1; break;
        case 'dimarts': dayOfWeekNum = 2; break;
        case 'dimecres': dayOfWeekNum = 3; break;
        case 'dijous': dayOfWeekNum = 4; break;
        case 'divendres': dayOfWeekNum = 5; break;
        case 'dissabte': dayOfWeekNum = 6; break;
        case 'diumenge': dayOfWeekNum = 0; break;
        default: dayOfWeekNum = -1; // Day not recognized
    }

    let startDateTime, endDateTime;

    if (dayOfWeekNum !== -1) {
        // Find the moment for this day of the week in the current or next week
        let targetMoment = moment().day(dayOfWeekNum);

        // If the day has already passed this week, move it to next week
        // This is a simple heuristic; for recurrent events, you'd need a more robust system.
        if (targetMoment.isBefore(today, 'day') && today.day() !== dayOfWeekNum) {
            targetMoment.add(1, 'week');
        }

        // Parse time and combine with the calculated date
        const [hours, minutes] = item.time.split(':').map(Number);
        if (!isNaN(hours) && !isNaN(minutes)) {
            startDateTime = targetMoment.hours(hours).minutes(minutes).seconds(0).toDate();
            // Default event duration to 1 hour
            endDateTime = moment(startDateTime).add(1, 'hour').toDate();
        } else {
            console.warn(`Hora "${item.time}" no vàlida per a l'activitat "${item.title}". Usant hora per defecte.`);
            startDateTime = targetMoment.toDate();
            endDateTime = moment(startDateTime).add(1, 'hour').toDate();
        }
    } else {
        console.warn(`Dia "${item.day}" no reconegut per a l'activitat "${item.title}". No es mostrarà al calendari.`);
        return null; // Don't return event if day can't be parsed
    }

    return {
      id: item._id, // Use MongoDB ID for event key
      title: item.title,
      start: startDateTime,
      end: endDateTime,
      allDay: false, // Specific time events
    };
  }).filter(Boolean); // Filter out nulls if parsing failed


  // Si l'estat de càrrega d'autenticació és true, mostrem un missatge de càrrega
  if (loadingAuth) {
    return (
      <div style={{ padding: '20px', maxWidth: '600px', margin: 'auto', textAlign: 'center' }}>
        <h1>Carregant usuari...</h1>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '900px', margin: 'auto' }}>
      <h1>🕒 Ora - Gestor d'Horaris 2.0</h1>

      {!user ? ( // Mostra el formulari de registre/login si no hi ha usuari autenticat
        <div style={{ marginBottom: '30px', border: '1px solid #ccc', padding: '15px', borderRadius: '8px' }}>
          <h2>Registre / Inici de Sessió</h2>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column' }}>
            <input
              type="email"
              placeholder="Correu electrònic"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ padding: '10px', marginBottom: '10px', borderRadius: '4px', border: '1px solid #ddd' }}
            />
            <input
              type="password"
              placeholder="Contrasenya"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ padding: '10px', marginBottom: '10px', borderRadius: '4px', border: '1px solid #ddd' }}
            />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="submit" style={{ flex: 1, padding: '10px 15px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                Iniciar Sessió
              </button>
              <button type="button" onClick={handleRegister} style={{ flex: 1, padding: '10px 15px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                Registrar-se
              </button>
            </div>
          </form>
        </div>
      ) : ( // Mostra el contingut de l'aplicació si l'usuari està logat
        <div>
          <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p>Benvingut, {user.email}!</p>
            <button onClick={handleLogout} style={{ padding: '8px 12px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              Tancar Sessió
            </button>
          </div>

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

          <div style={{ height: '700px', marginBottom: '30px' }}>
            <h2>Calendari d'Activitats</h2>
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
                noEventsInRange: 'No hi ha esdeveniments en aquest rang.',
                showMore: total => `+ ${total} més`,
              }}
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
      )}
    </div>
  );
}

export default App;
