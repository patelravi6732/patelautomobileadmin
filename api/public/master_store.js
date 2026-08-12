import { MongoClient } from 'mongodb';

const MONGO_URI = 'mongodb+srv://rockpatel6732_db_user:FYwO0vlU8Vehe3DM@cluster0.zh8vtin.mongodb.net/patel_automobiles_db?retryWrites=true&w=majority&appName=Cluster0';

let cachedClient = null;

async function connectToDatabase() {
  if (cachedClient) {
    return cachedClient;
  }
  const client = new MongoClient(MONGO_URI, {
    tlsAllowInvalidCertificates: true
  });
  await client.connect();
  cachedClient = client;
  return client;
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const client = await connectToDatabase();
    const db = client.db('patel_automobiles_db');
    const coll = db.collection('master_store');

    if (req.method === 'GET') {
      let doc = await coll.findOne({ _id: 'global_store' });
      if (!doc) {
        doc = {
          _id: 'global_store',
          bookings: [], messages: [], jobs: [], inventory: [],
          recycleBin: [], garageInfo: { garage_name: "Patel Automobiles" },
          adminProfiles: [], khataEntries: [], customers: [], invoices: [], attendance: [], salaryPayments: [], deletedIds: []
        };
      }
      delete doc._id;
      return res.status(200).json(doc);
    } else if (req.method === 'POST' || req.method === 'PUT') {
      const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (payload && typeof payload === 'object') {
        const updateData = { ...payload };
        delete updateData._id;
        await coll.updateOne(
          { _id: 'global_store' },
          { $set: updateData },
          { upsert: true }
        );
        return res.status(200).json({ status: 'updated', store: updateData });
      }
      return res.status(400).json({ error: 'Invalid payload' });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Master store Vercel API error:', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
