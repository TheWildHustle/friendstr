import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

const nostrLogin= async () => {
    const publicKey=  await window.nostr.getPublicKey();
        console.log(publicKey);

createRoot(document.getElementById('root')).render(<App/>)
