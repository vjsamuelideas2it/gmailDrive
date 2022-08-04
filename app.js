const gmailApi = require("./GmailApi");
const driveApi = require('./DriveApi');

const emails = gmailApi.getSenderAttachmentPair('is:unread has:attachment');

emails.then((senders) => {
    senders.map(sender => {
        var senderEmail = sender.senderEmail
        sender.attachments.map(attachment => {
            const upload = driveApi.uploadFileToDrive(attachment.data, senderEmail);
        })
    });
});
