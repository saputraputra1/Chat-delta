const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

const bannedWords = ['rasis', 'bullying', 'pelecehan', 'ancaman', 'kontol', 'memek', 'anjing', 'asu', 'bangsat', 'bajingan', 'brengsek'];

exports.checkMessage = functions.database.ref('/messages/{messageId}')
    .onCreate(async (snapshot, context) => {
        const message = snapshot.val();
        const content = message.content.toLowerCase();
        const userId = message.senderId;

        for (const word of bannedWords) {
            if (content.includes(word)) {
                await admin.database().ref(`bans/${userId}`).set({
                    permanent: true,
                    reason: 'Menggunakan bahasa yang tidak pantas.',
                    bannedBy: 'system',
                    bannedAt: admin.database.ServerValue.TIMESTAMP
                });
                return;
            }
        }
    });

exports.checkUserOnCreate = functions.auth.user().onCreate(async (user) => {
    const ipAddress = user.metadata.lastSignInIpAddress;
    const deviceId = user.photoURL; // Assuming deviceId is passed in photoURL during registration

    if (deviceId) {
        const deviceRef = admin.database().ref(`devices/${deviceId}`);
        const deviceSnapshot = await deviceRef.once('value');
        if (deviceSnapshot.exists()) {
            await admin.auth().updateUser(user.uid, { disabled: true });
            await admin.database().ref(`banned_devices/${deviceId}`).set({
                timestamp: admin.database.ServerValue.TIMESTAMP,
                reason: 'Multiple accounts on one device.'
            });
            return;
        } else {
            await deviceRef.set({
                userId: user.uid,
                registeredAt: admin.database.ServerValue.TIMESTAMP
            });
        }
    }

    if (ipAddress) {
        const response = await fetch(`https://ipinfo.io/${ipAddress}?token=c67223614a53f0`);
        const data = await response.json();
        if (data.privacy && (data.privacy.vpn || data.privacy.proxy || data.privacy.tor)) {
            await admin.auth().updateUser(user.uid, { disabled: true });
            await admin.database().ref(`banned_ips/${ipAddress.replace(/\./g, '_')}`).set({
                timestamp: admin.database.ServerValue.TIMESTAMP,
                reason: 'VPN usage detected during registration.'
            });
        }
    }
});
