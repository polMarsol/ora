import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'moment/locale/ca';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import UniSchedule from './UniSchedule.js';

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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [loadingSchedule, setLoadingSchedule] = useState(false);

  const [showManualForm, setShowManualForm] = useState(false);
  const [manualActivityTitle, setManualActivityTitle] = useState('');
  const [manualActivityDay, setManualActivityDay] = useState('');
  const [manualActivityTime, setManualActivityTime] = useState('');

  const [showUniSchedule, setShowUniSchedule] = useState(false);
  
  // Nous estats per a la confirmació de veu
  const [pendingVoiceQuery, setPendingVoiceQuery] = useState(null); // Guardarà la transcripció de l'àudio
  const [showVoiceConfirmation, setShowVoiceConfirmation] = useState(false); // Controlar la visibilitat dels botons

  // Nou estat per mostrar/ocultar el diàleg d'ajuda
  const [showVoiceHelp, setShowVoiceHelp] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

const fetchSchedule = useCallback(async () => {
  if (!user) {
    setSchedule([]);
    return;
  }
  setLoadingSchedule(true);
  try {
    const token = await user.getIdToken();
    const response = await fetch(`${API_BASE_URL}/horaris`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'uid': user.uid // <-- AFEGEIX AIXÒ!
      }
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    setSchedule(data);
  } catch (error) {
    console.error("Error carregant horaris:", error);
    const saved = localStorage.getItem('schedule');
    setSchedule(saved ? JSON.parse(saved) : []);
    toast.error('No s\'han pogut carregar els horaris del servidor. S\'usaran dades locals si hi ha.');
  } finally {
    setLoadingSchedule(false);
  }
}, [user]);

  useEffect(() => {
    if (user) {
      fetchSchedule();
    } else {
      setSchedule([]);
    }
  }, [user, fetchSchedule]);

  useEffect(() => {
    localStorage.setItem('schedule', JSON.stringify(schedule));
  }, [schedule]);

  const handleManualFormSubmit = async (e) => {
    e.preventDefault();
    if (!manualActivityTitle || !manualActivityDay || !manualActivityTime) {
      toast.warn('Si us plau, omple tots els camps per a l\'activitat manual.');
      return;
    }
    if (!user) {
      toast.error('Cal iniciar sessió per afegir activitats.');
      return;
    }

    const newActivity = {
      title: manualActivityTitle,
      day: manualActivityDay,
      time: manualActivityTime,
      uid: user.uid
    };
    try {
      const token = await user.getIdToken();
      const response = await fetch(`${API_BASE_URL}/horaris`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newActivity)
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.error}`);
      }
      await fetchSchedule();
      setManualActivityTitle('');
      setManualActivityDay('');
      setManualActivityTime('');
      setShowManualForm(false);
      toast.success('Activitat manual afegida correctament!');
    } catch (error) {
      console.error("Error afegint activitat manual:", error);
      toast.error(`No s'ha pogut afegir l'activitat manual: ${error.message}`);
    }
  };

const handleDelete = async (idToDelete) => {
  if (!user) {
    toast.error('Cal iniciar sessió per eliminar activitats.');
    return;
  }
  if (window.confirm('Estàs segur que vols eliminar aquesta activitat?')) {
    try {
      const token = await user.getIdToken();
      const response = await fetch(`${API_BASE_URL}/horaris/${idToDelete}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'uid': user.uid // <-- AFEGEIX AIXÒ!
        }
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.error}`);
      }
      await fetchSchedule();
      toast.success('Activitat eliminada correctament!');
    } catch (error) {
      console.error("Error eliminant activitat:", error);
      toast.error(`No s'ha pogut eliminar l'activitat: ${error.message}`);
    }
  }
};

const startVoiceInput = () => {
  if (!user || !user.uid) {
    toast.error('Cal iniciar sessió per afegir activitats per veu.');
    return;
  }
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    toast.error('El navegador no suporta reconeixement de veu.');
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = 'ca-ES';
  recognition.start();
  toast.info('Escoltant...');

  recognition.onresult = async (event) => {
    const transcript = event.results[0][0].transcript.toLowerCase();

    // Dies de la setmana en català
    const diesSetmana = [
      'diumenge', 'dilluns', 'dimarts', 'dimecres', 'dijous', 'divendres', 'dissabte'
    ];

    if (transcript.includes('quines pràctiques tinc')) {
      window.open('https://entregasudl.live/igualada', '_blank');
      setPendingVoiceQuery(null);
      setShowVoiceConfirmation(false);
      return;
    }

if (transcript.includes('horari uni') || transcript.includes('quin és el meu horari')) {
  toast.info('Obrint horari universitari...');
  setShowUniSchedule(true);
  setPendingVoiceQuery(null);
  setShowVoiceConfirmation(false);
  return;
}

    // Comprova si la frase és "que tinc [dia]"
    const match = transcript.match(/què tinc el\s+(diumenge|dilluns|dimarts|dimecres|dijous|divendres|dissabte)/i);
    if (match) {
      const dia = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
      const activitatsDia = schedule.filter(item => item.day?.toLowerCase() === dia.toLowerCase());
      if (activitatsDia.length === 0) {
        const utter = new window.SpeechSynthesisUtterance(`Oh no, noooo, la polizia. No tens cap activitat programada el ${dia}.` + user.email.split('@')[0].trim());
        utter.lang = 'ca-ES';
        window.speechSynthesis.speak(utter);
      } else {
        const text = activitatsDia
          .map(item => `a les ${item.time}, ${item.title}`)
          .join('. ');
        toast.info(`Recitant les teves activitats del ${dia}.`);
        const utter = new window.SpeechSynthesisUtterance(`Hola de nou,` +user.email.split('@')[0].trim()+ `. Les teves activitats el ${dia} són: ${text}`);
        utter.lang = 'ca-ES';
        window.speechSynthesis.speak(utter);
      }
      setPendingVoiceQuery(null);
      setShowVoiceConfirmation(false);
      return;
    }

    // Consulta general d'horari
    if (
      transcript.includes('quin és el meu horari') ||
      transcript.includes('que tinc') ||
      transcript.includes('quines activitats tinc') ||
      transcript.includes('horari')
    ) {
      toast.info('Recitant les teves activitats.');
      if (schedule.length === 0) {
        const utter = new window.SpeechSynthesisUtterance('Oh no! No tens cap activitat programada.' );
        utter.lang = 'ca-ES';
        window.speechSynthesis.speak(utter);
      } else {
        const text = schedule
          .map(item => `${item.day}, a les ${item.time}, ${item.title}`)
          .join('. ');
        const utter = new window.SpeechSynthesisUtterance(`Benvingut de nou` + user.email.split('@')[0].trim()+'. Les teves activitats són: ' + text);
        utter.lang = 'ca-ES';
        window.speechSynthesis.speak(utter);
      }
      setPendingVoiceQuery(null);
      setShowVoiceConfirmation(false);
      return;
    }

    setPendingVoiceQuery(transcript);
    setShowVoiceConfirmation(true);
  };

  recognition.onerror = (event) => {
    console.error('Error reconeixement:', event.error);
    toast.error('Error reconeixement: ' + event.error);
    setPendingVoiceQuery(null);
    setShowVoiceConfirmation(false);
  };
};

  const confirmVoiceInput = async () => {
    if (!pendingVoiceQuery || !user) return;

    try {
      const token = await user.getIdToken();
      const resposta = await fetch(`${API_BASE_URL}/process-dialogflow-voice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ query: pendingVoiceQuery, uid: user.uid })
      });

      const data = await resposta.json();
      const { title, day, time } = data?.scheduleItem || {};

      if (!title || !day || !time) {
        toast.warn(data.fulfillmentText || 'Falten dades per afegir l\'activitat.');
      } else {
        await fetchSchedule();
        toast.success(data.fulfillmentText || 'Activitat afegida!');
      }
    } catch (err) {
      console.error('Error processant veu confirmada:', err);
      toast.error('Error en processar la veu confirmada: ' + err.message);
    } finally {
      setPendingVoiceQuery(null); // Neteja l'estat
      setShowVoiceConfirmation(false); // Amaga els botons
    }
  };

  const cancelVoiceInput = () => {
    setPendingVoiceQuery(null); // Neteja l'estat
    setShowVoiceConfirmation(false); // Amaga els botons
    toast.info('Activitat de veu cancel·lada.');
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      toast.success('Registre completat!');
    } catch (error) {
      toast.error(`Error al registrar-se: ${error.message}`);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast.success('Sessió iniciada!');
    } catch (error) {
      toast.error(`Error a l'iniciar sessió: ${error.message}`);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.info('Sessió tancada.');
      setSchedule([]);
    } catch (error) {
      toast.error(`Error al tancar sessió: ${error.message}`);
    }
  };

  const events = schedule.map(item => {
    const dayMap = {
      'diumenge': 0, 'dilluns': 1, 'dimarts': 2, 'dimecres': 3, 'dijous': 4, 'divendres': 5, 'dissabte': 6
    };
    const dayOfWeekNum = dayMap[item.day?.toLowerCase()];
    if (dayOfWeekNum === undefined || !item.time || !/^\d{2}:\d{2}$/.test(item.time)) return null;

    const [hours, minutes] = item.time.split(':').map(Number);
    let targetMoment = moment().day(dayOfWeekNum).hours(hours).minutes(minutes).seconds(0);

    if (targetMoment.isBefore(moment())) {
      targetMoment = targetMoment.add(1, 'week');
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
    <div style={{ padding: '20px', maxWidth: '900px', margin: 'auto', fontFamily: 'Inter, sans-serif', position: 'relative' }}>
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover />

      {/* Botó d'informació a dalt a la dreta */}
      <button
        onClick={() => setShowVoiceHelp(true)}
        style={{
          position: 'absolute',
          top: 20,
          right: 20,
          background: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '50%',
          width: '40px',
          height: '40px',
          fontSize: '1.5em',
          cursor: 'pointer',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}
        aria-label="Ajuda comandes de veu"
        title="Ajuda comandes de veu"
      >i</button>

      {/* Diàleg d'ajuda de comandes de veu */}
      {showVoiceHelp && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.3)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: 'white', padding: '30px 20px', borderRadius: '12px', maxWidth: '400px', width: '90%',
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)', position: 'relative'
          }}>
            <button
              onClick={() => setShowVoiceHelp(false)}
              style={{
                position: 'absolute', top: 10, right: 15, background: 'none', border: 'none', fontSize: '1.5em', color: '#888', cursor: 'pointer'
              }}
              aria-label="Tancar ajuda"
            >&times;</button>
            <h2 style={{ marginTop: 0, color: '#007bff', textAlign: 'center' }}>ℹ️ Comandes de veu</h2>
            <ul style={{ paddingLeft: '20px', color: '#333', fontSize: '1em' }}>
              <li><b>Afegir activitat:</b> <br /> <i>dilluns a les 10 matemàtiques</i></li>
              <li><b>Consultar tot l'horari:</b> <br /> <i>quin és el meu horari</i>, <i>quines activitats tinc</i>, <i>horari</i></li>
              <li><b>Consultar activitats d'un dia:</b> <br /> <i>que tinc dilluns</i>, <i>que tinc dimarts</i>, ...</li>
            </ul>
          </div>
        </div>
      )}

      
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

            {showVoiceConfirmation && pendingVoiceQuery && (
              <div style={{
                marginTop: '10px',
                padding: '15px',
                background: '#fff3cd', // Color groc clar
                border: '1px solid #ffeeba',
                borderRadius: '8px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                textAlign: 'center',
                animation: 'fadeIn 0.3s ease-out forwards',
              }}>
                <p style={{ margin: '0 0 10px 0', fontWeight: 'bold', color: '#856404' }}>
                  Has dit: "{pendingVoiceQuery}"
                </p>
                <p style={{ margin: '0 0 15px 0', color: '#856404' }}>
                  És correcte?
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                  <button
                    onClick={confirmVoiceInput}
                    style={{ background: '#28a745', color: 'white', padding: '10px 20px', borderRadius: '4px', border: 'none', cursor: 'pointer', transition: 'background 0.3s ease' }}
                  >
                    ✅ Acceptar
                  </button>
                  <button
                    onClick={cancelVoiceInput}
                    style={{ background: '#dc3545', color: 'white', padding: '10px 20px', borderRadius: '4px', border: 'none', cursor: 'pointer', transition: 'background 0.3s ease' }}
                  >
                    ❌ Cancel·lar
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={() => setShowManualForm(!showManualForm)}
              style={{ padding: '12px 20px', background: '#6f42c1', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '1em', fontWeight: 'bold', transition: 'background 0.3s ease', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
            >
              {showManualForm ? 'Amagar Formulari d\'Activitat Manual' : 'Afegir Nova Activitat Manual'}
            </button>

            {showManualForm && (
              <div style={{
                marginTop: '20px', padding: '15px', background: '#e6f7ff', border: '1px solid #91d5ff', borderRadius: '8px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)', animation: 'fadeIn 0.3s ease-out forwards', maxWidth: '100%', boxSizing: 'border-box'
              }}>
                <h2 style={{ marginBottom: '15px', color: '#0056b3', textAlign: 'center' }}>Registrar Nova Activitat Manual</h2>
                <form onSubmit={handleManualFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '100%' }}>
                  <input type="text" placeholder="Títol" value={manualActivityTitle} onChange={e => setManualActivityTitle(e.target.value)} required
                    style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' }}
                  />
                  <select value={manualActivityDay} onChange={e => setManualActivityDay(e.target.value)} required
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
                  <input type="time" value={manualActivityTime} onChange={e => setManualActivityTime(e.target.value)} required
                    style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' }}
                  />
                  <button type="submit"
                    style={{ background: '#28a745', color: 'white', padding: '10px 15px', borderRadius: '4px', border: 'none', cursor: 'pointer', transition: 'background 0.3s ease' }}
                  >
                    Afegir manualment
                  </button>
                </form>
              </div>
            )}
          </div>

          <div style={{ height: '700px', marginTop: '30px', border: '1px solid #ccc', borderRadius: '8px', padding: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ marginBottom: '15px', color: '#555' }}>Calendari</h2>
            {loadingSchedule ? (
                <div style={{ textAlign: 'center', padding: '20px' }}>Carregant horaris...</div>
            ) : (
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
                            allDay: 'Tot el dia', previous: 'Anterior', next: 'Següent', today: 'Avui', month: 'Mes',
                            week: 'Setmana', day: 'Dia', agenda: 'Agenda', date: 'Data', time: 'Hora', event: 'Esdeveniment',
                            noEventsInRange: 'No hi ha esdeveniments.', showMore: total => `+ ${total} més`,
                        }}
                        onSelectEvent={event => toast.info(`Activitat: ${event.title}\nData: ${moment(event.start).format('LLLL')}`)}
                    />
                </div>
            )}
          </div>

          <h2 style={{ marginTop: '30px', color: '#555' }}>Llista d'Activitats</h2>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {schedule.length === 0 && !loadingSchedule ? (
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

          {showUniSchedule && (
  <div style={{
    position: 'fixed',
    top: 0, left: 0, width: '100vw', height: '100vh',
    background: 'rgba(0,0,0,0.4)', zIndex: 2000,
    display: 'flex', alignItems: 'center', justifyContent: 'center'
  }}>
    <div style={{
      background: 'white', padding: '30px 20px', borderRadius: '16px', maxWidth: '900px', width: '95%',
      boxShadow: '0 8px 32px rgba(0,0,0,0.25)', position: 'relative'
    }}>
      <button
        onClick={() => setShowUniSchedule(false)}
        style={{
          position: 'absolute', top: 10, right: 15, background: 'none', border: 'none', fontSize: '2em', color: '#888', cursor: 'pointer'
        }}
        aria-label="Tancar horari universitari"
      >&times;</button>
      <UniSchedule />
    </div>
  </div>
)}
        </div>
      )}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

export default App;