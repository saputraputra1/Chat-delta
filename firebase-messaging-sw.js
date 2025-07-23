importScripts('https://www.gstatic.com/firebasejs/8.10.0/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.0/firebase-messaging.js');

const firebaseConfig = {
    apiKey: "AIzaSyAQVIvZvxmYdcriHR8j0ormGzNRjGD0_no",
    authDomain: "online--suit.firebaseapp.com",
    databaseURL: "https://online--suit-default-rtdb.firebaseio.com",
    projectId: "online--suit",
    storageBucket: "online--suit.firebasestorage.app",
    messagingSenderId: "463840835705",
    appId: "1:463840835705:web:f490fd49851c0afb8dfca8"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: payload.notification.icon
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});
