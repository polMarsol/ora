const express = require('express');
const bodyParser = require('body-parser');
const { MongoClient } = require('mongodb');
const cors = require('cors');
require('dotenv').config();

const { SessionsClient } = require('@google-cloud/dialogflow');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(bodyParser.json());
app.use(cors());

const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);
let db;

process.env.GOOGLE_APPLICATION_CREDENTIALS = './dialogflow_credentials.json';
const projectId = 'gestorhoraris-sdoj';
const sessionClient = new SessionsClient();

async function connectDB() {
  try {
    await client.connect();
    db = client.db('Ora');
    console.log('📦 Connexió MongoDB OK');
  } catch (error) {
    console.error('❌ Error al conectar a MongoDB:', error);
    process.exit(1);
  }
}

connectDB();

// Funció auxiliar per normalitzar dies (per exemple, "dimecres" -> "dimecres")
const normalizeDay = (dayString) => {
    if (!dayString) return '';
    // Converteix la primera lletra a majúscula i la resta a minúscula per consistència
    return dayString.charAt(0).toUpperCase() + dayString.slice(1).toLowerCase();
};

// Funció auxiliar per normalitzar l'hora
const normalizeTime = (timeString) => {
    if (!timeString) return '';
    try {

        const date = new Date(timeString);
        if (isNaN(date.getTime())) { 

            return timeString;
        }
        return date.toLocaleTimeString('ca-ES', { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        console.error("Error normalitzant l'hora:", timeString, e);
        return timeString; 
    }
};


app.post('/process-dialogflow-voice', async (req, res) => {
  const query = req.body.query;
  if (!query) {
    return res.status(400).json({ error: 'Query de voz no proporcionada.' });
  }

  const sessionId = uuidv4();
  const sessionPath = sessionClient.projectAgentSessionPath(projectId, sessionId);

  const request = {
    session: sessionPath,
    queryInput: {
      text: {
        text: query,
        languageCode: 'ca',
      },
    },
  };

  try {
    console.log(`[process-dialogflow-voice] Enviando a Dialogflow: "${query}" para el proyecto ${projectId}`);
    const responses = await sessionClient.detectIntent(request);
    const result = responses[0].queryResult;

    console.log('[process-dialogflow-voice] Respuesta de Dialogflow recibida:', JSON.stringify(result, null, 2)); 
    console.log('[process-dialogflow-voice] Raw parameters fields:', JSON.stringify(result.parameters.fields, null, 2)); 

    if (result.intent && result.intent.displayName === 'AfegirHorari') {
      const parameters = result.parameters.fields;

      const horari = {
        title: parameters.title?.stringValue ?? '',
        day: normalizeDay(parameters.day?.stringValue), 
        time: normalizeTime(parameters.time?.stringValue), 
      };

      console.log(`[process-dialogflow-voice] Parámetros extraídos: title: "${horari.title}", day: "${horari.day}", time: "${horari.time}"`);

      if (!horari.title || !horari.day || !horari.time) {
        console.warn('[process-dialogflow-voice] Parámetros incompletos recibidos de Dialogflow para guardar:', horari);
        return res.json({
          fulfillmentText: result.fulfillmentText || 'Ho sento, no he pogut extreure tota la informació (títol, dia, hora) de la teva petició. Podries especificar-ho millor?',
          error: 'Parámetros incompletos de Dialogflow.'
        });
      }

      await db.collection('horaris').insertOne(horari);
      console.log('[process-dialogflow-voice] Horario guardado en MongoDB:', horari);

      return res.json({
        fulfillmentText: result.fulfillmentText || `Activitat "${horari.title}" afegida per ${horari.day} a les ${horari.time}.`,
        scheduleItem: horari
      });

    } else {
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

app.post('/webhook', async (req, res) => {
  try {
    const intent = req.body.queryResult.intent.displayName;
    const parameters = req.body.queryResult.parameters;

    console.log('[webhook] Webhook de Dialogflow activado. Intent:', intent);
    console.log('[webhook] Parámetros de Dialogflow (desde webhook):', parameters);

    if (intent === 'AfegirHorari') {
      const horari = {
        title: parameters['title'],
        day: normalizeDay(parameters['day']), // Utilitzem la nova funció normalizeDay
        time: normalizeTime(parameters['time']), // Utilitzem la nova funció normalizeTime
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