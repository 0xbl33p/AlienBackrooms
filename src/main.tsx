import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Note: not using <StrictMode>. R3F's Canvas plus React 19 StrictMode
// double-mounts the WebGL context in dev, which intermittently triggers
// "THREE.WebGLRenderer: Context Lost." and the scene never recovers.
createRoot(document.getElementById('root')!).render(<App />)
