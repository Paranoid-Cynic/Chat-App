// Initialize Firebase
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Sign up and log in functionality
document.getElementById('signup-btn').addEventListener('click', () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    auth.createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
            console.log('Signed up:', userCredential.user);
            generateQRCode(userCredential.user.uid);
        })
        .catch((error) => {
            console.error('Error signing up:', error);
        });
});

document.getElementById('login-btn').addEventListener('click', () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            console.log('Logged in:', userCredential.user);
            generateQRCode(userCredential.user.uid);
        })
        .catch((error) => {
            console.error('Error logging in:', error);
        });
});

// Generate QR code
function generateQRCode(uid) {
    const qrCodeCanvas = document.getElementById('qr-code');
    const qrCode = new QRCode(qrCodeCanvas, {
        text: `https://your-chat-app.com/chat/${uid}`,
        width: 200,
        height: 200,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
    });
    document.getElementById('user-info').style.display = 'block';
    document.getElementById('auth').style.display = 'none';
}

// Scan QR code
document.getElementById('scan-btn').addEventListener('click', () => {
    // Implement QR code scanning functionality
    // For example, using a library like jsQR
    const scanner = new jsQR.Scanner();
    scanner.addEventListener('scan', (event) => {
        const uid = event.data;
        startChat(uid);
    });
});

// Start chat
function startChat(uid) {
    document.getElementById('chat').style.display = 'block';
    document.getElementById('chat-with').innerText = `Chatting with ${uid}`;
    // Implement chat functionality
    // For example, using Firestore to store and retrieve messages
    db.collection('messages').where('uid', '==', uid).get()
        .then((querySnapshot) => {
            querySnapshot.forEach((doc) => {
                const message = doc.data();
                const messageElement = document.createElement('p');
                messageElement.innerText = message.text;
                document.getElementById('messages').appendChild(messageElement);
            });
        })
        .catch((error) => {
            console.error('Error retrieving messages:', error);
        });
}

// Send message
document.getElementById('send-btn').addEventListener('click', () => {
    const message = document.getElementById('message').value;
    const uid = auth.currentUser.uid;
    db.collection('messages').add({
        uid: uid,
        text: message
    })
        .then((docRef) => {
            console.log('Message sent:', docRef.id);
            document.getElementById('message').value = '';
        })
        .catch((error) => {
            console.error('Error sending message:', error);
        });
});