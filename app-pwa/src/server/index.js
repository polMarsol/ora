const express = require('express');
const bodyParser = require('body-parser');
const { MongoClient } = require('mongodb');
const cors = require('cors');
require('dotenv').config();

// --- Importaciones clave de Dialogflow y UUID ---
const { SessionsClient } = require('@google-cloud/dialogflow');
const { v4: uuidv4 } = require('uuid');
// --- FIN Importaciones ---

const app = express();
app.use(bodyParser.json());
app.use(cors()); // Habilita CORS para todas las rutas

const uri = process.env.MONGO_URI; // Asegúrate de que MONGO_URI está en tu archivo .env
const client = new MongoClient(uri);
let db;

// --- Configuración de Dialogflow ---
// ¡IMPORTANTE! Asegúrate de que 'dialogflow_credentials.json' está en la MISMA carpeta que este archivo (server/index.js).
// Este archivo se descarga desde tu cuenta de servicio de Google Cloud.
process.env.GOOGLE_APPLICATION_CREDENTIALS = './dialogflow_credentials.json';

// Lo encuentras en la consola de Dialogflow, en la configuración del agente.
const projectId = 'gestorhoraris-sdoj'; 
const sessionClient = new SessionsClient();
// --- FIN Configuración ---

async function connectDB() {
  try {
    await client.connect();
    db = client.db('ora'); // Base de datos "ora"
    console.log('📦 Connexió MongoDB OK');
  } catch (error) {
    console.error('❌ Error al conectar a MongoDB:', error);
    process.exit(1); // Sale de la aplicación si no puede conectar a la DB
  }
}

connectDB(); // Llamada para conectar la DB al iniciar el servidor

// Endpoint para que el frontend envíe la voz al backend
app.post('/process-dialogflow-voice', async (req, res) => {
  const query = req.body.query; // El transcript de voz enviado por el frontend
  if (!query) {
    return res.status(400).json({ error: 'Query de voz no proporcionada.' });
  }

  const sessionId = uuidv4(); // Genera un ID de sesión único para cada conversación
  const sessionPath = sessionClient.projectAgentSessionPath(projectId, sessionId);

  const request = {
    session: sessionPath,
    queryInput: {
      text: {
        text: query,
        languageCode: 'ca', // Asegúrate de que este idioma coincida con el de tu agente de Dialogflow
      },
    },
  };

  try {
    console.log(`[process-dialogflow-voice] Enviando a Dialogflow: "${query}" para el proyecto ${projectId}`);
    const responses = await sessionClient.detectIntent(request);
    const result = responses[0].queryResult;

    console.log('[process-dialogflow-voice] Respuesta de Dialogflow recibida:', JSON.stringify(result, null, 2)); // Usamos JSON.stringify para ver el objeto completo

    // Verifica si Dialogflow detectó el intento "AfegirHorari"
    if (result.intent && result.intent.displayName === 'AfegirHorari') {
      // --- ¡CORRECCIÓN CLAVE EN LA EXTRACCIÓN DE PARÁMETROS! ---
      const parameters = result.parameters.fields; // Accedemos al objeto 'fields'

      const horari = {
        // Acceso robusto a los valores, usando `?.` para seguridad y `?? ''` para valores por defecto
        title: parameters.title?.stringValue ?? '',
        day: parameters.day?.stringValue ?? '',
        time: parameters.time?.stringValue ?? '',
      };
      // --- FIN CORRECCIÓN ---

      console.log(`[process-dialogflow-voice] Parámetros extraídos: title: "${horari.title}", day: "${horari.day}", time: "${horari.time}"`);


      // Validar que los parámetros esenciales existen antes de guardar
      if (!horari.title || !horari.day || !horari.time) {
        console.warn('[process-dialogflow-voice] Parámetros incompletos recibidos de Dialogflow para guardar:', horari);
        return res.json({
          fulfillmentText: result.fulfillmentText || 'Ho sento, no he pogut extreure tota la informació (títol, dia, hora) de la teva petició. Podries especificar-ho millor?',
          error: 'Parámetros incompletos de Dialogflow.'
        });
      }

      // Guarda el horario en MongoDB
      await db.collection('horaris').insertOne(horari);
      console.log('[process-dialogflow-voice] Horario guardado en MongoDB:', horari);

      // Envía una respuesta al frontend con el item guardado y el mensaje de Dialogflow
      return res.json({
        fulfillmentText: result.fulfillmentText || `Activitat "${horari.title}" afegida per ${horari.day} a les ${horari.time}.`, // Proporciona un fulfillmentText por defecto
        scheduleItem: horari
      });

    } else {
      // Si Dialogflow no detectó el intento "AfegirHorari" o faltaron cosas
      console.log('[process-dialogflow-voice] Intento no reconocido o no fue "AfegirHorari".');
      return res.json({
        fulfillmentText: result.fulfillmentText || 'No he entès la teva petició. Podries ser més específic per afegir un horari?',
        error: 'Intento no reconocido o parámetros insuficientes.'
      });
    }

  } catch (error) {
    console.error('[process-dialogflow-voice] Error al comunicarse con Dialogflow:', error);
    res.status(500).json({ error: 'Error al procesar la solicitud de voz con Dialogflow.', details: error.message });
  }
});

// Endpoint para Dialogflow (este seguirá siendo llamado por Dialogflow directamente cuando el intent tenga el webhook habilitado)
app.post('/webhook', async (req, res) => {
  try {
    const intent = req.body.queryResult.intent.displayName;
    const parameters = req.body.queryResult.parameters; // Estos ya vienen parseados si el webhook se activa

    console.log('[webhook] Webhook de Dialogflow activado. Intent:', intent);
    console.log('[webhook] Parámetros de Dialogflow (desde webhook):', parameters);

    if (intent === 'AfegirHorari') {
      const horari = {
        title: parameters['title'],
        day: parameters['day'], // Usamos 'day' si es el nombre del parámetro en Dialogflow
        time: parameters['time'],
        createdAt: new Date()
      };

      if (!horari.title || !horari.day || !horari.time) {
        console.warn('[webhook] Parámetros incompletos recibidos de Dialogflow (desde el webhook):', parameters);
        return res.json({ fulfillmentText: 'Ho sento, necessito el títol, el dia i l\'hora per afegir l\'activitat.' });
      }

      await db.collection('horaris').insertOne(horari);

      const resposta = `Activitat "${horari.title}" afegida per ${horari.day} a les ${horari.time}.`;
      console.log('[webhook] Respuesta del webhook a Dialogflow:', resposta);
      return res.json({ fulfillmentText: resposta });
    }

    console.log('[webhook] Intención no manejada por el webhook:', intent);
    res.json({ fulfillmentText: 'No he entès la petició del webhook.' });
  } catch (error) {
    console.error('[webhook] Error en el endpoint /webhook:', error);
    res.status(500).json({ fulfillmentText: 'Hi ha hagut un error intern en el webhook.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor actiu al port ${PORT}`));