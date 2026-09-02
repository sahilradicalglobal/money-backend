const { OAuth2Client } = require('google-auth-library');

let oauthClient;

function getOAuthClient() {
  if (!oauthClient) {
    oauthClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  }
  return oauthClient;
}

/**
 * Verify Google ID token from Android Credential Manager sign-in.
 * Returns { email, name, picture, sub } or throws.
 */
async function verifyGoogleIdToken(idToken) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    const err = new Error('Google Sign-In is not configured on the server (GOOGLE_CLIENT_ID)');
    err.status = 503;
    throw err;
  }

  const client = getOAuthClient();
  const ticket = await client.verifyIdToken({
    idToken,
    audience: clientId,
  });
  const payload = ticket.getPayload();
  if (!payload?.email) {
    const err = new Error('Google account email not available');
    err.status = 401;
    throw err;
  }
  if (payload.email_verified === false) {
    const err = new Error('Google email is not verified');
    err.status = 401;
    throw err;
  }

  return {
    email: payload.email,
    name: payload.name || payload.email.split('@')[0],
    picture: payload.picture || null,
    sub: payload.sub,
  };
}

module.exports = { verifyGoogleIdToken };
