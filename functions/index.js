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
