import { MongoClient } from 'mongodb';

const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://rockpatel6732_db_user:FYwO0vlU8Vehe3DM@cluster0.zh8vtin.mongodb.net/patel_automobiles_db?retryWrites=true&w=majority&appName=Cluster0";

let cachedClient = null;

async function connectToMongo() {
  if (cachedClient) return cachedClient;
  const client = new MongoClient(MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
  });
  await client.connect();
  cachedClient = client;
  return client;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const client = await connectToMongo();
    const db = client.db('patel_automobiles_db');

    if (req.method === 'POST') {
      const data = req.body || {};
      const deletedIds = Array.isArray(data.deletedIds) ? data.deletedIds.map(String) : [];

      // 1. Jobs
      if (Array.isArray(data.jobs)) {
        const cleanJobs = data.jobs.filter(j => j && j.id && !deletedIds.includes(String(j.id)));
        if (cleanJobs.length > 0) {
          const bulkOps = cleanJobs.map(job => ({
            updateOne: {
              filter: { id: job.id },
              update: { $set: job },
              upsert: true
            }
          }));
          await db.collection('jobs').bulkWrite(bulkOps).catch(console.warn);
        }
        if (deletedIds.length > 0) {
          await db.collection('jobs').deleteMany({ id: { $in: deletedIds } }).catch(console.warn);
        }
      }

      // 2. Invoices
      if (Array.isArray(data.invoices)) {
        const cleanInvs = data.invoices.filter(inv => inv && inv.id && !deletedIds.includes(String(inv.id)));
        if (cleanInvs.length > 0) {
          const bulkOps = cleanInvs.map(inv => ({
            updateOne: {
              filter: { id: inv.id },
              update: { $set: inv },
              upsert: true
            }
          }));
          await db.collection('invoices').bulkWrite(bulkOps).catch(console.warn);
        }
        if (deletedIds.length > 0) {
          await db.collection('invoices').deleteMany({ id: { $in: deletedIds } }).catch(console.warn);
        }
      }

      // 3. Inventory
      if (Array.isArray(data.inventory)) {
        const cleanInv = data.inventory.filter(i => i && i.id && !deletedIds.includes(String(i.id)) && !deletedIds.includes(String(i.part_name)));
        if (cleanInv.length > 0) {
          const bulkOps = cleanInv.map(item => ({
            updateOne: {
              filter: { id: item.id },
              update: { $set: item },
              upsert: true
            }
          }));
          await db.collection('inventory').bulkWrite(bulkOps).catch(console.warn);
        }
        if (deletedIds.length > 0) {
          await db.collection('inventory').deleteMany({ $or: [{ id: { $in: deletedIds } }, { part_name: { $in: deletedIds } }] }).catch(console.warn);
        }
      }

      // 4. Khata Entries
      if (Array.isArray(data.khataEntries)) {
        const cleanKhata = data.khataEntries.filter(k => k && k.id && !deletedIds.includes(String(k.id)));
        if (cleanKhata.length > 0) {
          const bulkOps = cleanKhata.map(k => ({
            updateOne: {
              filter: { id: k.id },
              update: { $set: k },
              upsert: true
            }
          }));
          await db.collection('khata_entries').bulkWrite(bulkOps).catch(console.warn);
        }
        if (deletedIds.length > 0) {
          await db.collection('khata_entries').deleteMany({ id: { $in: deletedIds } }).catch(console.warn);
        }
      }

      // 5. Customers
      if (Array.isArray(data.customers)) {
        const cleanCust = data.customers.filter(c => c && c.id && !deletedIds.includes(String(c.id)));
        if (cleanCust.length > 0) {
          const bulkOps = cleanCust.map(c => ({
            updateOne: {
              filter: { id: c.id },
              update: { $set: c },
              upsert: true
            }
          }));
          await db.collection('customers').bulkWrite(bulkOps).catch(console.warn);
        }
      }

      // 6. Bookings
      if (Array.isArray(data.bookings)) {
        const cleanBook = data.bookings.filter(b => b && b.id && !deletedIds.includes(String(b.id)));
        if (cleanBook.length > 0) {
          const bulkOps = cleanBook.map(b => ({
            updateOne: {
              filter: { id: b.id },
              update: { $set: b },
              upsert: true
            }
          }));
          await db.collection('bookings').bulkWrite(bulkOps).catch(console.warn);
        }
      }

      return res.status(200).json({ success: true, message: 'Synced to MongoDB Atlas' });
    }

    const [jobs, invoices, inventory, khataEntries, customers, bookings] = await Promise.all([
      db.collection('jobs').find({}).toArray().catch(() => []),
      db.collection('invoices').find({}).toArray().catch(() => []),
      db.collection('inventory').find({}).toArray().catch(() => []),
      db.collection('khata_entries').find({}).toArray().catch(() => []),
      db.collection('customers').find({}).toArray().catch(() => []),
      db.collection('bookings').find({}).toArray().catch(() => [])
    ]);

    return res.status(200).json({
      success: true,
      jobs,
      invoices,
      inventory,
      khataEntries,
      customers,
      bookings
    });
  } catch (err) {
    console.error('Serverless MongoDB Atlas error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
