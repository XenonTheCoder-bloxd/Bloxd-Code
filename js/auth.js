
import { 
  auth, 
  db, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged,
  updateProfile,
  doc, 
  getDoc, 
  setDoc, 
  updateDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs
} from "./firebase-config.js";
import { validateUsername } from "./profanity.js";

export let currentUser = null;
export let userProfile = null;
let authListeners = [];

export function onUserChange(callback) {
  authListeners.push(callback);
  if (currentUser) {
    callback(currentUser, userProfile);
  }
}

function notifyListeners() {
  authListeners.forEach(cb => cb(currentUser, userProfile));
}

const USERNAME_CHANGE_COOLDOWN_MS = 60 * 60 * 1000;

 
export function initAuth() {
  if (!auth) {
    console.warn("Auth not initialized, checking local storage session");
    const localUser = localStorage.getItem("bloxd_local_user");
    if (localUser) {
      userProfile = JSON.parse(localUser);
      currentUser = { uid: userProfile.uid, email: userProfile.email, displayName: userProfile.username };
      notifyListeners();
    }
    return;
  }

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUser = user;
      await loadUserProfile(user.uid);
    } else {
      currentUser = null;
      userProfile = null;
      localStorage.removeItem("bloxd_local_user");
      notifyListeners();
    }
  });
}

 
export async function loadUserProfile(uid) {
  try {
    if (db) {
      const userRef = doc(db, "users", uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        userProfile = userSnap.data();
        localStorage.setItem("bloxd_local_user", JSON.stringify(userProfile));
        notifyListeners();
        return userProfile;
      }
    }
  } catch (e) {
    console.warn("Error fetching profile from Firestore, using local cache", e);
  }

  
  const cached = localStorage.getItem("bloxd_local_user");
  if (cached) {
    userProfile = JSON.parse(cached);
  } else if (currentUser) {
    const defaultName = currentUser.displayName || currentUser.email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
    userProfile = {
      uid: currentUser.uid,
      email: currentUser.email,
      username: defaultName || "coder_" + Math.floor(Math.random() * 10000),
      bio: "Bloxd.io Scripter & Modder",
      avatar: currentUser.photoURL || "https://api.dicebear.com/7.x/bottts/svg?seed=" + (currentUser.uid || "bloxd"),
      lastUsernameChange: 0,
      badges: ["Coder", "Bloxd Explorer"],
      portfolioTheme: "dark",
      portfolioBg: "radial-gradient(circle at 50% 25%, #262626, #0b0b0b 75%)",
      portfolioMusic: "https://cdn.freesound.org/previews/563/563581_5674468-lq.mp3",
      musicTitle: "Cyber Synth - Ambient Coding",
      customCode: "/* Custom HTML/CSS/JS */\nconsole.log('Welcome to my Bloxd portfolio!');",
      socials: { discord: "", github: "", youtube: "" },
      stats: { xp: 120, lessons: 3, forumPosts: 1 }
    };
    await saveUserProfile(userProfile);
  }
  notifyListeners();
  return userProfile;
}

 
export async function isUsernameTaken(username, excludeUid = null) {
  const cleanUser = username.trim().toLowerCase();
  
  if (db) {
    try {
      const subDoc = await getDoc(doc(db, "subdomains", cleanUser));
      if (subDoc.exists()) {
        const ownerUid = subDoc.data().uid;
        if (excludeUid && ownerUid === excludeUid) {
          return false;
        }
        return true;
      }
    } catch (e) {
      console.warn("Firestore subdomains check error:", e);
    }
  }

  
  const localRegistry = JSON.parse(localStorage.getItem("bloxd_subdomains_registry") || "{}");
  if (localRegistry[cleanUser] && localRegistry[cleanUser] !== excludeUid) {
    return true;
  }

  return false;
}

 
export async function changeUsername(newUsername) {
  if (!currentUser || !userProfile) {
    throw new Error("You must be logged in to update your username.");
  }

  const validation = validateUsername(newUsername);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const cleanUser = validation.username;

  if (cleanUser === userProfile.username) {
    return { success: true, message: "Username unchanged." };
  }

  
  const now = Date.now();
  const lastChange = userProfile.lastUsernameChange || 0;
  const timeSinceChange = now - lastChange;

  if (timeSinceChange < USERNAME_CHANGE_COOLDOWN_MS) {
    const minutesRemaining = Math.ceil((USERNAME_CHANGE_COOLDOWN_MS - timeSinceChange) / (60 * 1000));
    throw new Error(`Username cooldown active. You can change your username again in ${minutesRemaining} minute(s).`);
  }

  
  const taken = await isUsernameTaken(cleanUser, currentUser.uid);
  if (taken) {
    throw new Error(`The username '${cleanUser}' is already claimed by another Bloxd coder.`);
  }

  const oldUsername = userProfile.username;
  userProfile.username = cleanUser;
  userProfile.lastUsernameChange = now;

  
  if (db) {
    try {
      await setDoc(doc(db, "subdomains", cleanUser), {
        uid: currentUser.uid,
        username: cleanUser,
        claimedAt: serverTimestamp()
      });
      if (oldUsername) {
        
      }
    } catch (e) {
      console.warn("Firestore claim subdomain error:", e);
    }
  }

  
  const localRegistry = JSON.parse(localStorage.getItem("bloxd_subdomains_registry") || "{}");
  if (oldUsername) delete localRegistry[oldUsername];
  localRegistry[cleanUser] = currentUser.uid;
  localStorage.setItem("bloxd_subdomains_registry", JSON.stringify(localRegistry));

  await saveUserProfile(userProfile);
  return { success: true, username: cleanUser };
}

 
export async function saveUserProfile(profileData) {
  userProfile = { ...userProfile, ...profileData };
  localStorage.setItem("bloxd_local_user", JSON.stringify(userProfile));

  
  const publicProfiles = JSON.parse(localStorage.getItem("bloxd_public_profiles") || "{}");
  if (userProfile.username) {
    publicProfiles[userProfile.username.toLowerCase()] = userProfile;
    localStorage.setItem("bloxd_public_profiles", JSON.stringify(publicProfiles));
  }

  if (db && currentUser) {
    try {
      await setDoc(doc(db, "users", currentUser.uid), userProfile, { merge: true });
    } catch (e) {
      console.warn("Could not save to Firestore, stored locally", e);
    }
  }

  notifyListeners();
  return userProfile;
}

 
export async function signUpWithEmail(email, password, requestedUsername) {
  const validation = validateUsername(requestedUsername);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const taken = await isUsernameTaken(validation.username);
  if (taken) {
    throw new Error(`The username '${validation.username}' is already taken.`);
  }

  if (!auth) {
    
    const uid = "local_" + Date.now();
    currentUser = { uid, email, displayName: validation.username };
    userProfile = {
      uid,
      email,
      username: validation.username,
      bio: "Bloxd.io Scripter",
      avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=" + validation.username,
      lastUsernameChange: 0,
      badges: ["New Coder"],
      portfolioTheme: "dark",
      portfolioBg: "radial-gradient(circle at 50% 25%, #262626, #0b0b0b 75%)",
      portfolioMusic: "https://cdn.freesound.org/previews/563/563581_5674468-lq.mp3",
      musicTitle: "Cyber Synth - Coding Chill",
      customCode: "/* Custom HTML/CSS/JS */",
      socials: { discord: "", github: "", youtube: "" },
      stats: { xp: 50, lessons: 1, forumPosts: 0 }
    };
    await saveUserProfile(userProfile);
    return userProfile;
  }

  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  currentUser = userCredential.user;
  
  await updateProfile(currentUser, { displayName: validation.username });

  userProfile = {
    uid: currentUser.uid,
    email: currentUser.email,
    username: validation.username,
    bio: "Bloxd.io Scripter",
    avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=" + validation.username,
    lastUsernameChange: Date.now(),
    badges: ["New Coder"],
    portfolioTheme: "dark",
    portfolioBg: "radial-gradient(circle at 50% 25%, #262626, #0b0b0b 75%)",
    portfolioMusic: "https://cdn.freesound.org/previews/563/563581_5674468-lq.mp3",
    musicTitle: "Cyber Synth - Coding Chill",
    customCode: "/* Custom HTML/CSS/JS */",
    socials: { discord: "", github: "", youtube: "" },
    stats: { xp: 50, lessons: 1, forumPosts: 0 }
  };

  await saveUserProfile(userProfile);
  
  
  if (db) {
    try {
      await setDoc(doc(db, "subdomains", validation.username), {
        uid: currentUser.uid,
        username: validation.username,
        claimedAt: serverTimestamp()
      });
    } catch (e) {
      console.warn("Subdomain registration error:", e);
    }
  }

  return userProfile;
}

 
export async function logInWithEmail(email, password) {
  if (!auth) {
    
    const cached = localStorage.getItem("bloxd_local_user");
    if (cached) {
      userProfile = JSON.parse(cached);
      currentUser = { uid: userProfile.uid, email: userProfile.email, displayName: userProfile.username };
      notifyListeners();
      return userProfile;
    }
    throw new Error("No local user found. Please sign up.");
  }

  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  currentUser = userCredential.user;
  return await loadUserProfile(currentUser.uid);
}

 
export async function logInWithGoogle() {
  if (!auth) {
    throw new Error("Google Auth is available when connected to Firebase.");
  }

  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  currentUser = result.user;

  
  let profile = await loadUserProfile(currentUser.uid);
  if (!profile) {
    const rawName = (currentUser.displayName || currentUser.email.split("@")[0]).toLowerCase().replace(/[^a-z0-9]/g, "");
    let uniqueUser = rawName || "coder" + Math.floor(Math.random() * 1000);
    const taken = await isUsernameTaken(uniqueUser);
    if (taken) {
      uniqueUser = uniqueUser + "_" + Math.floor(Math.random() * 999);
    }

    profile = {
      uid: currentUser.uid,
      email: currentUser.email,
      username: uniqueUser,
      bio: "Bloxd.io Developer",
      avatar: currentUser.photoURL || "https://api.dicebear.com/7.x/bottts/svg?seed=" + uniqueUser,
      lastUsernameChange: 0,
      badges: ["Google Verified", "Bloxd Coder"],
      portfolioTheme: "dark",
      portfolioBg: "radial-gradient(circle at 50% 25%, #262626, #0b0b0b 75%)",
      portfolioMusic: "https://cdn.freesound.org/previews/563/563581_5674468-lq.mp3",
      musicTitle: "Neon Nights - Bloxd LoFi",
      customCode: "/* Custom HTML/CSS/JS */",
      socials: { discord: "", github: "", youtube: "" },
      stats: { xp: 100, lessons: 2, forumPosts: 0 }
    };
    await saveUserProfile(profile);
  }
  return profile;
}

 
export async function logOut() {
  if (auth) {
    await signOut(auth);
  }
  currentUser = null;
  userProfile = null;
  localStorage.removeItem("bloxd_local_user");
  notifyListeners();
}
