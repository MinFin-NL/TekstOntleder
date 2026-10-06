import { createApp } from 'vue'
// Registers every <nldd-*> custom element (side effect: customElements.define).
import '@nldd/design-system'
import './index.css'
import App from './App.vue'

createApp(App).mount('#app')
