const fs = require('fs').promises;
const path = require('path');
const process = require('process');
const {authenticate} = require('@google-cloud/local-auth');
const {google} = require('googleapis');

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/gmail.modify'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

/**
 * Reads previously authorized credentials from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    return null;
  }
}

/**
 * Serializes credentials to a file compatible with GoogleAUth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials(client) {
  const content = await fs.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload);
}

/**
 * Load or request or authorization to call APIs.
 *
 */
async function authorize() {
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    return client;
  }
  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });
  if (client.credentials) {
    await saveCredentials(client);
  }
  return client;
}

/**
 * Lists the labels in the user's account.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
async function listLabels(auth) {
  const gmail = google.gmail({version: 'v1', auth});
  const res = await gmail.users.labels.list({
    userId: 'me',
  });
  const labels = res.data.labels;
  if (!labels || labels.length === 0) {
    console.log('No labels found.');
    return;
  }
  console.log('Labels:');
  labels.forEach((label) => {
    console.log(`- ${label.name}`);
  });
}
async function isolateEmailThreads(auth) {
  try {
    // Load pre-authorized user credentials from the environment
    console.log("idhr hu m");
    // const auth = await google.auth.getClient();
    // Create Gmail API client
    const gmail = google.gmail({ version: 'v1', auth });

    // Retrieve unread email threads
    const response = await gmail.users.threads.list({
      userId: 'me',
      q: 'is:inbox is:unread -from:me',
    });

    const threads = response.data.threads;

    if (threads.length === 0) {
      console.log('No unread threads found.');
      return;
    }

    for (const thread of threads) {
      const threadId = thread.id;
      const threadResponse = await gmail.users.threads.get({
        userId: 'me',
        id: threadId,
        format: 'full',
      });

      const messages = threadResponse.data.messages;
      const firstMessage = messages[0];
      const repliedByMe = messages.some(message => {
        const fromEmail = message.payload.headers.find(
          header => header.name === 'From'
        ).value;
        console.log(fromEmail.includes('dhruvagrawal1055@gmail.com'));
        return fromEmail.includes('dhruvagrawal1055@gmail.com');
      });

      if (!repliedByMe) {
        console.log('Email thread without reply:', threadId);
        // Perform actions on email thread without reply
        // For example, you can send a reply using the replyToEmail function
        await replyToEmail(threadId, 'This is an automated reply.');
      }
    }
  } catch (error) {
    console.error('An error occurred:', error);
  }
}

async function replyToEmail(emailThreadId, replyContent) {
  try {
    // Load pre-authorized user credentials from the environment
    const auth = await google.auth.getClient();

    // Create Gmail API client
    const gmail = google.gmail({ version: 'v1', auth });

    // Retrieve the email thread
    const response = await gmail.users.threads.get({
      userId: 'me',
      id: emailThreadId,
      format: 'full',
    });

    const thread = response.data;
    const messages = thread.messages;
    const firstMessage = messages[0];

    // Extract the necessary information from the original email
    const toEmail = firstMessage.payload.headers.find(
      header => header.name === 'To'
    ).value;
    const fromEmail = firstMessage.payload.headers.find(
      header => header.name === 'From'
    ).value;
    const subject = firstMessage.payload.headers.find(
      header => header.name === 'Subject'
    ).value;

    // Prepare the reply email
    const replyMessage = `From: ${toEmail}\r\n` +
      `To: ${fromEmail}\r\n` +
      `Subject: ${subject}\r\n` +
      '\r\n' +
      `${replyContent}`;

    // Send the reply email
    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: Buffer.from(replyMessage)
          .toString('base64')
          .replace(/\+/g, '-')
          .replace(/\//g, '_'),
      },
    });

    console.log('Reply sent:', res.data);
  } catch (error) {
    console.error('An error occurred:', error);
  }
}

// Run the application
authorize().then(listLabels).catch(console.error);
// authorize().then(isolateEmailThreads).catch(console.error);
isolateEmailThreads();
