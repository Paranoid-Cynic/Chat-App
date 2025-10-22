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
  apiKey: "api_key",
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
let isLoadingChatHistory = false; // Flag to prevent multiple simultaneous loads

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

    // User will stay on home page (chat list view) after login
    // Only start chat if there's a specific ?chatWith parameter in URL
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
  document.getElementById("main-chat").style.display = "block";
  document.getElementById("user-email-main").innerText = `Logged in as: ${
    user.displayName || user.email.split("@")[0]
  }`;

  // Load user's chat history
  loadChatHistory(user);

  // Set up real-time chat list updates
  setupChatListUpdates(user);

  // Removed automatic chat start on incoming messages - user stays on home page
}

// Load and display user's chat history
async function loadChatHistory(user) {
  if (isLoadingChatHistory) return; // Prevent multiple simultaneous loads
  isLoadingChatHistory = true;

  const chatsDiv = document.getElementById("chats");
  chatsDiv.innerHTML = "";

  try {
    // Get all messages where user is sender or receiver
    const sentQuery = query(
      collection(db, "messages"),
      where("from", "==", user.uid)
    );

    const receivedQuery = query(
      collection(db, "messages"),
      where("to", "==", user.uid)
    );

    const [sentSnapshot, receivedSnapshot] = await Promise.all([
      getDocs(sentQuery),
      getDocs(receivedQuery),
    ]);

    // Combine and deduplicate chat partners - ensure each user appears only once
    const chatPartners = new Map();

    sentSnapshot.forEach((doc) => {
      const msg = doc.data();
      const uid = msg.to;
      if (!chatPartners.has(uid)) {
        chatPartners.set(uid, {
          uid: uid,
          lastMessage: msg,
          timestamp: msg.timestamp,
        });
      } else {
        // Update if this message is more recent
        const existing = chatPartners.get(uid);
        if (msg.timestamp.toDate() > existing.timestamp.toDate()) {
          chatPartners.set(uid, {
            uid: uid,
            lastMessage: msg,
            timestamp: msg.timestamp,
          });
        }
      }
    });

    receivedSnapshot.forEach((doc) => {
      const msg = doc.data();
      const uid = msg.from;
      if (!chatPartners.has(uid)) {
        chatPartners.set(uid, {
          uid: uid,
          lastMessage: msg,
          timestamp: msg.timestamp,
        });
      } else {
        // Update if this message is more recent
        const existing = chatPartners.get(uid);
        if (msg.timestamp.toDate() > existing.timestamp.toDate()) {
          chatPartners.set(uid, {
            uid: uid,
            lastMessage: msg,
            timestamp: msg.timestamp,
          });
        }
      }
    });

    // Sort by most recent message
    const sortedPartners = Array.from(chatPartners.values()).sort(
      (a, b) => b.timestamp.toDate() - a.timestamp.toDate()
    );

    // Display chat list
    for (const partner of sortedPartners) {
      await displayChatItem(partner, chatsDiv);
    }

    if (sortedPartners.length === 0) {
      chatsDiv.innerHTML =
        "<p style='font-size: 12px; color: #ffffffaa;'>No chats yet. Start a new chat!</p>";
    }
  } catch (error) {
    console.error("Error loading chat history:", error);
    chatsDiv.innerHTML =
      "<p style='font-size: 12px; color: #ffaaaa;'>Error loading chat history. Please try refreshing.</p>";
  } finally {
    isLoadingChatHistory = false;
  }
}

// Helper function to display a single chat item
async function displayChatItem(partner, container) {
  const chatItem = document.createElement("div");
  chatItem.className = "chat-item";
  chatItem.dataset.uid = partner.uid; // Store UID for easy reference

  // Get username for display
  const userDoc = await getDoc(doc(db, "users", partner.uid));
  const displayName = userDoc.exists()
    ? userDoc.data().displayName
    : "Unknown User";

  // Format timestamp
  const timestamp = partner.timestamp.toDate();
  const now = new Date();
  const diffMs = now - timestamp;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  let timeString;
  if (diffMins < 1) {
    timeString = "now";
  } else if (diffMins < 60) {
    timeString = `${diffMins}m`;
  } else if (diffHours < 24) {
    timeString = `${diffHours}h`;
  } else if (diffDays < 7) {
    timeString = `${diffDays}d`;
  } else {
    timeString = timestamp.toLocaleDateString();
  }

  chatItem.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <strong style="color: #ffffff; font-size: 12px;">${displayName}</strong>
      <small class="timestamp">${timeString}</small>
    </div>
  `;

  chatItem.addEventListener("click", () => startChat(partner.uid));
  container.appendChild(chatItem);
}

// Update chat list when new messages are sent or received
function setupChatListUpdates(user) {
  // Reload the entire chat list whenever a new message is sent or received
  // This ensures proper deduplication and sorting
  const reloadChatList = () => loadChatHistory(user);

  // Listen for new messages sent by user
  const sentMessagesQuery = query(
    collection(db, "messages"),
    where("from", "==", user.uid)
  );

  onSnapshot(sentMessagesQuery, (snapshot) => {
    if (!snapshot.empty && !isLoadingChatHistory) {
      reloadChatList();
    }
  });

  // Listen for new messages received by user
  const receivedMessagesQuery = query(
    collection(db, "messages"),
    where("to", "==", user.uid)
  );

  onSnapshot(receivedMessagesQuery, (snapshot) => {
    if (!snapshot.empty && !isLoadingChatHistory) {
      reloadChatList();
    }
  });
}

// Update chat list when a new message is sent or received
async function updateChatListWithNewMessage(message, currentUser) {
  // This function is no longer used since we reload the entire list
  // Keeping it for potential future use
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
async function startChat(uid) {
  chatPartnerId = uid;

  // Switch to chat view
  document.getElementById("chat-list-view").style.display = "none";
  document.getElementById("chat-view").style.display = "flex";

  // Get the username of the chat partner
  const userDoc = await getDoc(doc(db, "users", uid));
  const displayName = userDoc.exists()
    ? userDoc.data().displayName
    : "Unknown User";

  document.getElementById(
    "chat-with"
  ).innerText = `Chatting with: ${displayName}`;
  listenToMessages();
}

// Back Button Handler
document.getElementById("back-btn").addEventListener("click", () => {
  document.getElementById("chat-view").style.display = "none";
  document.getElementById("chat-list-view").style.display = "block";
  chatPartnerId = null;
});

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

  // Clear previous messages
  messagesDiv.innerHTML = "";

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
        p.textContent = msg.from === user.uid ? msg.text : msg.text;
        messagesDiv.appendChild(p);
      }
    });
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  });
}
