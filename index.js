import { Boom } from '@hapi/boom'
import { makeWASocket as Baileys, 
  DisconnectReason, 
  delay, 
  Browsers, 
  makeCacheableSignalKeyStore, 
  useMultiFileAuthState 
} from '@whiskeysockets/baileys'
import cors from 'cors'
import express from 'express'
import fs from 'fs'
import path, { dirname } from 'path'
import pino from 'pino'
import { fileURLToPath } from 'url'
import { upload } from './mega.js'

const app = express()

app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', '0')
  next()
})

app.use(cors())

let PORT = process.env.PORT || 8000
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

app.use(express.static(path.join(__dirname, 'client', 'build')))

function createRandomId() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let id = ''
  for (let i = 0; i < 10; i++) {
    id += characters.charAt(Math.floor(Math.random() * characters.length))
  }
  return id
}

let sessionFolder = `./auth/${createRandomId()}`
if (fs.existsSync(sessionFolder)) {
  try {
    fs.rmSync(sessionFolder, { recursive: true })
    console.log('Deleted session folder')
  } catch (err) {
    console.error('Error deleting session folder:', err)
  }
}

const clearState = () => {
  fs.rmSync(sessionFolder, { recursive: true })
}

function deleteSessionFolder() {
  if (!fs.existsSync(sessionFolder)) {
    console.log('Session folder does not exist')
    return
  }

  try {
    fs.rmSync(sessionFolder, { recursive: true })
    console.log('Deleted session folder')
  } catch (err) {
    console.error('Error deleting session folder:', err)
  }
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'build', 'index.html'))
})

app.get('/pair', async (req, res) => {
  const phone = req.query.phone
  if (!phone) return res.json({ error: 'Please provide phone number' })

  try {
    const code = await startSession(phone)
    res.json({ code })
  } catch (error) {
    console.error('Authentication error:', error)
    res.status(500).json({ error: error.message || 'Internal server error' })
  }
})

async function startSession(phone) {
  return new Promise(async (resolve, reject) => {
    try {
      if (!fs.existsSync(sessionFolder)) {
        fs.mkdirSync(sessionFolder, { recursive: true })
      }

      const { state, saveCreds } = await useMultiFileAuthState(sessionFolder)

      const client = Baileys({
        version: [2, 3000, 1015901307],
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: Browsers.ubuntu("Chrome"),
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(
            state.keys,
            pino().child({ level: 'fatal', stream: 'store' })
          ),
        },
      })

      if (!client.authState.creds.registered) {
        const phoneNumber = phone.replace(/[^0-9]/g, '')
        if (phoneNumber.length < 11) {
          return reject(new Error('Invalid phone number format'))
        }

        setTimeout(async () => {
          try {
            const code = await client.requestPairingCode(phoneNumber)
            console.log('Pairing code:', code)
            resolve(code)
          } catch (error) {
            reject(new Error('Failed to request pairing code'))
          }
        }, 3000)
      }

      client.ev.on('creds.update', saveCreds)

      client.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update

        if (connection === 'open') {
          console.log('Connected to WhatsApp')
          await delay(10000)
          
          try {
            const data = fs.createReadStream(`${sessionFolder}/creds.json`)
            const output = await upload(data, createRandomId() + '.json')
            const sessionId = output.includes('https://mega.nz/file/') 
              ? `KHAN-MD~${output.split('https://mega.nz/file/')[1]}`
              : 'Upload failed'

            await delay(2000)
            const msg = await client.sendMessage(client.user.id, { text: sessionId })
            
            await delay(2000)
            await client.sendMessage(
              client.user.id,
              {
                text: '*Hello there KHAN MD User! \ud83d\udc4b\ud83c\udffb* \n\n> Do not share your session id with anyone.\n\n *Thanks for using KHAN-MD \ud83c\uddf5\ud83c\uddf0* \n\n> Join WhatsApp Channel :- ⤵️\n \nhttps://whatsapp.com/channel/0029VatOy2EAzNc2WcShQw1j\n\n Dont forget to give star \ud83c\udf1f to repo ⬇️\n\nhttps://github.com/XdTechPro/KHAN-MD'
              },
              { quoted: msg }
            )

            deleteSessionFolder()
            process.send?.('reset')
          } catch (error) {
            console.error('Session handling error:', error)
          }
        }

        if (connection === 'close') {
          const reason = new Boom(lastDisconnect?.error)?.output.statusCode
          console.log('Disconnected:', DisconnectReason[reason] || reason)

          switch (reason) {
            case DisconnectReason.connectionClosed:
            case DisconnectReason.connectionLost:
            case DisconnectReason.timedOut:
            case DisconnectReason.connectionReplaced:
              process.send?.('reset')
              break
            case DisconnectReason.loggedOut:
            case DisconnectReason.badSession:
              clearState()
              process.send?.('reset')
              break
            case DisconnectReason.restartRequired:
              startSession(phone)
              break
            default:
              console.log('Unexpected disconnection')
              process.send?.('reset')
          }
        }
      })

      client.ev.on('messages.upsert', () => {})
    } catch (error) {
      console.error('Session error:', error)
      reject(error)
    }
  })
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
