/**
 * Seed Resource Library in Firestore (femcare-community).
 *
 * Run (from folder that contains scripts/):
 *   cd scripts
 *   npm install
 *   npm run seed
 *
 * Auth: uses your Google login (gcloud) OR a service account key file.
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const projectId = 'femcare-community';

function initFirebase() {
  if (admin.apps.length) return;

  // 1) Explicit key file (env or scripts/serviceAccountKey.json)
  const keyPath =
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    path.join(__dirname, 'serviceAccountKey.json');

  if (fs.existsSync(keyPath)) {
    const key = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    admin.initializeApp({ credential: admin.credential.cert(key), projectId });
    console.log('Using credentials: service account key file\n');
    return;
  }

  // 2) Application Default Credentials (e.g. after: gcloud auth application-default login)
  try {
    admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId });
    console.log('Using credentials: Google Application Default (gcloud login)\n');
    return;
  } catch (e) {
    // ignore and show help
  }

  console.error(
    'No credentials found. Use ONE of these:\n\n' +
      '  A) Google login (one-time):\n' +
      '     1. Install Google Cloud SDK: https://cloud.google.com/sdk/docs/install\n' +
      '     2. Run: gcloud auth application-default login\n' +
      '     3. Run: npm run seed\n\n' +
      '  B) Service account key:\n' +
      '     1. Firebase Console → Project Settings → Service accounts → Generate new private key\n' +
      '     2. Save as: scripts/serviceAccountKey.json\n' +
      '     3. Run: npm run seed'
  );
  process.exit(1);
}

initFirebase();

const db = admin.firestore();

const resources = [
  {
    title: 'What is Menstruation?',
    summary: 'A beginner-friendly guide to understanding what periods are and why they happen.',
    content:
      'Menstruation is the monthly shedding of the lining of the uterus (womb).\n\n**Why it happens**\nYour body prepares for a possible pregnancy each month. When pregnancy does not occur, the lining is released as a period. This is a normal, healthy process.\n\n**When it starts**\nMost people get their first period between ages 10 and 15. Everyone is different.',
    category: 'period',
    read_mins: 4,
    icon: '🩸',
    tags: 'beginner,period',
  },
  {
    title: 'How to Track Your Cycle',
    summary: 'Learn why tracking your period matters and how to do it simply and accurately.',
    content:
      'Tracking your cycle helps you know when your next period is due and can help you understand your body better.\n\n**Simple ways to track**\nUse a calendar or an app. Mark the first day of your period each month. After a few months, you may see a pattern.\n\n**What to note**\nFirst day of period, how many days it lasts, and any symptoms (cramps, mood).',
    category: 'period',
    read_mins: 5,
    icon: '📅',
    tags: 'tracking,cycle',
  },
  {
    title: 'Managing Period Cramps Naturally',
    summary: 'Practical, natural ways to reduce period pain without relying only on medication.',
    content:
      'Many people get cramps during their period. Here are gentle ways to ease them.\n\n**Heat**\nA warm compress or hot water bottle on your lower belly can relax muscles and reduce pain.\n\n**Movement**\nLight walking or gentle stretching can help. You don’t have to do a full workout.\n\n**Rest**\nSometimes resting and breathing slowly is enough. Listen to your body.',
    category: 'health',
    read_mins: 6,
    icon: '😣',
    tags: 'cramps,natural',
  },
  {
    title: "Period Products: A Beginner's Guide",
    summary: 'Pads, tampons, menstrual cups, and period underwear explained.',
    content:
      'There are several ways to manage your period. Choose what feels right for you.\n\n**Pads**\nStick to your underwear. Easy to use and good for beginners. Change every few hours.\n\n**Tampons**\nWorn inside the body. Read the leaflet and wash your hands before and after.\n\n**Menstrual cups**\nReusable silicone cups. They can last years and are eco-friendly.\n\n**Period underwear**\nSpecial underwear that absorbs flow. Great as backup or on lighter days.',
    category: 'hygiene',
    read_mins: 7,
    icon: '🧴',
    tags: 'products,hygiene',
  },
  {
    title: 'PMS, Hormones & Your Mood',
    summary: 'Why you feel emotional before your period, and how to take care of yourself.',
    content:
      'Mood changes before your period are common and are often linked to hormones.\n\n**What is PMS?**\nPremenstrual syndrome (PMS) can include mood swings, tiredness, or irritability in the days before your period. It is normal.\n\n**What helps**\nRest, light exercise, and talking to someone you trust can help. If feelings are very strong or affect your life a lot, a doctor or nurse can advise you.',
    category: 'mood',
    read_mins: 6,
    icon: '🧠',
    tags: 'mood,pms',
  },
  {
    title: 'What to Eat During Your Period',
    summary: 'Foods that help with cramps, fatigue, and mood — and what to avoid.',
    content:
      'Eating well can ease some period symptoms.\n\n**Helpful foods**\nIron-rich foods (lentils, spinach, dates) help replace what you lose. Whole grains and fruit can keep energy steadier.\n\n**Foods to ease cramps**\nMagnesium-rich foods like bananas and dark leafy greens may help. Staying hydrated is important too.\n\n**What to limit**\nToo much salt or caffeine can make bloating or mood swings worse for some people.',
    category: 'nutrition',
    read_mins: 5,
    icon: '🌿',
    tags: 'nutrition,food',
  },
  {
    title: 'Talking to a Trusted Adult',
    summary: 'Tips for starting the conversation with a parent, guardian, or school nurse.',
    content:
      'Talking about periods can feel awkward at first, but adults are usually happy to help.\n\n**Who to talk to**\nA parent, guardian, school nurse, or another adult you trust.\n\n**What to say**\nYou can say: "I have some questions about periods" or "I’d like to know more about what to expect."\n\n**Remember**\nThey have been through this or have helped others. It’s okay to ask for pads, products, or just information.',
    category: 'general',
    read_mins: 4,
    icon: '👩‍👧',
    tags: 'support,family',
  },
  {
    title: 'Period-Friendly Yoga Poses',
    summary: 'Simple yoga positions that ease cramps, reduce tension, and restore energy.',
    content:
      'Gentle movement can ease period discomfort.\n\n**Child’s pose**\nKneel, sit back on your heels, and fold forward. Rest your forehead on the floor. Breathe slowly. This can ease lower back and belly tension.\n\n**Cat-cow**\nOn hands and knees, alternate between arching and rounding your back. Move with your breath.\n\n**Rest**\nIf you don’t feel like moving, rest. Resting is valid too.',
    category: 'health',
    read_mins: 5,
    icon: '🧘',
    tags: 'yoga,exercise',
  },
];

async function seed() {
  const col = db.collection('resources');
  let added = 0;
  for (const r of resources) {
    await col.add(r);
    added++;
    console.log('Added:', r.title);
  }
  console.log('\nDone. Added', added, 'resources to Firestore.');
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
