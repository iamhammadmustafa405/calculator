// =====================================================================
// FIREBASE CONFIG — fill this in to turn on Google / Facebook sign-in
//
// 1. Go to https://console.firebase.google.com -> "Add project" (free)
// 2. Project overview -> click the </> (Web) icon -> register an app
//    -> copy the firebaseConfig values it shows into the object below
// 3. Build -> Authentication -> Get started -> Sign-in method:
//      • Google:   click it -> Enable -> pick a support email -> Save
//      • Facebook: needs an App ID + App Secret from Meta (see below)
// 4. Authentication -> Settings -> Authorized domains:
//      "localhost" is there already; add your real domain when you deploy
//      (e.g. yourname.github.io)
//
// Facebook extra steps:
//   a. https://developers.facebook.com -> My Apps -> Create App
//      -> use case "Authenticate and request data from users with Facebook Login"
//   b. App settings -> Basic: copy App ID and App Secret into Firebase's
//      Facebook provider and press Save
//   c. Firebase shows an "OAuth redirect URI" — paste it into Meta:
//      Facebook Login -> Settings -> Valid OAuth Redirect URIs -> Save
//
// These values are NOT secret passwords — Firebase web config is meant to be
// public. (Never put the Facebook App Secret in this file, only in Firebase.)
// =====================================================================

export const firebaseConfig = {
  apiKey: "AIzaSyCm2m8loKcoJqItH3rqMBXjmMRDLkEqlIM",
  authDomain: "my-calculator-75f4e.firebaseapp.com",
  projectId: "my-calculator-75f4e",
  storageBucket: "my-calculator-75f4e.firebasestorage.app",
  messagingSenderId: "853267268459",
  appId: "1:853267268459:web:20fa8cad9b8c5bf844422e",
};
