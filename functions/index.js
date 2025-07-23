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

exports.sendStoryLikeNotification = functions.database.ref('/stories/{storyId}/likes/{userId}')
    .onCreate(async (snapshot, context) => {
        const storyId = context.params.storyId;
        const userId = context.params.userId;

        const storySnapshot = await admin.database().ref(`/stories/${storyId}`).once('value');
        const story = storySnapshot.val();

        if (story.userId !== userId) {
            const userSnapshot = await admin.database().ref(`/users/${userId}`).once('value');
            const user = userSnapshot.val();

            const payload = {
                notification: {
                    title: 'New Like!',
                    body: `${user.username} liked your story.`,
                    icon: user.avatar || '/images/default-avatar.png'
                }
            };

            const ownerId = story.userId;
            const tokensSnapshot = await admin.database().ref(`/users/${ownerId}/fcmTokens`).once('value');
            const tokens = Object.keys(tokensSnapshot.val());

            return admin.messaging().sendToDevice(tokens, payload);
        }
        return null;
    });

exports.sendNewMessageNotification = functions.database.ref('/messages/{messageId}')
    .onCreate(async (snapshot, context) => {
        const message = snapshot.val();
        const receiverId = message.receiverId;
        const senderId = message.senderId;

        // Get sender's username
        const senderSnapshot = await admin.database().ref(`/users/${senderId}`).once('value');
        const sender = senderSnapshot.val();

        // Get receiver's FCM token
        const receiverSnapshot = await admin.database().ref(`/users/${receiverId}`).once('value');
        const receiver = receiverSnapshot.val();
        const fcmToken = receiver.fcmToken;

        if (fcmToken) {
            const payload = {
                notification: {
                    title: `New message from ${sender.username}`,
                    body: message.content || 'Sent an image.',
                    icon: sender.avatar || '/images/default-avatar.png'
                },
                data: {
                    senderId: senderId
                }
            };

            return admin.messaging().sendToDevice(fcmToken, payload);
        }
        return null;
    });

exports.updateMessageStatusToDelivered = functions.database.ref('/messages/{messageId}')
    .onCreate(async (snapshot, context) => {
        const message = snapshot.val();
        const receiverId = message.receiverId;

        // We can't directly know if the user is online and has the app open.
        // A common approach is to check the user's presence status.
        const userStatusRef = admin.database().ref(`/users/${receiverId}/status`);
        const userStatusSnapshot = await userStatusRef.once('value');

        if (userStatusSnapshot.val() === 'online') {
            // If the user is online, we can assume the message is delivered.
            return snapshot.ref.update({ status: 'delivered' });
        }
        return null;
    });

exports.sendStoryCommentNotification = functions.database.ref('/stories/{storyId}/comments/{commentId}')
    .onCreate(async (snapshot, context) => {
        const storyId = context.params.storyId;
        const commentId = context.params.commentId;

        const commentSnapshot = await admin.database().ref(`/stories/${storyId}/comments/${commentId}`).once('value');
        const comment = commentSnapshot.val();
        const userId = comment.userId;

        const storySnapshot = await admin.database().ref(`/stories/${storyId}`).once('value');
        const story = storySnapshot.val();

        if (story.userId !== userId) {
            const userSnapshot = await admin.database().ref(`/users/${userId}`).once('value');
            const user = userSnapshot.val();

            const payload = {
                notification: {
                    title: 'New Comment!',
                    body: `${user.username} commented on your story: ${comment.comment}`,
                    icon: user.avatar || '/images/default-avatar.png'
                }
            };

            const ownerId = story.userId;
            const tokensSnapshot = await admin.database().ref(`/users/${ownerId}/fcmTokens`).once('value');
            const tokens = Object.keys(tokensSnapshot.val());

            return admin.messaging().sendToDevice(tokens, payload);
        }
        return null;
    });
              
