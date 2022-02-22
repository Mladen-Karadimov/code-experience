import Keycloak from 'keycloak-js';
import { createApp } from 'vue';
import App from './App.vue';

let initOptions = {
    url: 'https://idp.com:8443/auth', realm: 'dummy-version', clientId: 'version-project', onLoad: 'login-required'
  }
  
  let keycloak = Keycloak(initOptions);
  keycloak.init({ onLoad: initOptions.onLoad }).then((auth) => {
    console.log("Start Init")
    if (!auth) {
      window.location.reload();
      console.log("WINDOWS RELOAD!")
    } else {
      console.log("Authenticated!")
      createApp(App).mount('#app');
    }

  //Token Refresh
    setInterval(() => {
      keycloak.updateToken(70).then((refreshed) => {
        if (refreshed) {
          console.log("Token refreshed - " + refreshed)
        } else {
          const tokenValid = Math.round(keycloak.tokenParsed.exp + keycloak.timeSkew - new Date().getTime() / 1000)
          console.log("Token not refreshed, valid for " + tokenValid + " seconds.")
        }
      }).catch(() => {
        console.log("Failed to refresh token!!")
      });
    }, 6000)

  }).catch(() => {
    console.log("Authenticated Failed")
  });
