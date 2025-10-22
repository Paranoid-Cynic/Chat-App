import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
  doc,
  setDoc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// ✅ Your Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyDcJPuPV6Se67JSw8adBNQmX0jpg4F8Z70",
  authDomain: "chat-app-74522.firebaseapp.com",
  projectId: "chat-app-74522",
  storageBucket: "chat-app-74522.firebasestorage.app",
  messagingSenderId: "38935909201",
  appId: "1:38935909201:web:f3fb36ed97a349a6a57970",
  measurementId: "G-7W27JEMBTP",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let chatPartnerId = null;

// ----------------------------
// AUTHENTICATION
// ----------------------------

document.getElementById("signup-btn").addEventListener("click", async () => {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!username || !password) {
    alert("Please enter both username and password");
    return;
  }

  // Use username as email for Firebase (append @dummy.com)
  const email = `${username}@dummy.com`;

  try {
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    // Update display name to username
    await updateProfile(userCredential.user, {
      displayName: username,
    });

    // Store user info in Firestore for username lookup
    await setDoc(doc(db, "users", userCredential.user.uid), {
      uid: userCredential.user.uid,
      displayName: username,
      email: userCredential.user.email,
      createdAt: new Date(),
    });

    showUserInfo(userCredential.user);
  } catch (error) {
    alert(error.message);
  }
});

document.getElementById("login-btn").addEventListener("click", async () => {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!username || !password) {
    alert("Please enter both username and password");
    return;
  }

  // Use username as email for Firebase (append @dummy.com)
  const email = `${username}@dummy.com`;

  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    // Ensure displayName is set in Firebase Auth
    if (!userCredential.user.displayName) {
      await updateProfile(userCredential.user, {
        displayName: username,
      });
    }

    // Ensure user data exists in Firestore
    const userDocRef = doc(db, "users", userCredential.user.uid);
    const userDocSnap = await getDoc(userDocRef);

    if (!userDocSnap.exists()) {
      // User data doesn't exist, create it
      await setDoc(userDocRef, {
        uid: userCredential.user.uid,
        displayName: username,
        email: userCredential.user.email,
        createdAt: new Date(),
      });
    }

    showUserInfo(userCredential.user);
  } catch (error) {
    alert(error.message);
  }
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    showUserInfo(user);

    // If link includes ?chatWith=xyz, start chat automatically
    const params = new URLSearchParams(window.location.search);
    const chatWith = params.get("chatWith");
    if (chatWith && chatWith !== user.uid) {
      startChat(chatWith);
    }
  }
});

// ----------------------------
// USER INFO
// ----------------------------
function showUserInfo(user) {
  document.getElementById("auth").style.display = "none";
  document.getElementById("user-info").style.display = "block";
  document.getElementById("user-email").innerText = `Logged in as: ${
    user.displayName || user.email.split("@")[0]
  }`;

  // Listen for incoming messages to start chat automatically
  const incomingQuery = query(
    collection(db, "messages"),
    where("to", "==", user.uid),
    orderBy("timestamp", "desc")
  );

  onSnapshot(incomingQuery, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added") {
        const msg = change.doc.data();
        if (msg.from !== user.uid && !chatPartnerId) {
          startChat(msg.from);
        }
      }
    });
  });
}

// New Chat Button Handler
document.getElementById("new-chat-btn").addEventListener("click", () => {
  const form = document.getElementById("new-chat-form");
  form.style.display = form.style.display === "none" ? "block" : "none";
});

// Start Chat with Username
document
  .getElementById("start-chat-btn")
  .addEventListener("click", async () => {
    const chatUsername = document.getElementById("chat-username").value.trim();
    if (!chatUsername) {
      alert("Please enter a username");
      return;
    }

    // Find user by username (displayName)
    const usersQuery = query(
      collection(db, "users"),
      where("displayName", "==", chatUsername)
    );

    const snapshot = await getDocs(usersQuery);
    if (snapshot.empty) {
      alert("User not found");
      return;
    }

    const targetUser = snapshot.docs[0].data();
    startChat(targetUser.uid);
    document.getElementById("chat-username").value = "";
    document.getElementById("new-chat-form").style.display = "none";
  });

// QR scanning is removed as per user request - no scanning functionality needed

// ----------------------------
// CHAT FUNCTIONALITY
// ----------------------------
function startChat(uid) {
  chatPartnerId = uid;
  document.getElementById("chat").style.display = "block";
  document.getElementById("chat-with").innerText = `Chatting with: User`;
  listenToMessages();
}

document.getElementById("send-btn").addEventListener("click", async () => {
  const message = document.getElementById("message").value.trim();
  const user = auth.currentUser;
  if (!message || !user || !chatPartnerId) return;

  await addDoc(collection(db, "messages"), {
    from: user.uid,
    to: chatPartnerId,
    text: message,
    timestamp: new Date(),
  });

  document.getElementById("message").value = "";
});

// WhatsApp-style keyboard shortcuts
document.getElementById("message").addEventListener("keydown", async (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    const message = document.getElementById("message").value.trim();
    const user = auth.currentUser;
    if (!message || !user || !chatPartnerId) return;

    await addDoc(collection(db, "messages"), {
      from: user.uid,
      to: chatPartnerId,
      text: message,
      timestamp: new Date(),
    });

    document.getElementById("message").value = "";
  }
  // Shift+Enter for new line (default behavior)
});

// ----------------------------
// REAL-TIME MESSAGE LISTENER
// ----------------------------
function listenToMessages() {
  const user = auth.currentUser;
  const messagesDiv = document.getElementById("messages");

  // Query all messages ordered by timestamp (client-side filtering for performance)
  const chatQuery = query(
    collection(db, "messages"),
    orderBy("timestamp", "asc")
  );

  onSnapshot(chatQuery, (snapshot) => {
    messagesDiv.innerHTML = "";
    snapshot.forEach((doc) => {
      const msg = doc.data();
      // Filter messages between current user and chat partner
      if (
        (msg.from === user.uid && msg.to === chatPartnerId) ||
        (msg.from === chatPartnerId && msg.to === user.uid)
      ) {
        const p = document.createElement("p");
        p.textContent = `${msg.from === user.uid ? "You" : "Them"}: ${
          msg.text
        }`;
        messagesDiv.appendChild(p);
      }
    });
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  });
}
