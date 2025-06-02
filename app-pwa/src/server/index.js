const express = require('express');
const bodyParser = require('body-parser');
const { MongoClient, ObjectId } = require('mongodb'); // <-- IMPORTANT: AFEGEIX ObjectId aquí
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
    // Recorda: el nom de la base de dades aquí ha de coincidir amb el cas de la BD existent
    // (ex: 'Ora' o 'ora' segons com la tinguis a MongoDB Atlas)
    db = client.db('Ora'); // <-- CORREGIT: Utilitza el nom exacte de la teva DB (amb el cas correcte)
    console.log('📦 Connexió MongoDB OK');
  } catch (error) {
    console.error('❌ Error al conectar a MongoDB:', error);
    process.exit(1);
  }
}

connectDB();

// Funció auxiliar per normalitzar dies (ex: "dimecres" -> "Dimecres")
const normalizeDay = (dayString) => {
    if (!dayString) return '';
    return dayString.charAt(0).toUpperCase() + dayString.slice(1).toLowerCase();
};

// Funció auxiliar per normalitzar l'hora
const normalizeTime = (timeString) => {
    if (!timeString) return '';
    try {
        // Dialogflow sovint retorna un string ISO 8601 per @sys.time (ex: "2025-06-02T21:00:00Z")
        const date = new Date(timeString);
        if (!isNaN(date.getTime())) { // Comprovem si la data és vàlida
            return date.toLocaleTimeString('ca-ES', { hour: '2-digit', minute: '2-digit' });
        }
        // Si no és una data ISO vàlida, mirem si és una paraula com "nou"
        const hourMapping = {
            'nou': '09:00',
            'tres': '03:00',
            'cinc': '05:00',
            'sis': '06:00',
            'set': '07:00',
            'vuit': '08:00',
            'deu': '10:00',
            'onze': '11:00',
            'dotze': '12:00',
            'una': '13:00', // Assumim 13:00 per "una" si no hi ha més context
            // Afegeix més mapes si cal per nombres com a hores
        };
        return hourMapping[timeString.toLowerCase()] || timeString; // Utilitza el mapa o retorna l'original
    } catch (e) {
        console.error("Error normalitzant l'hora:", timeString, e);
        return timeString;
    }
};

// Helper per obtenir valors de paràmetres de Dialogflow (maneja listValue i stringValue)
const getParamValue = (paramField) => {
    if (!paramField) return '';
    if (paramField.listValue && paramField.listValue.values && paramField.listValue.values.length > 0) {
        return paramField.listValue.values[0].stringValue ?? '';
    }
    return paramField.stringValue ?? '';
};


// Endpoint per obtenir totes les activitats
app.get('/horaris', async (req, res) => {
    console.log('[GET /horaris] Sol·licitud per obtenir tots els horaris.');
    try {
        const horaris = await db.collection('horaris').find({}).toArray();
        res.status(200).json(horaris);
    } catch (error) {
        console.error('[GET /horaris] Error obtenint horaris:', error);
        res.status(500).json({ error: 'Error intern del servidor obtenint els horaris.' });
    }
});

// Endpoint per afegir activitats manualment
app.post('/horaris', async (req, res) => {
    const { title, day, time } = req.body;
    console.log(`[POST /horaris] Intentant afegir activitat manualment: ${JSON.stringify(req.body)}`);

    if (!title || !day || !time) {
        return res.status(400).json({ error: 'Títol, dia i hora són obligatoris.' });
    }

    const newActivity = { title, day, time, createdAt: new Date() }; // Opcional: afegir timestamp

    try {
        const insertResult = await db.collection('horaris').insertOne(newActivity);
        const addedActivity = { ...newActivity, _id: insertResult.insertedId }; // Retornem la _id generada per MongoDB

        console.log('[POST /horaris] Activitat manualment guardada a MongoDB:', addedActivity);
        res.status(201).json(addedActivity); // 201 Created
    } catch (error) {
        console.error('[POST /horaris] Error afegint activitat manualment:', error);
        res.status(500).json({ error: 'Error intern del servidor afegint l\'activitat.' });
    }
});

// Endpoint per processar veu amb Dialogflow
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
        title: getParamValue(parameters.title),
        day: normalizeDay(getParamValue(parameters.day)),
        time: normalizeTime(getParamValue(parameters.time)),
      };

      console.log(`[process-dialogflow-voice] Parámetros extraídos: title: "${horari.title}", day: "${horari.day}", time: "${horari.time}"`);

      if (!horari.title || !horari.day || !horari.time) {
        console.warn('[process-dialogflow-voice] Parámetros incompletos recibidos de Dialogflow para guardar:', horari);
        return res.json({
          fulfillmentText: result.fulfillmentText || 'Ho sento, no he pogut extreure tota la informació (títol, dia, hora) de la teva petició. Podries especificar-ho millor?',
          error: 'Parámetros incompletos de Dialogflow.'
        });
      }

      const insertResult = await db.collection('horaris').insertOne(horari);
      const addedHorari = { ...horari, _id: insertResult.insertedId }; // Afegim la _id a l'objecte

      console.log('[process-dialogflow-voice] Horario guardado en MongoDB:', addedHorari);

      return res.json({
        fulfillmentText: result.fulfillmentText || `Activitat "${addedHorari.title}" afegida per ${addedHorari.day} a les ${addedHorari.time}.`,
        scheduleItem: addedHorari // Retornem l'objecte amb la _id
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

// Endpoint per eliminar activitats
app.delete('/horaris/:id', async (req, res) => {
    const { id } = req.params;
    console.log(`[DELETE /horaris/:id] Intentant eliminar l'activitat amb ID: ${id}`);

    try {
        if (!ObjectId.isValid(id)) {
            console.warn(`[DELETE /horaris/:id] ID invàlid: ${id}`);
            return res.status(400).json({ error: 'ID d\'activitat invàlid.' });
        }

        const result = await db.collection('horaris').deleteOne({ _id: new ObjectId(id) });

        if (result.deletedCount === 1) {
            console.log(`[DELETE /horaris/:id] Activitat amb ID ${id} eliminada correctament.`);
            res.status(200).json({ message: 'Activitat eliminada correctament.' });
        } else {
            console.warn(`[DELETE /horaris/:id] No s'ha trobat l'activitat amb ID ${id}.`);
            res.status(404).json({ error: 'Activitat no trobada.' });
        }
    } catch (error) {
        console.error(`[DELETE /horaris/:id] Error eliminant l'activitat amb ID ${id}:`, error);
        res.status(500).json({ error: 'Error intern del servidor al eliminar l\'activitat.' });
    }
});

// Endpoint de Webhook (per a crides directes de Dialogflow si tens el webhook habilitat)
app.post('/webhook', async (req, res) => {
  try {
    const intent = req.body.queryResult.intent.displayName;
    const parameters = req.body.queryResult.parameters;

    console.log('[webhook] Webhook de Dialogflow activado. Intent:', intent);
    console.log('[webhook] Parámetros de Dialogflow (desde webhook):', parameters);

    if (intent === 'AfegirHorari') {
      const horari = {
        title: parameters['title'],
        day: normalizeDay(parameters['day']),
        time: normalizeTime(parameters['time']),
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
    res.json({ fulfillmentText: 'No he entès la petición del webhook.' });
  } catch (error) {
    console.error('[webhook] Error en el endpoint /webhook:', error);
    res.status(500).json({ fulfillmentText: 'Hi ha hagut un error intern en el webhook.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor actiu al port ${PORT}`));