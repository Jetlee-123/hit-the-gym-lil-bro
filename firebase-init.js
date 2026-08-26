import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCCwk6PckNFfpBV15vBOafYcvM4n64shnU",
  authDomain: "food-counter-app-fedc4.firebaseapp.com",
  projectId: "food-counter-app-fedc4",
  storageBucket: "food-counter-app-fedc4.firebasestorage.app",
  messagingSenderId: "969779642326",
  appId: "1:969779642326:web:1edd42a9bddab7ed74ee77"
};
const fbApp = initializeApp(firebaseConfig);
const fbAuth = getAuth(fbApp);
const fbDb = getFirestore(fbApp);

window.fbReady = new Promise(function(resolve){
  onAuthStateChanged(fbAuth, function(user){
    if (user) { resolve(user); return; }
    signInAnonymously(fbAuth).catch(function(err){ console.error("Anonymous sign-in failed", err); });
  });
});

window.fbGetPlayer = async function(name){
  await window.fbReady;
  const ref = doc(fbDb, "players", name.toLowerCase());
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
};
window.fbSavePlayer = async function(name, pin, dataObj, updatedAt){
  await window.fbReady;
  const ref = doc(fbDb, "players", name.toLowerCase());
  await setDoc(ref, { pin: pin, data: dataObj, displayName: name, updatedAt: updatedAt || Date.now() }, { merge: true });
};
window.fbCreatePlayer = async function(name, pin){
  await window.fbReady;
  const ref = doc(fbDb, "players", name.toLowerCase());
  await setDoc(ref, { pin: pin, data: {}, displayName: name, createdAt: Date.now(), updatedAt: Date.now() });
};
window.fbGetLeaderboard = async function(){
  await window.fbReady;
  const snap = await getDocs(collection(fbDb, "players"));
  const rows = [];
  snap.forEach(function(docSnap){ rows.push({ id: docSnap.id, data: docSnap.data() }); });
  return rows;
};
window.fbAdminSetXP = async function(name, newXpValue){
  await window.fbReady;
  const ref = doc(fbDb, "players", name.toLowerCase());
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Player not found");
  const xpKey = name.toLowerCase() + "-xp";
  const legacyKey = Object.keys(snap.data().data || {}).find(function(k){ return k.endsWith("-xp"); }) || xpKey;
  const now = Date.now();
  const patch = {};
  patch["data." + legacyKey] = String(newXpValue);
  patch.updatedAt = now;
  patch.adminActionAt = now;
  await updateDoc(ref, patch);
  return now;
};
window.fbAdminResetPlayer = async function(name){
  await window.fbReady;
  const ref = doc(fbDb, "players", name.toLowerCase());
  const now = Date.now();
  const existingSnap = await getDoc(ref);
  const existingPin = existingSnap.exists() ? (existingSnap.data().pin || "") : "";
  await setDoc(ref, { pin: existingPin, displayName: name, data: {}, updatedAt: now, adminActionAt: now });
  return now;
};
window.fbConnectionOk = true;
