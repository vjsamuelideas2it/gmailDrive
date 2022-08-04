const fs = require("fs");
const readline = require("readline");
const { google } = require("googleapis");
const base64 = require("base64topdf");

const SCOPES = ["https://www.googleapis.com/auth/drive"];
const TOKEN_PATH = "token.json";

class DriveApi {
  uploadFileToDrive = (fileContent, senderEmail) => {
    // Load client secrets from a local file.
    fs.readFile("credentials.json", (err, content) => {
      if (err) return console.log("Error loading client secret file:", err);
      this.authorize(
        JSON.parse(content),
        fileContent,
        senderEmail,
        this.createFolder
      );
    });
  };

  /**
   * Create an OAuth2 client with the given credentials, and then execute the
   * given callback function.
   * @param {Object} credentials The authorization client credentials.
   * @param {function} callback The callback to call with the authorized client.
   */
  authorize = (credentials, fileContent, senderEmail, callback) => {
    const { client_secret, client_id, redirect_uris } = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      redirect_uris[0]
    );

    // Check if we have previously stored a token.
    fs.readFile(TOKEN_PATH, (err, token) => {
      if (err) return this.getAccessToken(oAuth2Client, callback);
      oAuth2Client.setCredentials(JSON.parse(token));
      callback(oAuth2Client, fileContent, senderEmail); //list files and upload file
      //callback(oAuth2Client, '0B79LZPgLDaqESF9HV2V3YzYySkE');//get file
    });
  };

  /**
   * Get and store new token after prompting for user authorization, and then
   * execute the given callback with the authorized OAuth2 client.
   * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
   * @param {getEventsCallback} callback The callback for the authorized client.
   */
  getAccessToken = (oAuth2Client, callback) => {
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: "offline",
      scope: SCOPES,
    });
    console.log("Authorize this app by visiting this url:", authUrl);
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question("Enter the code from that page here: ", (code) => {
      rl.close();
      oAuth2Client.getToken(code, (err, token) => {
        if (err) return console.error("Error retrieving access token", err);
        oAuth2Client.setCredentials(token);
        // Store the token to disk for later program executions
        fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
          if (err) return console.error(err);
          console.log("Token stored to", TOKEN_PATH);
        });
        callback(oAuth2Client);
      });
    });
  };

  /**
   * Create a folder and prints the folder ID
   * @return{obj} folder Id
   * */
  createFolder = async (auth, fileContent, senderEmail) => {
    // Get credentials and build service
    // TODO (developer) - Use appropriate auth mechanism for yo
    const service = google.drive({ version: "v3", auth });
    const fileMetadata = {
      name: senderEmail,
      mimeType: "application/vnd.google-apps.folder",
    };
    try {
      const folderId = await this.searchFile(auth, senderEmail);
      if (!folderId) {
        const file = await service.files.create({
          resource: fileMetadata,
          fields: "id",
        });
        this.uploadFile(auth, file.data.id, fileContent);
      } else {
        this.uploadFile(auth, folderId, fileContent);
      }
    } catch (err) {
      // TODO(developer) - Handle error
      throw err;
    }
  };

  searchFile = async (auth, senderEmail) => {
    const service = google.drive({ version: "v3", auth });
    const files = [];
    try {
      const res = await service.files.list({
        q: "name = '" + senderEmail + "'",
        fields: "nextPageToken, files(id, name)",
        spaces: "drive",
      });
      Array.prototype.push.apply(files, res.files);
      return res.data.files.length > 0 ? res.data.files[0].id : false;
    } catch (err) {
      // TODO(developer) - Handle error
      throw err;
    }
  };

  uploadFile = async (auth, folderId, fileContent) => {
    const drive = google.drive({ version: "v3", auth });
    const pdfFileName = "./files/" + Date.now() + ".pdf";
    const decodedPdf = base64.base64Decode(fileContent, pdfFileName);
    var fileMetadata = {
      name: Date.now() + ".pdf",
      parents: [folderId],
    };
    var media = {
      mimeType: "application/pdf",
      body: fs.createReadStream(pdfFileName),
    };
    try {
      const file = await drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: "id",
      });
      console.log("File Id:", file.data.id);
      return file.data.id;
    } catch (err) {
      // TODO(developer) - Handle error
      throw err;
    }
  };
}

module.exports = new DriveApi();
