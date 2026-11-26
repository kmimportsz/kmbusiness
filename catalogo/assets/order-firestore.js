const sdk = 'https://www.gstatic.com/firebasejs/10.12.2/';
const firebaseConfig = {
  apiKey: 'AIzaSyBuFjPwSwD9Fv7FgT68Pd-r7jfzBvuLH4o',
  authDomain: 'agenda-vendas-9922a.firebaseapp.com',
  projectId: 'agenda-vendas-9922a',
  appId: '1:345264054186:web:80a2fa55bd025f2b5a55d3'
};
let connection;

async function connect() {
  const [appSdk, authSdk, dbSdk] = await Promise.all([
    import(sdk + 'firebase-app.js'), import(sdk + 'firebase-auth.js'), import(sdk + 'firebase-firestore.js')
  ]);
  const app = appSdk.initializeApp(firebaseConfig, 'km-catalog-orders');
  const auth = authSdk.getAuth(app);
  await auth.authStateReady();
  const user = auth.currentUser || (await authSdk.signInAnonymously(auth)).user;
  if (!user.isAnonymous) throw Error('Não foi possível iniciar a sessão do catálogo.');
  return { db: dbSdk.getFirestore(app), uid: user.uid, ...dbSdk };
}

export async function submitOrder(order) {
  connection ||= connect().catch(error => {
    connection = undefined;
    throw error;
  });
  return persistOrder(await connection, order);
}

export async function persistOrder(sdk, order) {
  const id = sdk.uid + '_' + order.key;
  const ref = sdk.doc(sdk.db, 'nexusOrders', id);
  const read = async () => {
    const snapshot = await sdk.getDocFromServer(ref);
    if (!snapshot.exists()) return null;
    const { itemsJSON, ...saved } = snapshot.data();
    return { ...saved, items: JSON.parse(itemsJSON) };
  };
  const existing = await read();
  if (existing) return existing;
  const batch = sdk.writeBatch(sdk.db);
  const { items, ...fields } = order;
  batch.set(ref, { ...fields, itemsJSON: JSON.stringify(items), status: 'pending', createdAt: sdk.serverTimestamp() });
  batch.set(sdk.doc(sdk.db, 'nexusOrderQuota', sdk.uid), { id, at: sdk.serverTimestamp() });
  try {
    await batch.commit();
  } catch {
    const saved = await read();
    if (!saved) throw Error('Não foi possível registrar agora. Aguarde um minuto e tente novamente.');
    return saved;
  }
  return order;
}
