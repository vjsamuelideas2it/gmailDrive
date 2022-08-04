const axios = require("axios");
const qs = require("qs");
require("dotenv").config();

class GmailAPI {
  getAccessToken = async () => {
    var data = qs.stringify({
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET,
      refresh_token: process.env.REFRESH_TOKEN,
      grant_type: process.env.GRANT_TYPE,
    });
    var config = {
      method: "post",
      url: "https://accounts.google.com/o/oauth2/token",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      data: data,
    };

    var accessToken = "";

    await axios(config)
      .then(async function (response) {
        accessToken = await response.data.access_token;
      })
      .catch(function (error) {
        console.log(error);
      });

    return accessToken;
  };

  searchMail = async (searchItem) => {
    var configForListMessages = {
      method: "get",
      url:
        "https://gmail.googleapis.com/gmail/v1/users/me/messages?q=" +
        searchItem,
      headers: {
        Authorization: `Bearer ${await this.getAccessToken()}`,
      },
    };

    var messages;
    var threadIds = [];

    await axios(configForListMessages)
      .then(async function (response) {
        messages = await response.data["messages"];
        if (!messages) {
          console.log("No new emails with attachment available");
          return;
        }
        messages.forEach((threadId) => {
          threadIds.push(threadId.id);
        });
      })
      .catch(function (error) {
        console.log(error);
      });
    return threadIds;
  };

  readMailContent = async (messageId) => {
    const markMailAsRead = await this.markMailAsRead(messageId);
    var data = {};
    var mailContentConfig = {
      method: "get",
      url: `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`,
      headers: {
        Authorization: `Bearer ${await this.getAccessToken()}`,
      },
    };

    await axios(mailContentConfig)
      .then(async function (response) {
        data = await response.data;
      })
      .catch(function (error) {
        console.log(error);
      });
    return data;
  };

  markMailAsRead = async (messageId) => {
    var data = {
      addLabelIds: [],
      removeLabelIds: ["UNREAD"],
    };

    var config = {
      method: "post",
      url: `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`,
      headers: {
        Authorization: `Bearer ${await this.getAccessToken()}`,
        "Content-Type": "text/plain",
      },
      data: data,
    };

    axios(config)
      .then(function (response) {
        console.log(JSON.stringify(response.data));
      })
      .catch(function (error) {
        console.log(error);
      });
  };

  getAttachmentsData = async (messageId, attachmentId) => {
    var data = {};
    var mailAttachmentConfig = {
      method: "get",
      url: `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`,
      headers: {
        Authorization: `Bearer ${await this.getAccessToken()}`,
      },
    };
    await axios(mailAttachmentConfig)
      .then(async function (response) {
        data = await response.data;
      })
      .catch(function (error) {
        console.log(error);
      });
    return data;
  };

  getSenderAttachmentPair = async (searchText) => {
    const threadIds = await this.searchMail(searchText);

    const messagesPromises = threadIds.map((threadId) =>
      this.readMailContent(threadId)
    );
    const messages = await Promise.all(messagesPromises);
    var attachmentsData = messages.map((message) => {
      let validAttachmentData = message.payload.parts;
      validAttachmentData.shift();
      validAttachmentData = validAttachmentData;
      let senderEmail = message.payload.headers.map((header) => {
        return header.name === "From" ? header.value : null;
      });
      senderEmail = senderEmail.filter((email) => {
        return email !== null;
      });
      senderEmail = senderEmail[0];
      return {
        senderEmail: senderEmail,
        messageId: message.id,
        payload: validAttachmentData,
      };
    });

    const attachmentsPromise = attachmentsData.map(async (attachmentData) => {
      return attachmentData.payload[0].body.attachmentId
        ? {
            senderEmail: attachmentData.senderEmail,
            attachments: await Promise.all(
              attachmentData.payload.map((payload) =>
                this.getAttachmentsData(
                  attachmentData.messageId,
                  payload.body.attachmentId
                )
              )
            ),
          }
        : {
            senderEmail: attachmentData.senderEmail,
            attachments: null,
          };
    });
    const attachments = await Promise.all(attachmentsPromise);
    return attachments;
  };
}

module.exports = new GmailAPI();
